const axios = require('axios');
const yts = require('yt-search');

// ================= CONFIG =================
const MAX_RESULTS = 8;
const SEARCH_EXPIRY_MS = 5 * 60 * 1000;
const MAX_FILE_MB = 90;
const API_TIMEOUT = 60000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

// ================= STORAGE =================
const activeSearches = new Map();
const pendingFormat = new Map();
const processing = new Set();

// ================= CHANNEL INFO =================
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

// ================= PERIODIC CLEANUP =================
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of activeSearches) {
        if (now - data.timestamp > SEARCH_EXPIRY_MS) activeSearches.delete(id);
    }
    for (const [id, data] of pendingFormat) {
        if (now - data.timestamp > SEARCH_EXPIRY_MS) pendingFormat.delete(id);
    }
}, CLEANUP_INTERVAL_MS);

// ================= HELPERS =================
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

// ================= VIDEO APIs =================
async function getArslanVideo(url) {
    const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, { timeout: API_TIMEOUT });
    if (res?.data?.status && res?.data?.result?.download?.url) {
        return { download: res.data.result.download.url, title: res.data.result.metadata?.title || 'Video' };
    }
    throw new Error('Arslan API failed');
}

async function getEliteProTechVideo(url) {
    const api = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`;
    const res = await axios.get(api, {
        timeout: API_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title || 'Video' };
    }
    throw new Error('EliteProTech API failed');
}

async function getYupraVideo(url) {
    const api = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, {
        timeout: API_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title || 'Video' };
    }
    throw new Error('Yupra API failed');
}

// ================= AUDIO APIs =================
async function getArslanAudio(url) {
    const api = `https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, { timeout: API_TIMEOUT });
    if (res?.data?.status && res?.data?.result?.download?.url) {
        return { download: res.data.result.download.url, title: res.data.result.metadata?.title || 'Audio' };
    }
    throw new Error('Arslan Audio API failed');
}

async function getYupraAudio(url) {
    const api = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, {
        timeout: API_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title || 'Audio' };
    }
    throw new Error('Yupra Audio API failed');
}

// ================= FALLBACK RUNNERS =================
async function tryDownloadApis(url, type = 'video') {
    const videoApis = [
        { name: 'Arslan', fn: () => getArslanVideo(url) },
        { name: 'EliteProTech', fn: () => getEliteProTechVideo(url) },
        { name: 'Yupra', fn: () => getYupraVideo(url) }
    ];
    const audioApis = [
        { name: 'Arslan-Audio', fn: () => getArslanAudio(url) },
        { name: 'Yupra-Audio', fn: () => getYupraAudio(url) }
    ];

    const apis = type === 'audio' ? audioApis : videoApis;

    for (const api of apis) {
        try {
            const data = await api.fn();
            if (data?.download) {
                console.log(`✅ ${api.name} API success`);
                return data;
            }
        } catch (err) {
            console.log(`❌ ${api.name} API failed:`, err.message);
        }
    }
    return null;
}

async function downloadAudioFromYts(url) {
    return tryDownloadApis(url, 'audio');
}

// ================= RELIABLE SEND =================
async function sendMediaSafe(sock, chatId, type, url, opts, quotedMsg) {
    const payload = type === 'audio'
        ? { audio: { url }, mimetype: 'audio/mpeg', fileName: opts.fileName, ptt: false, ...channelInfo }
        : { video: { url }, mimetype: 'video/mp4', fileName: opts.fileName, caption: opts.caption, ...channelInfo };

    try {
        await sock.sendMessage(chatId, payload, { quoted: quotedMsg });
        return true;
    } catch (err) {
        console.log('⚠️ Direct URL send failed, retrying via buffer:', err.message);
    }

    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
        const buffer = Buffer.from(res.data);

        const bufferPayload = type === 'audio'
            ? { audio: buffer, mimetype: 'audio/mpeg', fileName: opts.fileName, ptt: false, ...channelInfo }
            : { video: buffer, mimetype: 'video/mp4', fileName: opts.fileName, caption: opts.caption, ...channelInfo };

        await sock.sendMessage(chatId, bufferPayload, { quoted: quotedMsg });
        return true;
    } catch (err) {
        console.error('❌ Buffer fallback also failed:', err.message);
        return false;
    }
}

// ================= MAIN SEARCH COMMAND =================
async function ytsCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🔍');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('🔍 ʏᴛs sᴇᴀʀᴄʜ', ['📌 ᴜsᴀɢᴇ : .ʏᴛs [sᴏɴɢ/ɴᴀᴍᴇ]', '🔍 ᴇxᴀᴍᴘʟᴇ : .ʏᴛs ᴀᴛɪꜰ ᴀsʟᴀᴍ']),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ʀᴇsᴜʟᴛs', [`🔍 ɴᴏ ᴠɪᴅᴇᴏs ꜰᴏᴜɴᴅ ꜰᴏʀ: ${searchQuery}`, '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs']),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const topVideos = videos.slice(0, MAX_RESULTS);

        let resultText = box('🔍 sᴇᴀʀᴄʜ ʀᴇsᴜʟᴛs', [`📊 ǫᴜᴇʀʏ : ${searchQuery}`, `🎬 ꜰᴏᴜɴᴅ : ${topVideos.length} ᴠɪᴅᴇᴏs`]) + '\n\n';

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

        const searchId = sent.key.id;
        activeSearches.set(searchId, {
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
            text: box('❌ ᴇʀʀᴏʀ', [`🔴 ${error.message || 'Something went wrong'}`, '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ']),
            ...channelInfo
        }, { quoted: message });
    }
}

