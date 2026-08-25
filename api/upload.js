/*
 * /api/upload.js — Two-phase upload helper.
 *
 * Vercel hard-caps request bodies at 4.5mb at the infrastructure level,
 * which can't be overridden in code. So we never send the file through Vercel.
 *
 * Phase 1 — POST { filename, target }
 *   Returns { filePath, existingSha, token } so the client can PUT the file
 *   directly to the GitHub Contents API without going through Vercel.
 *
 * Phase 2 — POST { filePath, target, finalize: true }
 *   Called after the client has committed the file to GitHub.
 *   Registers the track in its playlist JSON (schedule.json or produced.json).
 *   Returns { ok, path, title }.
 *
 * SETUP (one-time):
 *   Vercel dashboard → your project → Settings → Environment Variables
 *   Add: GITHUB_TOKEN = <your repo-scoped token>  (all environments)
 */

const lib = require('../scripts/playlist-lib.js');

const REPO_OWNER = '777Cyril';
const REPO_NAME  = 'cyrilhd';
const BRANCH     = 'main';
const GITHUB_API = 'https://api.github.com';

// Per-target config — the only thing that differs between the two playlists.
const TARGETS = {
    avatar: {
        audioDir: 'assets/audio/favorites/',
        jsonPath: 'assets/songs/schedule.json',
        listKey:  'favorites',
        titleFn:  lib.deriveTitleSimple,
    },
    produced: {
        audioDir: 'assets/audio/produced/',
        jsonPath: 'assets/songs/produced.json',
        listKey:  'produced',
        titleFn:  lib.deriveTitle,
    },
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-upload-secret');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const uploadSecret = process.env.UPLOAD_SECRET;
    if (uploadSecret && req.headers['x-upload-secret'] !== uploadSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return res.status(503).json({ error: 'GITHUB_TOKEN not configured' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const { filename, target, finalize, filePath: finalFilePath } = body || {};

    if (!target || (target !== 'avatar' && target !== 'produced')) {
        return res.status(400).json({ error: 'target must be "avatar" or "produced"' });
    }

    const ghHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cyrilhd-upload',
    };

    // ── Phase 2: finalize (register the track after client committed the file) ──
    if (finalize) {
        if (!finalFilePath) return res.status(400).json({ error: 'Missing filePath for finalize' });

        const cfg = TARGETS[target];
        if (!finalFilePath.startsWith(cfg.audioDir)) {
            return res.status(400).json({ error: `filePath must be within ${cfg.audioDir}` });
        }

        const title = cfg.titleFn(finalFilePath.split('/').pop());

        try {
            await addToPlaylist(cfg, finalFilePath, title, ghHeaders);
        } catch (e) {
            console.error(`${cfg.jsonPath} update failed:`, e.message);
            return res.status(500).json({
                error: `File uploaded to GitHub but ${cfg.jsonPath} update failed: ` + e.message,
            });
        }

        return res.status(200).json({
            ok: true,
            path: finalFilePath,
            title,
            scheduleUpdated: true,
        });
    }

    // ── Phase 1: prepare upload (return token + filePath + existingSha) ──
    if (!filename) return res.status(400).json({ error: 'Missing filename' });

    const safe = filename
        .replace(/[/\\]/g, '')
        .replace(/[<>:"|?*\x00-\x1f]/g, '')
        .trim()
        .substring(0, 120);

    if (!safe) return res.status(400).json({ error: 'Invalid filename' });

    const filePath = `${TARGETS[target].audioDir}${safe}`;

    // Check if file already exists (need its SHA to overwrite)
    let existingSha = null;
    try {
        const checkRes = await fetch(
            `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
            { headers: ghHeaders }
        );
        if (checkRes.ok) {
            const data = await checkRes.json();
            existingSha = data.sha;
        }
    } catch (_) {}

    return res.status(200).json({
        filePath,
        existingSha,
        token,          // client uses this to PUT directly to GitHub (bypasses Vercel body limit)
        repoOwner: REPO_OWNER,
        repoName: REPO_NAME,
        branch: BRANCH,
    });
};

/*
 * Register a track in its playlist JSON.
 *
 * Both playlists go through lib.upsert, which compares by `src` regardless of
 * entry shape. The previous favorites path used `Array.includes(path)`, which
 * could never match an object entry — so every renamed track got silently
 * re-added as a duplicate. Comparing by src is what prevents that.
 */
async function addToPlaylist(cfg, newAudioPath, title, ghHeaders) {
    const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cfg.jsonPath}?ref=${BRANCH}`;

    const getRes = await fetch(url, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not fetch ${cfg.jsonPath} (${getRes.status})`);

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const before = current[cfg.listKey];
    const after = lib.upsert(before, { title, src: newAudioPath }, cfg.titleFn);

    // Already registered — skip an empty commit (and the deploy it would cost).
    if (after.length === before.length) return;

    current[cfg.listKey] = after;
    const updatedContent = Buffer.from(JSON.stringify(current, null, 2) + '\n').toString('base64');

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cfg.jsonPath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `upload: add ${newAudioPath.split('/').pop()} to ${cfg.listKey}`,
                content: updatedContent,
                sha: fileData.sha,
                branch: BRANCH,
            }),
        }
    );

    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(`${cfg.jsonPath} commit failed: ${err.message || putRes.status}`);
    }
}
