const youtubedl = require('youtube-dl-exec');
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

function isYouTube(url) {
    return /youtube\.com\/|youtu\.be\//.test(url);
}

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

async function getYouTubeStream(url) {
    // yt-dlp handles all bot detection and generates a signed CDN URL
    const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        format: 'bestaudio/best',
    });

    if (!info || !info.url) {
        throw new Error('yt-dlp could not extract an audio URL for this video');
    }

    return { directUrl: info.url, title: info.title || 'youtube-track' };
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

    let streamUrl = null;
    if (track.media && Array.isArray(track.media.transcodings)) {
        // Prefer progressive MP3
        const progressive = track.media.transcodings.find(
            (t) => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
        );
        if (progressive) {
            const r = await fetch(`${progressive.url}?client_id=${clientId}`, { headers: SC_HEADERS });
            if (r.ok) streamUrl = (await r.json()).url;
        }

        // Fallback: any progressive format
        if (!streamUrl) {
            const any = track.media.transcodings.find((t) => t.format.protocol === 'progressive');
            if (any) {
                const r = await fetch(`${any.url}?client_id=${clientId}`, { headers: SC_HEADERS });
                if (r.ok) streamUrl = (await r.json()).url;
            }
        }
    }

    if (!streamUrl && track.download_url) {
        streamUrl = `${track.download_url}?client_id=${clientId}`;
    }

    if (!streamUrl) throw new Error('No streamable format found for this SoundCloud track');

    const audioRes = await fetch(streamUrl, { headers: SC_HEADERS });
    if (!audioRes.ok) throw new Error(`Failed to fetch SoundCloud audio (${audioRes.status})`);

    return { nodeStream: Readable.fromWeb(audioRes.body), title };
}

module.exports = async function handler(req, res) {
    const { url } = req.query;

    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        let ffmpegInput, title;

        if (isYouTube(url)) {
            const { directUrl, title: t } = await getYouTubeStream(url);
            ffmpegInput = directUrl; // ffmpeg fetches the CDN URL directly
            title = t;
        } else if (isSoundCloud(url)) {
            const { nodeStream, title: t } = await getSoundCloudStream(url);
            ffmpegInput = nodeStream;
            title = t;
        } else {
            return res.status(400).json({ error: 'Only YouTube and SoundCloud URLs are supported' });
        }

        const filename = sanitizeFilename(title) + '.mp3';
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
