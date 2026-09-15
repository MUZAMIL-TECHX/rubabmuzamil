const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// ===============================
// 🔧 HELPER: ADD REACTION
// ===============================
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

async function resolveHostname(hostname) {
    try {
        const addresses = await dns.resolve4(hostname);
        return addresses;
    } catch {
        try {
            const addresses = await dns.resolve6(hostname);
            return addresses;
        } catch {
            return [];
        }
    }
}

async function isSafeUrl(url) {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        if (isPrivateIP(parsed.hostname)) return false;
        
        const ips = await resolveHostname(parsed.hostname);
        for (const ip of ips) {
            if (isPrivateIP(ip)) return false;
        }
        return true;
    } catch {
        return false;
    }
}

// ===============================
// 📁 FILE HELPERS
// ===============================
function getSafeFileName(url, mimeType = '') {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname;
        let basename = path.basename(pathname) || 'index';
        let ext = path.extname(basename);
        const name = basename.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_') || 'page';
        
        if (mimeType.includes('text/html')) ext = '.html';
        else if (mimeType.includes('application/json')) ext = '.json';
        else if (mimeType.includes('text/xml')) ext = '.xml';
        else if (mimeType.includes('text/css')) ext = '.css';
        else if (mimeType.includes('javascript')) ext = '.js';
        else if (!ext) ext = '.html';
        
        return { name, ext };
    } catch {
        return { name: 'page', ext: '.html' };
    }
}

function cleanHTML(html) {
    return html.replace(/\n\s*\n/g, '\n').replace(/\t/g, '  ');
}

// ===============================
// 🌐 DOWNLOAD ASSETS
// ===============================
const ASSET_SIZE_LIMIT = 5 * 1024 * 1024;

async function downloadAsset(url, baseUrl, tmpDir, assetMap) {
    try {
        if (!await isSafeUrl(url)) {
            console.log(`⚠️ Blocked unsafe asset: ${url}`);
            return null;
        }

        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 3,
            validateStatus: status => status >= 200 && status < 400,
            responseType: 'arraybuffer',
            maxContentLength: ASSET_SIZE_LIMIT
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
            'font/woff2': '.woff2'
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

        assetMap.set(url, fileName);

        return {
            original: url,
            saved: fileName,
            type: contentType.split('/')[0] || 'unknown',
            size: response.data.length
        };
    } catch (error) {
        console.log(`⚠️ Failed: ${url} - ${error.message}`);
        return null;
    }
}

