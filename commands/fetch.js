const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Helper function to add reaction
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Reaction error:', error);
    }
}

// ===============================
// 🔒 SECURITY: BLOCK PRIVATE IPs
// ===============================
const BLOCKED_IPS = [
    '127.0.0.1', 'localhost', '0.0.0.0',
    '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
    '169.254.0.0/16', '::1', 'fc00::/7', 'fe80::/10'
];

function isPrivateIP(hostname) {
    const ipPatterns = [
        /^127\.\d+\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/,
        /^::1$/,
        /^fc00:/,
        /^fe80:/
    ];
    return ipPatterns.some(pattern => pattern.test(hostname));
}

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        if (isPrivateIP(parsed.hostname)) return false;
        return true;
    } catch {
        return false;
    }
}

// ===============================
// 📁 FILE & PATH HELPERS
// ===============================
function getSafeFileName(url) {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname;
        const basename = path.basename(pathname) || 'index';
        const ext = path.extname(basename);
        const name = basename.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_') || 'page';
        return { name, ext: ext || '.html' };
    } catch {
        return { name: 'page', ext: '.html' };
    }
}

function getMimeType(contentType) {
    if (contentType.includes('text/html')) return 'html';
    if (contentType.includes('application/json')) return 'json';
    if (contentType.includes('text/xml')) return 'xml';
    if (contentType.includes('text/plain')) return 'txt';
    if (contentType.includes('text/css')) return 'css';
    if (contentType.includes('application/javascript')) return 'js';
    if (contentType.includes('image/')) return 'image';
    return 'unknown';
}

// ===============================
// 🧹 CLEAN HTML (SAFE)
// ===============================
function cleanHTML(html) {
    // Only remove excessive whitespace, keep unicode
    return html.replace(/\n\s*\n/g, '\n').replace(/\t/g, '  ');
}

// ===============================
// 🌐 CRAWL & DOWNLOAD ASSETS
// ===============================
async function downloadAsset(url, baseUrl, tmpDir) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 3,
            validateStatus: status => status >= 200 && status < 400,
            responseType: 'arraybuffer'
        });

        const contentType = response.headers['content-type'] || '';
        const extMap = {
            'text/css': '.css',
            'application/javascript': '.js',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'font/woff': '.woff',
            'font/woff2': '.woff2',
            'application/font-woff': '.woff',
            'application/font-woff2': '.woff2'
        };

        let ext = extMap[contentType] || path.extname(url) || '.bin';
        if (!ext || ext === '.bin') {
            const parsed = new URL(url);
            ext = path.extname(parsed.pathname) || '.bin';
        }

        const hash = Buffer.from(url).toString('base64').slice(0, 10).replace(/[/+=]/g, '_');
        const fileName = `asset_${hash}${ext}`;
        const filePath = path.join(tmpDir, fileName);
        fs.writeFileSync(filePath, response.data);

        return {
            original: url,
            saved: fileName,
            type: getMimeType(contentType),
            size: response.data.length
        };
    } catch (error) {
        console.log(`⚠️ Failed to download asset: ${url} - ${error.message}`);
        return null;
    }
}

function extractAssetUrls(html, baseUrl) {
    const urls = [];
    const patterns = [
        /href=["']([^"']*\.css[^"']*)["']/gi,
        /src=["']([^"']*\.js[^"']*)["']/gi,
        /src=["']([^"']*\.(?:png|jpg|jpeg|gif|webp|svg)[^"']*)["']/gi,
        /url\(["']?([^"')]*)["']?\)/gi,
        /@import\s+["']([^"']*)["']/gi
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const assetUrl = match[1].trim();
            if (assetUrl && !assetUrl.startsWith('data:') && !assetUrl.startsWith('#')) {
                try {
                    const fullUrl = new URL(assetUrl, baseUrl).href;
                    if (fullUrl.startsWith('http') || fullUrl.startsWith('/')) {
                        urls.push(fullUrl);
                    }
                } catch {
                    // Ignore invalid URLs
                }
            }
        }
    }
    return [...new Set(urls)].slice(0, 50);
}

