const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegStatic);

const SC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://soundcloud.com/',
    'Origin': 'https://soundcloud.com',
};

function isSoundCloud(url) {
    return /soundcloud\.com\//.test(url);
}

function sanitizeFilename(name) {
    return (name || 'download')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100) || 'download';
}

async function getSoundCloudStream(url) {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
        throw new Error('SoundCloud is not configured (missing SOUNDCLOUD_CLIENT_ID env var)');
    }

    const resolveRes = await fetch(
        `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`,
        { headers: SC_HEADERS }
    );

    if (!resolveRes.ok) {
        const status = resolveRes.status;
        if (status === 401 || status === 403) throw new Error('SoundCloud client ID is invalid or expired');
        if (status === 404) throw new Error('SoundCloud track not found — is the link correct?');
        throw new Error(`SoundCloud API error (${status})`);
    }

    const track = await resolveRes.json();
    const title = track.title || 'soundcloud-track';

    // Resolve a transcoding URL → direct stream/playlist URL
    async function resolveTranscoding(t) {
        const r = await fetch(`${t.url}?client_id=${clientId}`, { headers: SC_HEADERS });
        if (!r.ok) return null;
        return (await r.json()).url || null;
    }

    let streamUrl = null;
    let isHls = false;

    if (track.media && Array.isArray(track.media.transcodings)) {
        const tc = track.media.transcodings;

        // 1. Progressive MP3 (best: single file, no playlist handling needed)
        const progMp3 = tc.find((t) => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg');
        if (progMp3) streamUrl = await resolveTranscoding(progMp3);

        // 2. Any progressive format
        if (!streamUrl) {
            const progAny = tc.find((t) => t.format.protocol === 'progressive');
            if (progAny) streamUrl = await resolveTranscoding(progAny);
        }

        // 3. HLS MP3 (ffmpeg handles m3u8 natively)
        if (!streamUrl) {
            const hlsMp3 = tc.find((t) => t.format.protocol === 'hls' && t.format.mime_type === 'audio/mpeg');
            if (hlsMp3) { streamUrl = await resolveTranscoding(hlsMp3); isHls = true; }
        }

        // 4. Any HLS format
        if (!streamUrl) {
            const hlsAny = tc.find((t) => t.format.protocol === 'hls');
            if (hlsAny) { streamUrl = await resolveTranscoding(hlsAny); isHls = true; }
        }
    }

    if (!streamUrl && track.download_url) {
        streamUrl = `${track.download_url}?client_id=${clientId}`;
    }

    if (!streamUrl) throw new Error('No streamable format found for this SoundCloud track');

    if (isHls) {
        // ffmpeg reads the HLS playlist URL directly — no need to fetch it ourselves
        return { hlsUrl: streamUrl, title };
    }

    const audioRes = await fetch(streamUrl, { headers: SC_HEADERS });
    if (!audioRes.ok) throw new Error(`Failed to fetch SoundCloud audio (${audioRes.status})`);

    return { nodeStream: Readable.fromWeb(audioRes.body), title };
}

module.exports = async function handler(req, res) {
    const { url } = req.query;

    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        if (!isSoundCloud(url)) {
            return res.status(400).json({ error: 'Only SoundCloud URLs are supported' });
        }

        const result = await getSoundCloudStream(url);
        const ffmpegInput = result.nodeStream || result.hlsUrl;
        const filename = sanitizeFilename(result.title) + '.mp3';

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        await new Promise((resolve, reject) => {
            ffmpeg(ffmpegInput)
                .audioBitrate(320)
                .audioCodec('libmp3lame')
                .format('mp3')
                .on('error', (err) => {
                    console.error('ffmpeg error:', err.message);
                    reject(err);
                })
                .on('end', resolve)
                .pipe(res, { end: true });
        });
    } catch (err) {
        console.error('Download error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Download failed' });
        }
    }
};