// ===============================
// 🔗 EXTRACT ASSET URLs (CSS + JS + Images)
// ===============================
function extractAssetUrls(html, baseUrl) {
    const urls = [];
    const patterns = [
        /(?:href|src)=["']([^"']*\.(?:css|js|png|jpg|jpeg|gif|webp|svg|woff|woff2)[^"']*)["']/gi,
        /url\(["']?([^"')]*\.(?:css|js|png|jpg|jpeg|gif|webp|svg|woff|woff2)[^"')]*)["']?\)/gi,
        /@import\s+["']([^"']*\.css[^"']*)["']/gi
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
    return [...new Set(urls)];
}

// ===============================
// 🔄 RELINK HTML (SAFE PARSER)
// ===============================
function relinkHTML(html, assetMap) {
    let updatedHtml = html;
    
    for (const [originalUrl, localFile] of assetMap) {
        const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Replace full URL
        const fullRegex = new RegExp(escapedUrl, 'g');
        updatedHtml = updatedHtml.replace(fullRegex, localFile);
        
        // Replace relative path (safer - only replace in src/href)
        try {
            const urlObj = new URL(originalUrl);
            const relativePath = urlObj.pathname;
            if (relativePath && relativePath.length > 1) {
                // Only replace if it appears as src/href value
                const attrRegex = new RegExp(`(src|href)=["']([^"']*${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})["']`, 'gi');
                updatedHtml = updatedHtml.replace(attrRegex, `$1="$2"`.replace(relativePath, localFile));
            }
        } catch (e) {
            // Skip if URL parsing fails
        }
    }
    
    return updatedHtml;
}

// ===============================
// ⏱️ CONCURRENCY CONTROL
// ===============================
async function runWithConcurrency(tasks, concurrency = 5) {
    const results = [];
    const executing = [];
    
    for (const task of tasks) {
        const p = task().then(result => {
            executing.splice(executing.indexOf(p), 1);
            return result;
        });
        results.push(p);
        executing.push(p);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}

// ===============================
// 📦 MAIN COMMAND
// ===============================
async function fetchapiCommand(sock, chatId, message) {
    let tmpDir = null;
    let zipPath = null;
    
    try {
        await addReaction(sock, message, '🌐');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🌐 *FETCH API* 〕━━━┈⊷
┃ ❍ Usage : .fetchapi [URL]
┃ ❍ Example : .fetchapi https://example.com
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        if (!await isSafeUrl(url)) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *BLOCKED* 〕━━━┈⊷
┃ ❍ URL is blocked or unsafe
┃ ❍ Private/local IPs not allowed
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        const timestamp = Date.now();
        tmpDir = path.join(process.cwd(), 'temp', `fetchapi_${timestamp}`);
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
            maxContentLength: 10 * 1024 * 1024
        });

        const html = cleanHTML(response.data);
        const contentType = response.headers['content-type'] || '';
        const statusCode = response.status;

        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NOT HTML* 〕━━━┈⊷
┃ ❍ Content-Type: ${contentType}
┃ ❍ Status: ${statusCode}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const { name, ext } = getSafeFileName(url, contentType);
        const htmlFileName = `${name}${ext}`;
        const htmlPath = path.join(tmpDir, htmlFileName);

        // ===============================
        // 🖼️ EXTRACT & DOWNLOAD ASSETS
        // ===============================
        const baseUrl = url;
        const assetUrls = extractAssetUrls(html, baseUrl);
        const assetMap = new Map();

        if (assetUrls.length > 0) {
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🔄 *FETCHING ASSETS* 〕━━━┈⊷
┃ ❍ Found : ${assetUrls.length} assets
┃ ❍ Downloading (5 at a time)...
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });

            const tasks = assetUrls.map(assetUrl => 
                () => downloadAsset(assetUrl, baseUrl, tmpDir, assetMap)
            );
            
            await runWithConcurrency(tasks, 5);
        }

        // ===============================
        // 🔗 RELINK HTML
        // ===============================
        const relinkedHtml = relinkHTML(html, assetMap);
        fs.writeFileSync(htmlPath, relinkedHtml, 'utf8');

        const successfulAssets = assetMap.size;

        // ===============================
        // 📦 CREATE ZIP
        // ===============================
        const zipFileName = `${name}_${timestamp}.zip`;
        zipPath = path.join(process.cwd(), 'temp', zipFileName);

        const output = fs.createWriteStream(zipPath);
        // Load only when the archive command is used so the bot can still boot
        // if a deployment has stale dependencies; archiver is declared in
        // package.json and will be installed on a clean Railway build.
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

        // ✅ ZIP size limit (50MB)
        if (stats.size > 50 * 1024 * 1024) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *TOO LARGE* 〕━━━┈⊷
┃ ❍ ZIP size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB
┃ ❍ Max allowed: 50 MB
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const sizeKB = (stats.size / 1024).toFixed(2);
        const sizeDisplay = stats.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        const domain = new URL(url).hostname;

        // ===============================
        // 📤 SEND ZIP
        // ===============================
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ✅ *FETCH COMPLETE* 〕━━━┈⊷
┃ 🌐 ${domain}
┃ 📄 ${htmlFileName}
┃ 📊 ${sizeDisplay}
┃ 🖼️ ${successfulAssets} assets
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
┃ 🌐 ${domain}
┃ 📄 ${htmlFileName}
┃ 📊 ${sizeDisplay}
┃ 🖼️ ${successfulAssets} assets
┃ 📁 ZIP Archive
╰━━━━━━━━━━━━━━━━┈⊷

💡 Extract and open ${htmlFileName}

> By; MUZAMIL-XD`
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('FetchAPI command error:', error);
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

    } finally {
        // ===============================
        // 🧹 CLEANUP (ALWAYS)
        // ===============================
        try {
            if (tmpDir && fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            if (zipPath && fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }
    }
}

module.exports = fetchapiCommand;
