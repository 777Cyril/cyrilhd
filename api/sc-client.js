// Scrapes a fresh SoundCloud client_id from their web app JS bundles.
// Falls back to the env var if scraping fails. Caches in-process for 1 hour.

const SC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

let cached = null;
let cachedAt = 0;
const TTL = 60 * 60 * 1000; // 1 hour

async function scrapeClientId() {
    const html = await fetch('https://soundcloud.com', { headers: SC_HEADERS }).then(r => r.text());

    // Find all <script src="..."> URLs pointing to their JS bundles
    const scriptUrls = [];
    const re = /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    let m;
    while ((m = re.exec(html)) !== null) scriptUrls.push(m[1]);

    // Check the last few scripts — client_id is usually in one of the last bundles
    for (const url of scriptUrls.slice(-5).reverse()) {
        try {
            const js = await fetch(url, { headers: { 'User-Agent': SC_HEADERS['User-Agent'] } }).then(r => r.text());
            const match = js.match(/client_id\s*:\s*"([a-zA-Z0-9]{20,40})"/);
            if (match) return match[1];
        } catch (_) {}
    }

    return null;
}

async function getClientId() {
    if (cached && Date.now() - cachedAt < TTL) return cached;

    try {
        const id = await scrapeClientId();
        if (id) {
            cached = id;
            cachedAt = Date.now();
            return id;
        }
    } catch (_) {}

    // Fallback to env var
    return process.env.SOUNDCLOUD_CLIENT_ID || null;
}

module.exports = { getClientId };
