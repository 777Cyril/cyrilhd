/*
 * /api/rename.js — Update a track's display title in schedule.json or produced.json.
 *
 * POST { target: 'avatar'|'produced', src: 'assets/audio/...', title: 'new title' }
 */

const lib = require('../scripts/playlist-lib.js');

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
    if (!token) return res.status(503).json({ error: 'GITHUB_TOKEN not configured' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const { target, src, title } = body || {};

    if (!target || !src || !title) {
        return res.status(400).json({ error: 'Missing required fields: target, src, title' });
    }
    if (target !== 'avatar' && target !== 'produced') {
        return res.status(400).json({ error: 'target must be "avatar" or "produced"' });
    }

    const ghHeaders = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cyrilhd-rename',
    };

    const jsonPath = target === 'avatar' ? 'assets/songs/schedule.json' : 'assets/songs/produced.json';
    const listKey  = target === 'avatar' ? 'favorites' : 'produced';

    const getRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${jsonPath}?ref=${BRANCH}`,
        { headers: ghHeaders }
    );
    if (!getRes.ok) return res.status(502).json({ error: `Could not fetch ${jsonPath} (${getRes.status})` });

    const fileData = await getRes.json();
    const current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    let updated = false;
    current[listKey] = current[listKey].map(function(entry) {
        // lib.srcOf handles both legacy plain-string entries and {title, src}
        if (lib.srcOf(entry) === src) {
            updated = true;
            return { title, src };
        }
        return entry;
    });

    if (!updated) return res.status(404).json({ error: 'Track not found in ' + jsonPath });

    const updatedContent = Buffer.from(lib.stringify(current, listKey)).toString('base64');
    const filename = src.split('/').pop();

    const putRes = await fetch(
        `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${jsonPath}`,
        {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `rename: ${filename} → "${title}"`,
                content: updatedContent,
                sha: fileData.sha,
                branch: BRANCH,
            }),
        }
    );

    if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return res.status(502).json({ error: `GitHub commit failed: ${err.message || putRes.status}` });
    }

    return res.status(200).json({ ok: true });
};
