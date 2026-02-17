const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegStatic);

function isYouTube(url) {
    return /youtube\.com\/|youtu\.be\//.test(url);
}

function isSoundCloud(url) {
    return /soundcloud\.com\//.test(url);
}

function sanitizeFilename(name) {
    return (name || 'download')
        .replace(/[^\w\s\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100) || 'download';
}

async function getYouTubeStream(url) {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;
    const stream = ytdl.downloadFromInfo(info, {
        quality: 'highestaudio',
        filter: 'audioonly',
    });
    return { stream, title };
}

async function getSoundCloudStream(url) {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
        throw new Error('SoundCloud is not configured (missing SOUNDCLOUD_CLIENT_ID)');
    }

    // Resolve the track via SoundCloud API
    const resolveRes = await fetch(
        `https://api.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`
    );
    if (!resolveRes.ok) {
        throw new Error('SoundCloud track not found or private');
    }
    const track = await resolveRes.json();
    const title = track.title || 'soundcloud-track';

    // Find a progressive MP3 stream (no HLS to re-encode)
    let streamUrl = null;
    if (track.media && Array.isArray(track.media.transcodings)) {
        const progressive = track.media.transcodings.find(
            (t) => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
        );
        if (progressive) {
            const streamRes = await fetch(`${progressive.url}?client_id=${clientId}`);
            if (streamRes.ok) {
                const data = await streamRes.json();
                streamUrl = data.url;
            }
        }
    }

    // Fallback: try the direct download URL (only available for tracks that allow downloads)
    if (!streamUrl && track.download_url) {
        streamUrl = `${track.download_url}?client_id=${clientId}`;
    }

    if (!streamUrl) {
        throw new Error('No streamable format found for this SoundCloud track');
    }

    const audioRes = await fetch(streamUrl);
    if (!audioRes.ok) {
        throw new Error('Failed to fetch SoundCloud audio stream');
    }

    // Convert web ReadableStream → Node.js Readable
    const stream = Readable.fromWeb(audioRes.body);
    return { stream, title };
}

module.exports = async function handler(req, res) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        let stream, title;

        if (isYouTube(url)) {
            if (!ytdl.validateURL(url)) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }
            ({ stream, title } = await getYouTubeStream(url));
        } else if (isSoundCloud(url)) {
            ({ stream, title } = await getSoundCloudStream(url));
        } else {
            return res.status(400).json({ error: 'Unsupported URL. Only YouTube and SoundCloud links are supported.' });
        }

        const filename = sanitizeFilename(title) + '.mp3';
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        await new Promise((resolve, reject) => {
            ffmpeg(stream)
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
