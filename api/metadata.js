const { getClientId } = require('./sc-client');

const SC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://soundcloud.com/',
    'Origin': 'https://soundcloud.com',
};

function isSoundCloud(url) {
    return /soundcloud\.com\//.test(url);
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

module.exports = async function handler(req, res) {
    const { url } = req.query;

    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        if (!isSoundCloud(url)) {
            return res.status(400).json({ error: 'Only SoundCloud URLs are supported' });
        }

        const clientId = await getClientId();
        if (!clientId) return res.status(503).json({ error: 'SoundCloud is not configured' });

        const resolveRes = await fetch(
            `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`,
            { headers: SC_HEADERS }
        );

        if (!resolveRes.ok) {
            const status = resolveRes.status;
            if (status === 401 || status === 403) return res.status(401).json({ error: 'SoundCloud client ID is invalid or expired' });
            if (status === 404) return res.status(404).json({ error: 'SoundCloud track not found' });
            return res.status(status).json({ error: `SoundCloud API error (${status})` });
        }

        const track = await resolveRes.json();
        const durationSecs = Math.floor((track.duration || 0) / 1000);

        res.json({
            title: track.title || 'Unknown',
            duration: formatDuration(durationSecs),
            thumbnail: track.artwork_url
                ? track.artwork_url.replace('-large', '-t500x500')
                : null,
            platform: 'soundcloud',
        });
    } catch (err) {
        console.error('Metadata error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to fetch track info' });
    }
};