// ================= HANDLE ALL REPLIES =================
async function processYtsReply(sock, chatId, message) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quotedMsgId || !text) return false;

        const sender = message.key.participant || message.key.remoteJid;

        // STEP 2: Reply to format prompt
        if (pendingFormat.has(quotedMsgId)) {
            const pending = pendingFormat.get(quotedMsgId);
            if (sender !== pending.sender) return false;

            const num = parseStrictInt(text);
            const choice = num === 2 ? 'audio' : num === 1 ? 'video' : null;
            if (!choice) {
                await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ᴄʜᴏɪᴄᴇ', ['1️⃣ ʀᴇᴘʟʏ 1 ꜰᴏʀ ᴠɪᴅᴇᴏ', '2️⃣ ʀᴇᴘʟʏ 2 ꜰᴏʀ ᴀᴜᴅɪᴏ']),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            if (processing.has(sender)) {
                await sock.sendMessage(chatId, {
                    text: box('⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ', ['🔄 ʏᴏᴜʀ ᴘʀᴇᴠɪᴏᴜs ᴅᴏᴡɴʟᴏᴀᴅ ɪs ᴘʀᴏᴄᴇssɪɴɢ']),
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

        // STEP 1: Reply to search results
        if (activeSearches.has(quotedMsgId)) {
            const num = parseStrictInt(text);
            if (num === null || num < 1) return false;

            const searchData = activeSearches.get(quotedMsgId);
            if (sender !== searchData.sender) {
                await sock.sendMessage(chatId, {
                    text: box('⛔ ɴᴏᴛ ʏᴏᴜʀ sᴇᴀʀᴄʜ', ['🔍 ᴛʜɪs sᴇᴀʀᴄʜ ᴡᴀs ʀᴇǫᴜᴇsᴛᴇᴅ ʙʏ sᴏᴍᴇᴏɴᴇ ᴇʟsᴇ', '💡 ᴘʟᴇᴀsᴇ ᴜsᴇ .ʏᴛs ʏᴏᴜʀsᴇʟꜰ']),
                    ...channelInfo
                }, { quoted: message });
                return true;
            }

            if (num > searchData.videos.length) {
                await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ', [`📊 ᴏɴʟʏ ${searchData.videos.length} ᴠɪᴅᴇᴏs ᴀᴠᴀɪʟᴀʙʟᴇ`, `💡 ʀᴇᴘʟʏ ᴡɪᴛʜ 1 ᴛᴏ ${searchData.videos.length}`]),
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

// ================= DOWNLOAD + SEND =================
async function downloadAndSend(sock, chatId, message, video, type) {
    const videoUrl = video.url;
    const videoTitle = video.title || (type === 'audio' ? 'Audio' : 'Video');

    await addReaction(sock, message, '📥');
    await sock.sendMessage(chatId, {
        text: box('📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ', [
            `📌 ᴛɪᴛʟᴇ  : ${trim(videoTitle, 32)}`,
            `🎬 ꜰᴏʀᴍᴀᴛ : ${type === 'audio' ? 'MP3' : 'MP4'}`,
            '⏳ sᴛᴀᴛᴜs : ᴘʀᴏᴄᴇssɪɴɢ...'
        ]),
        ...channelInfo
    }, { quoted: message });

    const data = await tryDownloadApis(videoUrl, type);

    if (!data?.download) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', ['🔴 ᴀʟʟ sᴏᴜʀᴄᴇs ꜰᴀɪʟᴇᴅ', '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ']),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const sizeMB = await getRemoteFileSizeMB(data.download);
    if (sizeMB && parseFloat(sizeMB) > MAX_FILE_MB) {
        await addReaction(sock, message, '⚠️');
        await sock.sendMessage(chatId, {
            text: box('⚠️ ꜰɪʟᴇ ᴛᴏᴏ ʟᴀʀɢᴇ', [
                `📏 sɪᴢᴇ  : ${sizeMB} MB`,
                `⚠️ ʟɪᴍɪᴛ : ${MAX_FILE_MB} MB`,
                '💡 ᴛʀʏ sʜᴏʀᴛᴇʀ ᴠɪᴅᴇᴏ ᴏʀ ᴀᴜᴅɪᴏ'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const safeName = videoTitle.replace(/[^\w\s-]/g, '').trim() || (type === 'audio' ? 'audio' : 'video');
    const fileName = `${safeName}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    const caption = box('✅ ʀᴇᴀᴅʏ', [`📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 30)}`, '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ']);

    const ok = await sendMediaSafe(sock, chatId, type, data.download, { fileName, caption }, message);

    if (!ok) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ sᴇɴᴅ ꜰᴀɪʟᴇᴅ', ['🔴 ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ ᴇxᴘɪʀᴇᴅ', '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ']),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    await addReaction(sock, message, '✅');
}

module.exports = {
    ytsCommand,
    processYtsReply,
    downloadAudioFromYts
};