const ytdl = require('@distube/ytdl-core');

function isYouTube(url) {
    return /youtube\.com\/|youtu\.be\//.test(url);
}

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

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        let metadata;

        if (isYouTube(url)) {
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }
            const info = await ytdl.getInfo(url);
            const d = info.videoDetails;
            const durationSecs = parseInt(d.lengthSeconds, 10);
            metadata = {
                title: d.title,
                duration: formatDuration(durationSecs),
                thumbnail: d.thumbnails?.[d.thumbnails.length - 1]?.url || null,
                platform: 'youtube',
            };
        } else if (isSoundCloud(url)) {
            const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
            if (!clientId) {
                return res.status(503).json({ error: 'SoundCloud is not configured' });
            }
            const resolveRes = await fetch(
                `https://api.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`
            );
            if (!resolveRes.ok) {
                return res.status(404).json({ error: 'SoundCloud track not found or private' });
            }
            const track = await resolveRes.json();
            const durationSecs = Math.floor((track.duration || 0) / 1000);
            metadata = {
                title: track.title || 'Unknown track',
                duration: formatDuration(durationSecs),
                thumbnail: track.artwork_url
                    ? track.artwork_url.replace('-large', '-t500x500')
                    : null,
                platform: 'soundcloud',
            };
        } else {
            return res.status(400).json({ error: 'Unsupported URL. Only YouTube and SoundCloud links are supported.' });
        }

        res.json(metadata);
    } catch (err) {
        console.error('Metadata error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to fetch track info' });
    }
};
