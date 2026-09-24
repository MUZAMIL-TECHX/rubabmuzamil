const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
//                    ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════
const CONFIG = {
    MAX_RESULTS: 8,
    SEARCH_EXPIRY_MS: 5 * 60 * 1000,
    MAX_FILE_MB: 90,
    API_TIMEOUT: 60000,
    DOWNLOAD_TIMEOUT: 180000,
    CLEANUP_INTERVAL_MS: 60 * 1000
};

// ═══════════════════════════════════════════════════════════
//                    📦 STORAGE
// ═══════════════════════════════════════════════════════════
const activeSearches = new Map();
const pendingFormat = new Map();
const processing = new Set();

// ═══════════════════════════════════════════════════════════
//                    🎯 CHANNEL INFO
// ═══════════════════════════════════════════════════════════
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363426106687970@newsletter',
            newsletterName: '𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋',
            serverMessageId: -1
        }
    }
};

// ═══════════════════════════════════════════════════════════
//                    🧹 PERIODIC CLEANUP
// ═══════════════════════════════════════════════════════════
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, data] of activeSearches) {
        if (now - data.timestamp > CONFIG.SEARCH_EXPIRY_MS) {
            activeSearches.delete(id);
            cleaned++;
        }
    }
    for (const [id, data] of pendingFormat) {
        if (now - data.timestamp > CONFIG.SEARCH_EXPIRY_MS) {
            pendingFormat.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired entries`);
}, CONFIG.CLEANUP_INTERVAL_MS);

// ═══════════════════════════════════════════════════════════
//                    🛠️ HELPERS
// ═══════════════════════════════════════════════════════════
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (err) {
        console.error('Reaction error:', err.message);
    }
}

function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

function trim(str, n) {
    if (!str) return 'Unknown';
    return str.length > n ? str.slice(0, n) + '...' : str;
}

function parseStrictInt(text) {
    if (!/^\d+$/.test(text)) return null;
    return Number(text);
}

function safeFileName(value, fallback) {
    return String(value || fallback)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 90) || fallback;
}

// ═══════════════════════════════════════════════════════════
//                    📥 BUFFER DOWNLOAD (ZERO-ERROR)
// ═══════════════════════════════════════════════════════════
async function downloadMediaBuffer(url) {
    console.log(`📥 [Download] Fetching: ${url.substring(0, 80)}...`);

    let buffer = null;
    let lastError = null;

    // ✅ TRY 1: Arraybuffer mode
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: CONFIG.DOWNLOAD_TIMEOUT,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'audio/mpeg,audio/*,video/*,*/*;q=0.8',
                'Accept-Encoding': 'identity',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        buffer = Buffer.from(response.data);
        if (buffer && buffer.length > 0) {
            console.log(`✅ [Download] Arraybuffer success: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
            return buffer;
        }
    } catch (err1) {
        console.log(`⚠️ [Download] Arraybuffer failed: ${err1.message}`);
        lastError = err1;
    }

    // ✅ TRY 2: Stream mode
    try {
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: CONFIG.DOWNLOAD_TIMEOUT,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'identity'
            }
        });

        const chunks = [];
        await new Promise((resolve, reject) => {
            response.data.on('data', chunk => chunks.push(chunk));
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });

        buffer = Buffer.concat(chunks);
        if (buffer && buffer.length > 0) {
            console.log(`✅ [Download] Stream success: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
            return buffer;
        }
    } catch (err2) {
        console.log(`⚠️ [Download] Stream failed: ${err2.message}`);
        lastError = err2;
    }

    // ✅ TRY 3: Plain fetch fallback
    try {
        const response = await axios.get(url, {
            timeout: CONFIG.DOWNLOAD_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        buffer = Buffer.from(response.data);
        if (buffer && buffer.length > 0) {
            console.log(`✅ [Download] Plain fetch success`);
            return buffer;
        }
    } catch (err3) {
        console.log(`⚠️ [Download] Plain fetch failed: ${err3.message}`);
        lastError = err3;
    }

    throw lastError || new Error('All download methods failed');
}

// ═══════════════════════════════════════════════════════════
//                    🌐 VIDEO APIs
// ═══════════════════════════════════════════════════════════
async function getArslanVideo(url) {
    try {
        const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, { timeout: CONFIG.API_TIMEOUT });
        if (res?.data?.status && res?.data?.result?.download?.url) {
            return { download: res.data.result.download.url, title: res.data.result.metadata?.title || 'Video' };
        }
        throw new Error('Invalid response');
    } catch (err) {
        console.log('❌ [Arslan Video]', err.message);
        throw err;
    }
}

async function getEliteProTechVideo(url) {
    try {
        const api = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`;
        const res = await axios.get(api, {
            timeout: CONFIG.API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res?.data?.success && res?.data?.downloadURL) {
            return { download: res.data.downloadURL, title: res.data.title || 'Video' };
        }
        throw new Error('Invalid response');
    } catch (err) {
        console.log('❌ [EliteProTech Video]', err.message);
        throw err;
    }
}

async function getYupraVideo(url) {
    try {
        const api = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, {
            timeout: CONFIG.API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res?.data?.success && res?.data?.data?.download_url) {
            return { download: res.data.data.download_url, title: res.data.data.title || 'Video' };
        }
        throw new Error('Invalid response');
    } catch (err) {
        console.log('❌ [Yupra Video]', err.message);
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════
//                    🎵 AUDIO APIs
// ═══════════════════════════════════════════════════════════
async function getArslanAudio(url) {
    try {
        const api = `https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`;
        console.log('🎵 [Arslan Audio] Requesting API...');
        
        const res = await axios.get(api, { 
            timeout: CONFIG.API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (res?.data?.status === true && res?.data?.result?.download?.url) {
            const downloadUrl = res.data.result.download.url;
            const title = res.data.result.metadata?.title || 'Audio';
            
            // ✅ Validate URL
            if (!downloadUrl.startsWith('http')) {
                throw new Error('Invalid download URL format');
            }
            
            console.log(`✅ [Arslan Audio] URL found: ${downloadUrl.substring(0, 80)}`);
            return { download: downloadUrl, title };
        }
        throw new Error('No download URL in response');
    } catch (err) {
        console.log(`❌ [Arslan Audio] ${err.message}`);
        throw err;
    }
}

async function getYupraAudio(url) {
    try {
        const api = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;
        console.log('🎵 [Yupra Audio] Requesting API...');
        
        const res = await axios.get(api, {
            timeout: CONFIG.API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (res?.data?.success && res?.data?.data?.download_url) {
            console.log(`✅ [Yupra Audio] URL found`);
            return { download: res.data.data.download_url, title: res.data.data.title || 'Audio' };
        }
        throw new Error('No download URL in response');
    } catch (err) {
        console.log(`❌ [Yupra Audio] ${err.message}`);
        throw err;
    }
}

async function getOkatsuAudio(url) {
    try {
        const api = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`;
        console.log('🎵 [Okatsu Audio] Requesting API...');
        
        const res = await axios.get(api, {
            timeout: CONFIG.API_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (res?.data?.dl) {
            console.log(`✅ [Okatsu Audio] URL found`);
            return { download: res.data.dl, title: res.data.title || 'Audio' };
        }
        throw new Error('No download URL in response');
    } catch (err) {
        console.log(`❌ [Okatsu Audio] ${err.message}`);
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════
//                    🔄 FALLBACK RUNNERS
// ═══════════════════════════════════════════════════════════
async function tryDownloadApis(url, type = 'video') {
    const videoApis = [
        { name: 'Arslan', fn: () => getArslanVideo(url) },
        { name: 'EliteProTech', fn: () => getEliteProTechVideo(url) },
        { name: 'Yupra', fn: () => getYupraVideo(url) }
    ];
    const audioApis = [
        { name: 'Arslan', fn: () => getArslanAudio(url) },
        { name: 'Yupra', fn: () => getYupraAudio(url) },
        { name: 'Okatsu', fn: () => getOkatsuAudio(url) }
    ];

    const apis = type === 'audio' ? audioApis : videoApis;

    for (const api of apis) {
        try {
            console.log(`🔄 Trying ${api.name}...`);
            const data = await api.fn();
            if (data?.download) {
                console.log(`✅ ${api.name} SUCCESS`);
                return data;
            }
        } catch (err) {
            console.log(`❌ ${api.name} FAILED: ${err.message}`);
        }
    }
    console.log('❌ ALL APIs FAILED');
    return null;
}

// ═══════════════════════════════════════════════════════════
//                    📤 SEND MEDIA (ZERO-ERROR)
// ═══════════════════════════════════════════════════════════
async function sendMediaSafe(sock, chatId, type, url, opts, quotedMsg) {
    console.log(`📤 [sendMediaSafe] Type: ${type}`);

    // ═══════════════════════════════════════════
    // TRY 1: Buffer download + Send
    // ═══════════════════════════════════════════
    try {
        const buffer = await downloadMediaBuffer(url);
        
        if (!buffer || buffer.length === 0) {
            throw new Error('Empty buffer');
        }

        const payload = type === 'audio'
            ? {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: opts.fileName,
                ptt: false,
                ...channelInfo
            }
            : {
                video: buffer,
                mimetype: 'video/mp4',
                fileName: opts.fileName,
                caption: opts.caption,
                ...channelInfo
            };

        await sock.sendMessage(chatId, payload, { quoted: quotedMsg });
        console.log('✅ [sendMediaSafe] Buffer send SUCCESS');
        return true;
    } catch (bufferError) {
        console.log(`⚠️ [sendMediaSafe] Buffer failed: ${bufferError.message}`);
    }

    // ═══════════════════════════════════════════
    // TRY 2: Direct URL (Baileys auto-fetch)
    // ═══════════════════════════════════════════
    try {
        const payload = type === 'audio'
            ? {
                audio: { url },
                mimetype: 'audio/mpeg',
                fileName: opts.fileName,
                ptt: false,
                ...channelInfo
            }
            : {
                video: { url },
                mimetype: 'video/mp4',
                fileName: opts.fileName,
                caption: opts.caption,
                ...channelInfo
            };

        await sock.sendMessage(chatId, payload, { quoted: quotedMsg });
        console.log('✅ [sendMediaSafe] Direct URL send SUCCESS');
        return true;
    } catch (urlError) {
        console.log(`⚠️ [sendMediaSafe] Direct URL failed: ${urlError.message}`);
    }

    // ═══════════════════════════════════════════
    // TRY 3: Send as document (last resort)
    // ═══════════════════════════════════════════
    try {
        const buffer = await downloadMediaBuffer(url);
        if (!buffer || buffer.length === 0) throw new Error('Empty buffer');

        await sock.sendMessage(chatId, {
            document: buffer,
            mimetype: type === 'audio' ? 'audio/mpeg' : 'video/mp4',
            fileName: opts.fileName,
            ...channelInfo
        }, { quoted: quotedMsg });
        console.log('✅ [sendMediaSafe] Document send SUCCESS');
        return true;
    } catch (docError) {
        console.log(`❌ [sendMediaSafe] Document failed: ${docError.message}`);
    }

    return false;
}

// ═══════════════════════════════════════════════════════════
//                    🔍 MAIN SEARCH COMMAND
// ═══════════════════════════════════════════════════════════
async function ytsCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🔍');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('🔍 ʏᴛs sᴇᴀʀᴄʜ', [
                    '📌 ᴜsᴀɢᴇ : .ʏᴛs [sᴏɴɢ/ɴᴀᴍᴇ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ʏᴛs ᴀᴛɪꜰ ᴀsʟᴀᴍ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ʀᴇsᴜʟᴛs', [
                    `🔍 ɴᴏ ᴠɪᴅᴇᴏs ꜰᴏᴜɴᴅ ꜰᴏʀ : ${searchQuery}`,
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const topVideos = videos.slice(0, CONFIG.MAX_RESULTS);

        let resultText = box('🔍 sᴇᴀʀᴄʜ ʀᴇsᴜʟᴛs', [
            `📊 ǫᴜᴇʀʏ : ${searchQuery}`,
            `🎬 ꜰᴏᴜɴᴅ : ${topVideos.length} ᴠɪᴅᴇᴏs`
        ]) + '\n\n';

        topVideos.forEach((v, i) => {
            resultText += `╭┈──〔 🎬 #${i + 1} 〕┈──⊷\n`;
            resultText += `┋⋄ ➠ 📌 ${trim(v.title, 45)}\n`;
            resultText += `┋⋄ ➠ ⏱ ${v.timestamp || 'Unknown'}\n`;
            resultText += `┋⋄ ➠ 👁 ${v.views ? v.views.toLocaleString() : '?'}\n`;
            resultText += `┋⋄ ➠ 📺 ${trim(v.author?.name, 22)}\n`;
            resultText += `╰─────────────────────⊷\n\n`;
        });

        resultText += `💡 *ʀᴇᴘʟʏ* ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ (1-${topVideos.length}) ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ.\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

        const sent = await sock.sendMessage(chatId, { text: resultText, ...channelInfo }, { quoted: message });

        activeSearches.set(sent.key.id, {
            videos: topVideos,
            chatId,
            sender: message.key.participant || message.key.remoteJid,
            timestamp: Date.now()
        });

        await addReaction(sock, message, '✅');
    } catch (error) {
        console.error('YTS command error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${error.message || 'Something went wrong'}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

// ═══════════════════════════════════════════════════════════
//                    📩 HANDLE REPLIES
// ═══════════════════════════════════════════════════════════
async function processYtsReply(sock, chatId, message) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quotedMsgId || !text) return false;

        const sender = message.key.participant || message.key.remoteJid;

        // STEP 2: Format choice
        if (pendingFormat.has(quotedMsgId)) {
            const pending = pendingFormat.get(quotedMsgId);
            if (sender !== pending.sender) return false;

            const num = parseStrictInt(text);
            const choice = num === 2 ? 'audio' : num === 1 ? 'video' : null;
            if (!choice) {
                await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ᴄʜᴏɪᴄᴇ', [
                        '1️⃣ ʀᴇᴘʟʏ 1 ꜰᴏʀ ᴠɪᴅᴇᴏ',
                        '2️⃣ ʀᴇᴘʟʏ 2 ꜰᴏʀ ᴀᴜᴅɪᴏ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            if (processing.has(sender)) {
                await sock.sendMessage(chatId, {
                    text: box('⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ', [
                        '🔄 ᴘʀᴇᴠɪᴏᴜs ᴅᴏᴡɴʟᴏᴀᴅ ɪɴ ᴘʀᴏɢʀᴇss'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            pendingFormat.delete(quotedMsgId);
            processing.add(sender);
            try {
                await downloadAndSend(sock, chatId, message, pending.video, choice);
            } finally {
                processing.delete(sender);
            }
            return true;
        }

        // STEP 1: Number choice
        if (activeSearches.has(quotedMsgId)) {
            const num = parseStrictInt(text);
            if (num === null || num < 1) return false;

            const searchData = activeSearches.get(quotedMsgId);
            if (sender !== searchData.sender) {
                await sock.sendMessage(chatId, {
                    text: box('⛔ ɴᴏᴛ ʏᴏᴜʀ sᴇᴀʀᴄʜ', [
                        '🔍 ᴛʜɪs sᴇᴀʀᴄʜ ᴡᴀs ʀᴇǫᴜᴇsᴛᴇᴅ ʙʏ sᴏᴍᴇᴏɴᴇ ᴇʟsᴇ',
                        '💡 ᴘʟᴇᴀsᴇ ᴜsᴇ .ʏᴛs ʏᴏᴜʀsᴇʟꜰ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            if (num > searchData.videos.length) {
                await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ', [
                        `📊 ᴏɴʟʏ ${searchData.videos.length} ᴠɪᴅᴇᴏs ᴀᴠᴀɪʟᴀʙʟᴇ`,
                        `💡 ʀᴇᴘʟʏ ᴡɪᴛʜ 1 ᴛᴏ ${searchData.videos.length}`
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            const selectedVideo = searchData.videos[num - 1];
            activeSearches.delete(quotedMsgId);

            const askSent = await sock.sendMessage(chatId, {
                text: box('🎯 ᴄʜᴏᴏsᴇ ꜰᴏʀᴍᴀᴛ', [
                    `📌 ${trim(selectedVideo.title, 42)}`,
                    '',
                    '1️⃣  ʀᴇᴘʟʏ 1  →  ᴠɪᴅᴇᴏ (ᴍᴘ4)',
                    '2️⃣  ʀᴇᴘʟʏ 2  →  ᴀᴜᴅɪᴏ (ᴍᴘ3)'
                ]),
                ...channelInfo
            }, { quoted: message });

            pendingFormat.set(askSent.key.id, {
                video: selectedVideo,
                chatId,
                sender,
                timestamp: Date.now()
            });

            return true;
        }

        return false;
    } catch (error) {
        console.error('YTS reply processor error:', error);
        await addReaction(sock, message, '❌');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
//                    📥 DOWNLOAD + SEND
// ═══════════════════════════════════════════════════════════
async function downloadAndSend(sock, chatId, message, video, type) {
    const videoUrl = video.url;
    const videoTitle = video.title || (type === 'audio' ? 'Audio' : 'Video');

    await addReaction(sock, message, '📥');
    await sock.sendMessage(chatId, {
        text: box('📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ', [
            `📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 35)}`,
            `🎬 ꜰᴏʀᴍᴀᴛ : ${type === 'audio' ? 'MP3' : 'MP4'}`,
            '⏳ sᴛᴀᴛᴜs : ᴘʀᴏᴄᴇssɪɴɢ...'
        ]),
        ...channelInfo
    }, { quoted: message });

    const data = await tryDownloadApis(videoUrl, type);

    if (!data?.download) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                '🔴 ᴀʟʟ sᴏᴜʀᴄᴇs ꜰᴀɪʟᴇᴅ',
                '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ ᴏʀ ᴜsᴇ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴏɴɢ'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const safeName = safeFileName(videoTitle, type === 'audio' ? 'audio' : 'video');
    const fileName = `${safeName}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    const caption = box('✅ ʀᴇᴀᴅʏ', [
        `📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 30)}`,
        `🎬 ꜰᴏʀᴍᴀᴛ : ${type === 'audio' ? 'MP3' : 'MP4'}`,
        '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
    ]);

    const ok = await sendMediaSafe(sock, chatId, type, data.download, { fileName, caption }, message);

    if (!ok) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ sᴇɴᴅ ꜰᴀɪʟᴇᴅ', [
                '🔴 ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ ᴇxᴘɪʀᴇᴅ',
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    await addReaction(sock, message, '✅');
}

// ═══════════════════════════════════════════════════════════
//                    📤 EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
    ytsCommand,
    processYtsReply
};
