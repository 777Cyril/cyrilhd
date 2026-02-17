#!/usr/bin/env node
// Downloads the yt-dlp standalone Linux binary (no Python required).
// Runs automatically via `postinstall` so Vercel has it during build.
// Always downloads a fresh copy — YouTube changes constantly and stale
// yt-dlp versions break within weeks.

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const BIN_PATH = path.join(BIN_DIR, 'yt-dlp');
// Standalone binary — no Python interpreter needed
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

function download(url, dest, hops = 0) {
    return new Promise((resolve, reject) => {
        if (hops > 10) return reject(new Error('Too many redirects'));
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(download(res.headers.location, dest, hops + 1));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', (err) => { fs.unlinkSync(dest); reject(err); });
        }).on('error', reject);
    });
}

if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

// Always download fresh — yt-dlp breaks quickly when outdated because YouTube
// constantly changes its API. Skipping the download risks running a stale binary.
console.log('Downloading latest yt-dlp standalone Linux binary...');
download(DOWNLOAD_URL, BIN_PATH)
    .then(() => {
        fs.chmodSync(BIN_PATH, 0o755);
        console.log('yt-dlp downloaded to', BIN_PATH);
    })
    .catch((err) => {
        console.error('Failed to download yt-dlp:', err.message);
        process.exit(1);
    });