// ===============================
// 📦 MAIN COMMAND
// ===============================
async function fetchCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🌐');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🌐 *FETCH WEBSITE* 〕━━━┈⊷
┃ ❍ Usage : .fetch [URL]
┃ ❍ Example : .fetch https://example.com
┃ ❍ Example : .fetch https://google.com
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        if (!isValidUrl(url)) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *INVALID URL* 〕━━━┈⊷
┃ ❍ URL must be http:// or https://
┃ ❍ Private/local IPs are blocked
┃ ❍ Example : https://example.com
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        const timestamp = Date.now();
        const tmpDir = path.join(process.cwd(), 'temp', `fetch_${timestamp}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        // ===============================
        // 📡 FETCH MAIN HTML
        // ===============================
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5,
            validateStatus: status => status >= 200 && status < 400,
            maxContentLength: 10 * 1024 * 1024 // 10MB limit
        });

        const html = cleanHTML(response.data);
        const contentType = response.headers['content-type'] || '';
        const statusCode = response.status;

        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
            await addReaction(sock, message, '❌');
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NOT HTML* 〕━━━┈⊷
┃ ❍ Content-Type: ${contentType}
┃ ❍ Status: ${statusCode}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // Save main HTML
        const { name, ext } = getSafeFileName(url);
        const htmlFileName = `${name}${ext}`;
        const htmlPath = path.join(tmpDir, htmlFileName);
        fs.writeFileSync(htmlPath, html, 'utf8');

        // ===============================
        // 🖼️ DOWNLOAD ASSETS
        // ===============================
        const baseUrl = new URL(url).origin;
        const assetUrls = extractAssetUrls(html, baseUrl);
        let downloadedAssets = 0;

        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 🔄 *FETCHING ASSETS* 〕━━━┈⊷
┃ ❍ Found : ${assetUrls.length} assets
┃ ❍ Downloading...
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });

        const assetPromises = assetUrls.map(assetUrl => downloadAsset(assetUrl, baseUrl, tmpDir));
        const results = await Promise.allSettled(assetPromises);
        const successfulAssets = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

        // ===============================
        // 📦 CREATE ZIP
        // ===============================
        const zipFileName = `${name}_${timestamp}.zip`;
        const zipPath = path.join(process.cwd(), 'temp', zipFileName);

        const output = fs.createWriteStream(zipPath);
        // Load only when the archive command is used; archiver remains a
        // declared production dependency in package.json.
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(tmpDir, false);
            archive.finalize();
        });

        const stats = fs.statSync(zipPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const sizeKB = (stats.size / 1024).toFixed(2);
        const sizeDisplay = stats.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

        // ===============================
        // 📤 SEND ZIP
        // ===============================
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ✅ *FETCH COMPLETE* 〕━━━┈⊷
┃ 🌐 ${new URL(url).hostname}
┃ 📄 ${htmlFileName}
┃ 📊 ${sizeDisplay}
┃ 🖼️ ${successfulAssets.length} assets
┃ 📁 ${assetUrls.length} total found
┃ ⚡ Status: ${statusCode}
╰━━━━━━━━━━━━━━━━┈⊷

📥 Sending ZIP file...

> By; MUZAMIL-XD`
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            document: fs.readFileSync(zipPath),
            mimetype: 'application/zip',
            fileName: zipFileName,
            caption: `
╭━━━〔 📥 *SOURCE PACKAGE* 〕━━━┈⊷
┃ 🌐 ${new URL(url).hostname}
┃ 📄 ${htmlFileName}
┃ 📊 ${sizeDisplay}
┃ 🖼️ ${successfulAssets.length} assets
┃ 📁 ZIP Archive
╰━━━━━━━━━━━━━━━━┈⊷

💡 Extract and open ${htmlFileName}

> By; MUZAMIL-XD`
        }, { quoted: message });

        await addReaction(sock, message, '✅');

        // ===============================
        // 🧹 CLEANUP
        // ===============================
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            fs.unlinkSync(zipPath);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

    } catch (error) {
        console.error('Fetch command error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Something went wrong';
        if (error.code === 'ECONNABORTED') errorMsg = 'Request timeout.';
        else if (error.response?.status === 404) errorMsg = 'Website not found (404).';
        else if (error.response?.status === 403) errorMsg = 'Access forbidden (403).';
        else if (error.response?.status === 500) errorMsg = 'Server error (500).';
        else if (error.code === 'ENOTFOUND') errorMsg = 'Domain not found.';
        else if (error.message.includes('maxContentLength')) errorMsg = 'Website too large (max 10MB).';

        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *FETCH FAILED* 〕━━━┈⊷
┃ ❍ ${errorMsg}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });
    }
}

module.exports = fetchCommand;
