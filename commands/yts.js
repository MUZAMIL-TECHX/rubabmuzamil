const axios = require('axios');
const yts = require('yt-search');

// ================= CONFIG =================
const MAX_RESULTS = 8;                  // kitne results dikhane hain
const SEARCH_EXPIRY_MS = 5 * 60 * 1000; // 5 min me search expire
const MAX_FILE_MB = 90;                 // WhatsApp ke liye safe limit
const API_TIMEOUT = 60000;
const CLEANUP_INTERVAL_MS = 60 * 1000;  // har 1 min me expired entries purge

// ================= STORAGE =================
// searchId -> { videos, chatId, sender, timestamp }
const activeSearches = new Map();
// pendingFormat: promptMsgId -> { video, chatId, sender, timestamp }
const pendingFormat = new Map();
// concurrent-download lock -> per sender ek waqt me sirf ek download
const processing = new Set();

// ================= PERIODIC CLEANUP (instead of per-entry setTimeout) =================
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
    let out = `╭━━━〔 ${title} 〕━━━┈⊷\n`;
    for (const l of lines) out += `┃ ❍ ${l}\n`;
    out += `╰━━━━━━━━━━━━━━━━┈⊷\n\n> By; Muzamil-XD`;
    return out;
}

function trim(str, n) {
    if (!str) return 'Unknown';
    return str.length > n ? str.slice(0, n) + '...' : str;
}

// Strict: only pure digit strings count as a valid selection ("2abc" ko reject karega)
function parseStrictInt(text) {
    if (!/^\d+$/.test(text)) return null;
    return Number(text);
}

async function getRemoteFileSizeMB(url) {
    // Best-effort only: kuch servers HEAD support nahi karte ya content-length nahi bhejte,
    // is case me null return hoga aur size-check silently skip ho jayega.
    try {
        const res = await axios.head(url, { timeout: 15000 });
        const len = res.headers['content-length'];
        if (!len) return null;
        return (parseInt(len, 10) / (1024 * 1024)).toFixed(1);
    } catch {
        return null;
    }
}

// ================= DOWNLOAD APIs (VIDEO) =================
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

// ================= DOWNLOAD APIs (AUDIO) =================
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

// ================= RELIABLE SEND (handles expired/signed download URLs) =================
// Pehle direct URL se bhejne ki koshish karta hai (fast, no RAM usage).
// Agar Baileys fail ho jaye (expired/blocked URL) to buffer download karke retry karta hai.
async function sendMediaSafe(sock, chatId, type, url, opts, quotedMsg) {
    const payload = type === 'audio'
        ? { audio: { url }, mimetype: 'audio/mpeg', fileName: opts.fileName, ptt: false }
        : { video: { url }, mimetype: 'video/mp4', fileName: opts.fileName, caption: opts.caption };

    try {
        await sock.sendMessage(chatId, payload, { quoted: quotedMsg });
        return true;
    } catch (err) {
        console.log('⚠️ Direct URL send failed, retrying via buffer:', err.message);
    }

    // Fallback: buffer download
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
        const buffer = Buffer.from(res.data);

        const bufferPayload = type === 'audio'
            ? { audio: buffer, mimetype: 'audio/mpeg', fileName: opts.fileName, ptt: false }
            : { video: buffer, mimetype: 'video/mp4', fileName: opts.fileName, caption: opts.caption };

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
                text: box('🔍 YTS SEARCH', ['Usage : .yts [song/name]', 'Example : .yts Atif Aslam'])
            }, { quoted: message });
            return;
        }

        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ NO RESULTS', [`No videos found for: ${searchQuery}`, 'Try different keywords'])
            }, { quoted: message });
            return;
        }

        const topVideos = videos.slice(0, MAX_RESULTS);

        let resultText = box('🔍 SEARCH RESULTS', [`Query : ${searchQuery}`, `Found : ${topVideos.length} videos`]) + '\n\n';

        topVideos.forEach((v, i) => {
            resultText += `*${i + 1}.* ${trim(v.title, 55)}\n`;
            resultText += `   ⏱ ${v.timestamp || 'Unknown'}  |  👁 ${v.views ? v.views.toLocaleString() : '?'}  |  📺 ${trim(v.author?.name, 20)}\n\n`;
        });

        resultText += `💡 *Reply* with a number (1-${topVideos.length}) to download.\n> By; Muzamil-XD`;

        const sent = await sock.sendMessage(chatId, { text: resultText }, { quoted: message });

        const searchId = sent.key.id; // reply hoga isi message ki id pe
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
            text: box('❌ ERROR', [error.message || 'Something went wrong', 'Please try again later'])
        }, { quoted: message });
    }
}

