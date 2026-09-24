const axios = require('axios');
const yts = require('yt-search');

const activeDownloads = new Set();

// ===============================
// 🎯 CHANNEL INFO
// ===============================
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

async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Reaction error:', error.message);
    }
}

function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

function cleanFileName(value) {
    return String(value || 'song')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'song';
}

// ===============================
// ✅ FAST BUFFER DOWNLOAD
// ===============================
async function downloadBuffer(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        decompress: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'audio/*,*/*;q=0.8',
            'Accept-Encoding': 'identity'  // ✅ Fast & reliable
        }
    });

    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('json') || contentType.includes('text/html')) {
        throw new Error('Provider returned error instead of MP3');
    }

    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('Downloaded audio is empty');
    return buffer;
}

async function searchSong(query) {
    const result = await yts(query);
    const video = result?.videos?.[0];
    if (!video?.url) return null;
    return video;
}

// ===============================
// MAIN SONG COMMAND (FIXED FAST)
// ===============================
async function songCommand(sock, chatId, message) {
    const sender = message.key.participant || message.key.remoteJid;

    // Concurrent guard
    if (activeDownloads.has(sender)) {
        await sock.sendMessage(chatId, {
            text: box('⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ', [
                '🔄 ᴘʀᴇᴠɪᴏᴜs ʀᴇǫᴜᴇsᴛ ɪɴ ᴘʀᴏɢʀᴇss'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const rawText = message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const query = rawText.replace(/^\.?(?:song|mp3|ytmp3|play)\b/i, '').trim();

    if (!query) {
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('🎵 sᴏɴɢ ᴅʟ', [
                '📌 ᴜsᴀɢᴇ : .sᴏɴɢ [ɴᴀᴍᴇ/ʟɪɴᴋ]',
                '🔍 ᴇxᴀᴍᴘʟᴇ : .sᴏɴɢ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                '⚡ ꜰᴀsᴛ ᴍᴘ3 : .ᴘʟᴀʏ [sᴏɴɢ ɴᴀᴍᴇ]'
            ]),
            ...channelInfo
        }, { quoted: message });
        return;
    }

    activeDownloads.add(sender);

    try {
        // 🔍 Search reaction
        await addReaction(sock, message, '🔍');

        const video = await searchSong(query);
        if (!video) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ sᴏɴɢ', [
                    `🔍 ɴᴏ ʀᴇsᴜʟᴛ ꜰᴏʀ : ${query}`,
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // ===============================
        // 🖼️ STEP 1: SEND THUMBNAIL FIRST (FATAKAT!)
        // ===============================
        const previewCaption = box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
            `📌 ᴛɪᴛʟᴇ : ${String(video.title || 'Unknown').slice(0, 40)}`,
            `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${video.timestamp || 'Unknown'}`,
            `📺 ᴄʜᴀɴɴᴇʟ : ${String(video.author?.name || 'Unknown').slice(0, 25)}`,
            '━━━━━━━━━━━━━━━━━━',
            '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ...'
        ]);

        if (video.thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: video.thumbnail },
                caption: previewCaption,
                ...channelInfo
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: previewCaption,
                ...channelInfo
            }, { quoted: message });
        }

        // 📥 Processing reaction
        await addReaction(sock, message, '📥');

        // ===============================
        // 🎵 STEP 2: FETCH DOWNLOAD LINK (API)
        // ===============================
        const downloadApi = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(video.url)}`;
        const { data } = await axios.get(downloadApi, {
            timeout: 60000,
            maxContentLength: 2 * 1024 * 1024
        });

        if (data?.status !== true || !data?.audio) {
            throw new Error('API did not return MP3 link');
        }

        // ===============================
        // 🚀 STEP 3: DOWNLOAD AS BUFFER (FAST)
        // ===============================
        const audioBuffer = await downloadBuffer(data.audio);
        const finalTitle = data.title || video.title || 'Song';

        // ===============================
        // ✅ STEP 4: SEND AUDIO
        // ===============================
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${cleanFileName(finalTitle)}.mp3`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Song command error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Download failed';
        if (errorMsg.length > 80) errorMsg = errorMsg.substring(0, 80) + '...';

        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${errorMsg}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    } finally {
        activeDownloads.delete(sender);
    }
}

module.exports = songCommand;
