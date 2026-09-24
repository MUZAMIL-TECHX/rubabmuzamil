const axios = require('axios');

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

// Helper function to add reaction
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Reaction error:', error);
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

async function downloadAudio(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'audio/*,*/*;q=0.8' }
    });
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('json') || contentType.includes('text/html')) {
        throw new Error('The audio provider returned an error instead of an MP3.');
    }
    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('The downloaded MP3 is empty.');
    return buffer;
}

async function playCommand(sock, chatId, message) {
    try {
        // 🎵 Start reaction
        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.replace(/^\.(?:play|music)\b/i, '').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎵 ᴘʟᴀʏ ᴄᴏᴍᴍᴀɴᴅ', [
                    '📌 ᴜsᴀɢᴇ : .ᴘʟᴀʏ [sᴏɴɢ ɴᴀᴍᴇ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴘʟᴀʏ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴘʟᴀʏ ᴛᴜᴍ ʜɪ ʜᴏ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // 🔍 Search and prepare audio using the requested play API.
        await addReaction(sock, message, '🔍');

        const apiUrl = `https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(searchQuery)}`;
        const response = await axios.get(apiUrl, { timeout: 90000, maxContentLength: 2 * 1024 * 1024 });
        const result = response.data?.result;
        if (response.data?.status !== true || !result?.downloadUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ sᴏɴɢ ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ', [
                    `🔍 ɴᴏ ᴅᴏᴡɴʟᴏᴀᴅ ʀᴇsᴜʟᴛ ꜰᴏʀ : ${searchQuery}`,
                    '💡 ᴛʀʏ ᴀɢᴀɪɴ ᴡɪᴛʜ ᴀ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴏɴɢ ɴᴀᴍᴇ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // Send preview
        try {
            const previewCaption = box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                `📌 ᴛɪᴛʟᴇ : ${(result.title || searchQuery).substring(0, 38)}${(result.title || searchQuery).length > 38 ? '...' : ''}`,
                `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${result.duration || 'Unknown'}`,
                `🎚️ ǫᴜᴀʟɪᴛʏ : ${result.quality || 'MP3'}`,
                '━━━━━━━━━━━━━━━━━━',
                '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴍᴘ3...'
            ]);
            await sock.sendMessage(chatId, {
                ...(result.thumbnail
                    ? { image: { url: result.thumbnail }, caption: previewCaption }
                    : { text: previewCaption }),
                ...channelInfo
            }, { quoted: message });
        } catch (e) {
            console.error('Thumbnail error:', e);
        }

        // 📥 Download reaction
        await addReaction(sock, message, '📥');

        const audioBuffer = await downloadAudio(result.downloadUrl);
        const title = result.title || searchQuery || 'Song';

        // ✅ Send audio
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${cleanFileName(title)}.mp3`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error in play command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${error.message || 'Download failed'}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = playCommand;