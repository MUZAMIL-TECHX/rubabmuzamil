const yts = require('yt-search');
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

async function playCommand(sock, chatId, message) {
    try {
        // 🎵 Start reaction
        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

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

        // 🔍 Search reaction
        await addReaction(sock, message, '🔍');

        const { videos } = await yts(searchQuery);
        if (!videos || videos.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ sᴏɴɢs ꜰᴏᴜɴᴅ', [
                    `🔍 ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏʀ : ${searchQuery}`,
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const video = videos[0];
        const urlYt = video.url;

        // Send preview
        try {
            await sock.sendMessage(chatId, {
                image: { url: video.thumbnail },
                caption: box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                    `📌 ᴛɪᴛʟᴇ : ${(video.title || '').substring(0, 38)}${(video.title || '').length > 38 ? '...' : ''}`,
                    `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${video.timestamp || 'Unknown'}`,
                    `📺 ᴄʜᴀɴɴᴇʟ : ${(video.author?.name || 'Unknown').substring(0, 25)}`,
                    '━━━━━━━━━━━━━━━━━━',
                    '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ...'
                ]),
                ...channelInfo
            }, { quoted: message });
        } catch (e) {
            console.error('Thumbnail error:', e);
        }

        // 📥 Download reaction
        await addReaction(sock, message, '📥');

        // Fetch audio
        const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`, {
            timeout: 60000
        });
        const data = response.data;

        if (!data || !data.status || !data.result || !data.result.downloadUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴀᴘɪ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴀᴜᴅɪᴏ',
                    '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const audioUrl = data.result.downloadUrl;
        const title = data.result.title || video.title || 'Song';

        // ✅ Send audio
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
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