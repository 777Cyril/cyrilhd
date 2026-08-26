/*
 * /api/delete.js — Delete an audio file from the GitHub repo.
 *
 * Requires the same GITHUB_TOKEN env var as api/upload.js.
 * (Settings → Environment Variables in Vercel dashboard)
 *
 * Deletes the audio file AND removes it from its playlist JSON
 * (schedule.json or produced.json) so other visitors stop hearing it too.
 */

const lib = require('../scripts/playlist-lib.js');

const REPO_OWNER = '777Cyril';
const REPO_NAME  = 'cyrilhd';
const BRANCH     = 'main';
const GITHUB_API = 'https://api.github.com';

// Per-target config — the only thing that differs between the two playlists.
const TARGETS = {
    avatar:   { audioDir: 'assets/audio/favorites/', jsonPath: 'assets/songs/schedule.json', listKey: 'favorites' },
    produced: { audioDir: 'assets/audio/produced/',  jsonPath: 'assets/songs/produced.json', listKey: 'produced'  },
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

    let body;
    try {
        body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // path: full repo path e.g. "assets/audio/favorites/DRUGZ.mp3"
    // target: 'avatar' | 'produced'
    const { path: filePath, target } = body || {};

    if (!filePath || !target) {
        return res.status(400).json({ error: 'Missing required fields: path, target' });
    }

    if (target !== 'avatar' && target !== 'produced') {
        return res.status(400).json({ error: 'target must be "avatar" or "produced"' });
    }

    // Only allow deletion from the expected folders
    const cfg = TARGETS[target];
    if (!filePath.startsWith(cfg.audioDir)) {
        return res.status(400).json({ error: `Path must be within ${cfg.audioDir}` });
    }

    const ghHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cyrilhd-delete',
    };

    // Get current SHA of the file (required for deletion)
    const getRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
        { headers: ghHeaders }
    );

    if (!getRes.ok) {
        if (getRes.status === 404) {
            // File already gone — still clean up the manifest
            try {
                if (target === 'avatar') await removeFromSchedule(filePath, ghHeaders);
                else await removeFromProduced(filePath, ghHeaders);
            } catch (_) {}
            return res.status(200).json({ ok: true, note: 'file not found on GitHub, already deleted' });
        }
        return res.status(502).json({ error: `GitHub API error (${getRes.status})` });
    }

    const fileData = await getRes.json();

    // Delete the file
    const delRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
        {
            method: 'DELETE',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `delete: remove ${filePath.split('/').pop()}`,
                sha: fileData.sha,
                branch: BRANCH,
            }),
        }
    );

    if (!delRes.ok) {
        const err = await delRes.json().catch(() => ({}));
        return res.status(502).json({
            error: `GitHub delete failed (${delRes.status}): ${err.message || 'unknown error'}`
        });
    }

    try {
        await removeFromPlaylist(cfg, filePath, ghHeaders);
    } catch (e) {
        console.error(`${cfg.jsonPath} update failed:`, e.message);
        return res.status(500).json({
            error: `File deleted from GitHub but ${cfg.jsonPath} update failed: ` + e.message,
        });
    }

    return res.status(200).json({ ok: true });
};

/*
 * Remove a track from its playlist JSON.
 *
 * Uses lib.removeSrc, which matches by `src` whatever the entry shape. The
 * previous favorites path filtered with `p !== deletedPath`, comparing a
 * string against entries that may be objects — so deleting a track that had
 * ever been renamed silently removed nothing, stranding a reference to a file
 * that no longer existed. Ten such entries had accumulated.
 */
async function removeFromPlaylist(cfg, deletedPath, ghHeaders) {
    const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cfg.jsonPath}?ref=${BRANCH}`;

    const getRes = await fetch(url, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not fetch ${cfg.jsonPath} (${getRes.status})`);

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const before = current[cfg.listKey];
    const after = lib.removeSrc(before, deletedPath);

    // Nothing changed — skip unnecessary commit
    if (after.length === before.length) return;

    current[cfg.listKey] = after;
    const updatedContent = Buffer.from(lib.stringify(current, cfg.listKey)).toString('base64');

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${cfg.jsonPath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `delete: remove ${deletedPath.split('/').pop()} from ${cfg.listKey}`,
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