// ================= HANDLE ALL REPLIES (number pick + format pick) =================
async function processYtsReply(sock, chatId, message) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quotedMsgId || !text) return false;

        const sender = message.key.participant || message.key.remoteJid;

        // STEP 2: user replied to the "choose format" prompt with "1" (video) or "2" (audio)
        if (pendingFormat.has(quotedMsgId)) {
            const pending = pendingFormat.get(quotedMsgId);
            if (sender !== pending.sender) return false;

            const num = parseStrictInt(text);
            const choice = num === 2 ? 'audio' : num === 1 ? 'video' : null;
            if (!choice) {
                await sock.sendMessage(chatId, {
                    text: box('❌ INVALID CHOICE', ['Reply 1 for Video', 'Reply 2 for Audio'])
                }, { quoted: message });
                return true;
            }

            // Concurrent-download guard: same sender ek waqt me sirf 1 active download
            if (processing.has(sender)) {
                await sock.sendMessage(chatId, {
                    text: box('⏳ PLEASE WAIT', ['Your previous download is still processing...'])
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

        // STEP 1: user replied to search results with a number
        if (activeSearches.has(quotedMsgId)) {
            const num = parseStrictInt(text);
            if (num === null || num < 1) return false;

            const searchData = activeSearches.get(quotedMsgId);
            if (sender !== searchData.sender) {
                await sock.sendMessage(chatId, {
                    text: box('⛔ NOT YOUR SEARCH', ['This search was requested by someone else', 'Please use .yts to search yourself'])
                }, { quoted: message });
                return true;
            }

            if (num > searchData.videos.length) {
                await sock.sendMessage(chatId, {
                    text: box('❌ INVALID NUMBER', [`Only ${searchData.videos.length} videos available`, `Reply with 1 to ${searchData.videos.length}`])
                }, { quoted: message });
                return true;
            }

            const selectedVideo = searchData.videos[num - 1];
            activeSearches.delete(quotedMsgId);

            // Ask format: video or audio
            const askSent = await sock.sendMessage(chatId, {
                text: box('🎯 CHOOSE FORMAT', [
                    trim(selectedVideo.title, 45),
                    '',
                    '1️⃣  Reply 1  →  Video (mp4)',
                    '2️⃣  Reply 2  →  Audio (mp3)'
                ])
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
        text: box('📥 DOWNLOADING', [
            `Title  : ${trim(videoTitle, 35)}`,
            `Format : ${type === 'audio' ? 'MP3' : 'MP4'}`,
            'Status : Processing...'
        ])
    }, { quoted: message });

    const data = await tryDownloadApis(videoUrl, type);

    if (!data?.download) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ DOWNLOAD FAILED', ['All sources failed', 'Try again later'])
        }, { quoted: message });
        return;
    }

    // Size guard (best-effort — see getRemoteFileSizeMB note; some APIs won't report a length)
    const sizeMB = await getRemoteFileSizeMB(data.download);
    if (sizeMB && parseFloat(sizeMB) > MAX_FILE_MB) {
        await addReaction(sock, message, '⚠️');
        await sock.sendMessage(chatId, {
            text: box('⚠️ FILE TOO LARGE', [`Size : ${sizeMB} MB`, `Limit : ${MAX_FILE_MB} MB`, 'Try a shorter video or use audio instead'])
        }, { quoted: message });
        return;
    }

    const safeName = videoTitle.replace(/[^\w\s-]/g, '').trim() || (type === 'audio' ? 'audio' : 'video');
    const fileName = `${safeName}.${type === 'audio' ? 'mp3' : 'mp4'}`;
    const caption = box('✅ READY', [`Title : ${trim(videoTitle, 30)}`, 'Status : Downloaded ✅']);

    const ok = await sendMediaSafe(sock, chatId, type, data.download, { fileName, caption }, message);

    if (!ok) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ SEND FAILED', ['Download link expired or unreachable', 'Please try again'])
        }, { quoted: message });
        return;
    }

    await addReaction(sock, message, '✅');
}

module.exports = {
    ytsCommand,
    processYtsReply
};
