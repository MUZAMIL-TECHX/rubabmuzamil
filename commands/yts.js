const axios = require('axios');
const yts = require('yt-search');

// ═══════════════════════════════════════════════════════════
//                    ⚙️ CONFIG
// ═══════════════════════════════════════════════════════════
const CONFIG = {
    MAX_RESULTS: 8,
    SEARCH_EXPIRY_MS: 5 * 60 * 1000,
    MAX_FILE_MB: 90,
    CLEANUP_INTERVAL_MS: 60 * 1000
};

const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev/?url=';

// ═══════════════════════════════════════════════════════════
//                    📦 STORAGE
// ═══════════════════════════════════════════════════════════
const activeSearches = new Map();
const pendingFormat = new Map();
const pendingQuality = new Map();
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
//                    🧹 CLEANUP
// ═══════════════════════════════════════════════════════════
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of activeSearches) {
        if (now - data.timestamp > CONFIG.SEARCH_EXPIRY_MS) activeSearches.delete(id);
    }
    for (const [id, data] of pendingFormat) {
        if (now - data.timestamp > CONFIG.SEARCH_EXPIRY_MS) pendingFormat.delete(id);
    }
    for (const [id, data] of pendingQuality) {
        if (now - data.timestamp > CONFIG.SEARCH_EXPIRY_MS) pendingQuality.delete(id);
    }
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

async function getRemoteFileSizeMB(url) {
    try {
        const res = await axios.head(url, { timeout: 15000 });
        const len = res.headers['content-length'];
        if (!len) return null;
        return (parseInt(len, 10) / (1024 * 1024)).toFixed(1);
    } catch {
        return null;
    }
}

function safeFileName(value, fallback) {
    return String(value || fallback)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 90) || fallback;
}

// ═══════════════════════════════════════════════════════════
//                    📥 BUFFER DOWNLOAD
// ═══════════════════════════════════════════════════════════
async function downloadBuffer(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        decompress: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity'
        }
    });
    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length === 0) throw new Error('Empty buffer');
    return buffer;
}

