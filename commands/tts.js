const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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
            react: {
                text: emoji,
                key: message.key
            }
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

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    const fileName = `tts-${Date.now()}.mp3`;
    const tempDir = path.join(__dirname, '..', 'temp');
    const filePath = path.join(tempDir, fileName);

    try {
        // 🔄 Start reaction
        await addReaction(sock, message, '🔊');

        if (!text) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('🔊 ᴛᴛs ᴄᴏᴍᴍᴀɴᴅ', [
                    '📌 ᴜsᴀɢᴇ : .ᴛᴛs [ᴛᴇxᴛ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴛᴛs ʜᴇʟʟᴏ ᴡᴏʀʟᴅ',
                    '🌍 ᴏᴘᴛɪᴏɴᴀʟ : .ᴛᴛs [ʟᴀɴɢ] [ᴛᴇxᴛ]'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // 🎙️ Processing reaction
        await addReaction(sock, message, '🎙️');

        fs.mkdirSync(tempDir, { recursive: true });
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(text)}&total=1&idx=0&client=tw-ob`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (!response.ok) throw new Error(`TTS request failed with ${response.status}`);
        
        fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));

        // ✅ Send audio with styled caption
        const caption = box('🔊 ᴛᴛs ɢᴇɴᴇʀᴀᴛᴇᴅ', [
            `📝 ᴛᴇxᴛ : ${text.substring(0, 40)}${text.length > 40 ? '...' : ''}`,
            `🌍 ʟᴀɴɢ : ${language.toUpperCase()}`,
            '✅ sᴛᴀᴛᴜs : ᴅᴏɴᴇ'
        ]);

        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `tts_${Date.now()}.mp3`,
            caption: caption,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('TTS error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴛᴛs ꜰᴀɪʟᴇᴅ', [
                `🔴 ${error.message || 'Error generating TTS'}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    } finally {
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
        }
    }
}

module.exports = ttsCommand;