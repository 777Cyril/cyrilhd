/*
 * /api/delete.js — Delete an audio file from the GitHub repo.
 *
 * Requires the same GITHUB_TOKEN env var as api/upload.js.
 * (Settings → Environment Variables in Vercel dashboard)
 *
 * For avatar tracks: deletes the audio file AND removes it from
 * assets/songs/schedule.json so other visitors stop hearing it too.
 *
 * For produced tracks: deletes only the audio file (the default track
 * list is hardcoded in scripts.js; localStorage handles the rest).
 */

const REPO_OWNER = '777Cyril';
const REPO_NAME  = 'cyrilhd';
const BRANCH     = 'main';
const GITHUB_API = 'https://api.github.com';

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
    const allowed = target === 'avatar'
        ? 'assets/audio/favorites/'
        : 'assets/audio/produced/';

    if (!filePath.startsWith(allowed)) {
        return res.status(400).json({ error: `Path must be within ${allowed}` });
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

    if (target === 'avatar') {
        try {
            await removeFromSchedule(filePath, ghHeaders);
        } catch (e) {
            console.error('schedule.json update failed:', e.message);
            return res.status(500).json({ error: 'File deleted from GitHub but schedule.json update failed: ' + e.message });
        }
    } else {
        try {
            await removeFromProduced(filePath, ghHeaders);
        } catch (e) {
            console.error('produced.json update failed:', e.message);
            return res.status(500).json({ error: 'File deleted from GitHub but produced.json update failed: ' + e.message });
        }
    }

    return res.status(200).json({ ok: true });
};

async function removeFromProduced(deletedPath, ghHeaders) {
    const producedPath = 'assets/songs/produced.json';
    const producedUrl = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${producedPath}?ref=${BRANCH}`;

    const getRes = await fetch(producedUrl, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not fetch produced.json (${getRes.status})`);

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const before = current.produced.length;
    current.produced = current.produced.filter(function(t) { return t.src !== deletedPath; });

    if (current.produced.length === before) return;

    const updatedContent = Buffer.from(JSON.stringify(current, null, 2) + '\n').toString('base64');

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${producedPath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `delete: remove ${deletedPath.split('/').pop()} from produced`,
                content: updatedContent,
                sha: fileData.sha,
                branch: BRANCH,
            }),
        }
    );

    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(`produced.json commit failed: ${err.message || putRes.status}`);
    }
}

async function removeFromSchedule(deletedPath, ghHeaders) {
    const schedulePath = 'assets/songs/schedule.json';
    const scheduleUrl = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${schedulePath}?ref=${BRANCH}`;

    const getRes = await fetch(scheduleUrl, { headers: ghHeaders });
    if (!getRes.ok) throw new Error(`Could not fetch schedule.json (${getRes.status})`);

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const before = current.favorites.length;
    current.favorites = current.favorites.filter(function(p) { return p !== deletedPath; });

    // Nothing changed — skip unnecessary commit
    if (current.favorites.length === before) return;

    const updatedContent = Buffer.from(JSON.stringify(current, null, 2) + '\n').toString('base64');

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${schedulePath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `delete: remove ${deletedPath.split('/').pop()} from favorites`,
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
