/*
 * /api/upload.js — Commit an audio file directly to the GitHub repo.
 *
 * SETUP (one-time):
 *   1. Go to https://github.com/settings/tokens/new
 *   2. Give it a name (e.g. "cyrilhd-upload"), set expiration, select scope: repo (full)
 *   3. Copy the token
 *   4. In Vercel dashboard → your project → Settings → Environment Variables
 *      Add: GITHUB_TOKEN = <your token>  (all environments)
 *   5. Redeploy once for the env var to take effect
 *
 * After that, uploads from the songs panel will commit files to the repo
 * and Vercel will auto-deploy them as real static assets in ~30s.
 */

const REPO_OWNER = '777Cyril';
const REPO_NAME  = 'cyrilhd';
const BRANCH     = 'main';
const GITHUB_API = 'https://api.github.com';

// Raise Vercel's default 4.5mb body limit so large MP3s get through
module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
};

// We receive JSON: { filename, dataBase64, target }
// target: 'avatar' | 'produced'

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return res.status(503).json({
            error: 'GITHUB_TOKEN not configured — see api/upload.js comments for setup instructions'
        });
    }

    let body;
    try {
        // Vercel automatically parses JSON bodies
        body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { filename, dataBase64, target } = body || {};

    if (!filename || !dataBase64 || !target) {
        return res.status(400).json({ error: 'Missing required fields: filename, dataBase64, target' });
    }

    if (target !== 'avatar' && target !== 'produced') {
        return res.status(400).json({ error: 'target must be "avatar" or "produced"' });
    }

    // Sanitize filename: strip path separators, control chars
    const safe = filename
        .replace(/[/\\]/g, '')
        .replace(/[<>:"|?*\x00-\x1f]/g, '')
        .trim()
        .substring(0, 120);

    if (!safe) return res.status(400).json({ error: 'Invalid filename' });

    const folder = target === 'avatar' ? 'assets/audio/favorites' : 'assets/audio/produced';
    const filePath = `${folder}/${safe}`;

    const ghHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cyrilhd-upload',
    };

    // Check if file already exists (need its SHA to update)
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

    // Commit the audio file
    const commitBody = {
        message: `upload: add ${safe} to ${folder}`,
        content: dataBase64,
        branch: BRANCH,
        ...(existingSha ? { sha: existingSha } : {}),
    };

    const commitRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
        { method: 'PUT', headers: ghHeaders, body: JSON.stringify(commitBody) }
    );

    if (!commitRes.ok) {
        const err = await commitRes.json().catch(() => ({}));
        return res.status(502).json({
            error: `GitHub commit failed (${commitRes.status}): ${err.message || 'unknown error'}`
        });
    }

    // For avatar uploads: also update assets/songs/schedule.json to add the new path
    if (target === 'avatar') {
        try {
            await updateScheduleJson(filePath, ghHeaders);
        } catch (e) {
            // Non-fatal: file was committed, schedule update failed. Log and continue.
            console.error('schedule.json update failed:', e.message);
        }
    }

    return res.status(200).json({
        ok: true,
        path: filePath,
        title: safe.replace(/\.[^/.]+$/, ''),
    });
}

module.exports = handler;

async function updateScheduleJson(newAudioPath, ghHeaders) {
    const schedulePath = 'assets/songs/schedule.json';
    const scheduleUrl = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${schedulePath}?ref=${BRANCH}`;

    const getRes = await fetch(scheduleUrl, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not fetch schedule.json (${getRes.status})`);

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    // Add if not already present
    if (!current.favorites.includes(newAudioPath)) {
        current.favorites.push(newAudioPath);
    }

    const updatedContent = Buffer.from(JSON.stringify(current, null, 2) + '\n').toString('base64');

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${schedulePath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `upload: add ${newAudioPath.split('/').pop()} to favorites`,
                content: updatedContent,
                sha: fileData.sha,
                branch: BRANCH,
            }),
        }
    );

    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(`schedule.json commit failed: ${err.message || putRes.status}`);
    }
}