// ═══════════════════════════════════════════════════════════
//                    🎬 HECTOR API
// ═══════════════════════════════════════════════════════════
async function getHectorData(youtubeUrl) {
    const apiUrl = `${HECTOR_API}${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.data.status) {
        throw new Error('Hector API failed');
    }
    return {
        title: response.data.title || 'Video',
        thumbnail: response.data.thumbnail,
        audio: response.data.audio,
        videos: response.data.videos,
        qualities: response.data.available_qualities || []
    };
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
        console.error('YTS error:', error);
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

        // ═══════════════════════════════════════
        // STEP 3: Quality Selection
        // ═══════════════════════════════════════
        if (pendingQuality.has(quotedMsgId)) {
            const pending = pendingQuality.get(quotedMsgId);
            if (sender !== pending.sender) return false;

            const quality = text.replace(/p$/i, '').trim();
            if (!pending.qualities.includes(quality) || !pending.data.videos?.[quality]) {
                await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ǫᴜᴀʟɪᴛʏ', [
                        `🎬 ᴀᴠᴀɪʟᴀʙʟᴇ : ${pending.qualities.join(', ')}`,
                        '💡 ʀᴇᴘʟʏ ᴡɪᴛʜ ᴏɴᴇ ᴏꜰ ᴛʜᴇsᴇ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            if (processing.has(sender)) {
                await sock.sendMessage(chatId, {
                    text: box('⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ', ['🔄 ᴘʀᴇᴠɪᴏᴜs ᴅᴏᴡɴʟᴏᴀᴅ ɪɴ ᴘʀᴏɢʀᴇss']),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            pendingQuality.delete(quotedMsgId);
            processing.add(sender);
            try {
                await downloadAndSend(sock, chatId, message, pending.video, 'video', quality, pending.data);
            } finally {
                processing.delete(sender);
            }
            return true;
        }

        // ═══════════════════════════════════════
        // STEP 2: Format Selection (1 = Video, 2 = Audio)
        // ═══════════════════════════════════════
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
                    text: box('⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ', ['🔄 ᴘʀᴇᴠɪᴏᴜs ᴅᴏᴡɴʟᴏᴀᴅ ɪɴ ᴘʀᴏɢʀᴇss']),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            pendingFormat.delete(quotedMsgId);
            processing.add(sender);
            try {
                // ✅ Fetch Hector data
                console.log(`🎬 Fetching Hector for: ${pending.video.url}`);
                const hectorData = await getHectorData(pending.video.url);

                if (choice === 'audio') {
                    // 🎵 Download audio directly
                    await downloadAndSend(sock, chatId, message, pending.video, 'audio', null, hectorData);
                } else {
                    // 🎬 Ask for quality
                    const qualities = (hectorData.qualities || [])
                        .map(String)
                        .filter(q => q !== 'mp3');

                    if (!qualities.length) throw new Error('No video qualities available');

                    const qualityPrompt = await sock.sendMessage(chatId, {
                        text: box('🎬 ᴄʜᴏᴏsᴇ ǫᴜᴀʟɪᴛʏ', [
                            `📌 ${trim(hectorData.title || pending.video.title, 42)}`,
                            `📺 ᴀᴠᴀɪʟᴀʙʟᴇ : ${qualities.join(', ')}`,
                            '💡 ʀᴇᴘʟʏ ᴡɪᴛʜ ǫᴜᴀʟɪᴛʏ (ᴇx: 360)'
                        ]),
                        ...channelInfo
                    }, { quoted: message });

                    pendingQuality.set(qualityPrompt.key.id, {
                        video: pending.video,
                        data: hectorData,
                        qualities,
                        chatId,
                        sender,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error('Format error:', error);
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                        trim(error.message || 'API unavailable', 120),
                        '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            } finally {
                processing.delete(sender);
            }
            return true;
        }

        // ═══════════════════════════════════════
        // STEP 1: Number Selection
        // ═══════════════════════════════════════
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
        console.error('Reply error:', error);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
//                    📥 DOWNLOAD + SEND
// ═══════════════════════════════════════════════════════════
async function downloadAndSend(sock, chatId, message, video, type, quality, hectorData) {
    const data = hectorData || await getHectorData(video.url);
    const videoTitle = data.title || video.title || (type === 'audio' ? 'Audio' : 'Video');

    // Get URL
    const mediaUrl = type === 'audio' 
        ? data.audio 
        : data.videos?.[quality];

    if (!mediaUrl) {
        throw new Error(`${type === 'audio' ? 'MP3' : quality + 'p'} link not found`);
    }

    // 📥 Downloading
    await addReaction(sock, message, '📥');
    await sock.sendMessage(chatId, {
        text: box('📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ', [
            `📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 32)}`,
            `🎬 ꜰᴏʀᴍᴀᴛ : ${type === 'audio' ? 'MP3' : `MP4 (${quality}p)`}`,
            '⏳ sᴛᴀᴛᴜs : ᴘʀᴏᴄᴇssɪɴɢ...'
        ]),
        ...channelInfo
    }, { quoted: message });

    // Size check
    const sizeMB = await getRemoteFileSizeMB(mediaUrl);
    if (sizeMB && parseFloat(sizeMB) > CONFIG.MAX_FILE_MB) {
        await addReaction(sock, message, '⚠️');
        await sock.sendMessage(chatId, {
            text: box('⚠️ ꜰɪʟᴇ ᴛᴏᴏ ʟᴀʀɢᴇ', [
                `📏 sɪᴢᴇ : ${sizeMB} MB`,
                `⚠️ ʟɪᴍɪᴛ : ${CONFIG.MAX_FILE_MB} MB`,
                '💡 ᴛʀʏ sʜᴏʀᴛᴇʀ ᴠɪᴅᴇᴏ ᴏʀ ᴀᴜᴅɪᴏ'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const safeName = safeFileName(videoTitle, type === 'audio' ? 'audio' : 'video');
    const fileName = `${safeName}.${type === 'audio' ? 'mp3' : 'mp4'}`;

    // Download buffer
    let buffer;
    try {
        buffer = await downloadBuffer(mediaUrl);
    } catch (bufferError) {
        console.error('Buffer failed, trying URL:', bufferError.message);
        
        // Fallback URL
        const payload = type === 'audio'
            ? { audio: { url: mediaUrl }, mimetype: 'audio/mpeg', fileName, ptt: false, ...channelInfo }
            : { video: { url: mediaUrl }, mimetype: 'video/mp4', fileName, caption: box('✅ ʀᴇᴀᴅʏ', [
                `📌 ${trim(videoTitle, 30)}`,
                `📺 ${type === 'audio' ? 'MP3' : quality + 'p'}`,
                '✅ ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
            ]), ...channelInfo };

        await sock.sendMessage(chatId, payload, { quoted: message });
        await addReaction(sock, message, '✅');
        return;
    }

    // Send buffer
    const payload = type === 'audio'
        ? { audio: buffer, mimetype: 'audio/mpeg', fileName, ptt: false, ...channelInfo }
        : { video: buffer, mimetype: 'video/mp4', fileName, caption: box('✅ ᴠɪᴅᴇᴏ ʀᴇᴀᴅʏ', [
            `📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 30)}`,
            `📏 sɪᴢᴇ : ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
            `📺 ǫᴜᴀʟɪᴛʏ : ${quality}p`,
            '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
        ]), ...channelInfo };

    await sock.sendMessage(chatId, payload, { quoted: message });

    await addReaction(sock, message, '✅');
    console.log(`✅ Sent: ${videoTitle}`);
}

// ═══════════════════════════════════════════════════════════
//                    📤 EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
    ytsCommand,
    processYtsReply
};
