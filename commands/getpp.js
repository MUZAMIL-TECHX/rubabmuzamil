const fs = require('fs');
const path = require('path');
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

// ===============================
// HELPER: Add Reaction
// ===============================
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Reaction error:', error);
    }
}

// ===============================
// HELPER: Box Builder
// ===============================
function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

function getContextInfo(message) {
    return message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.documentMessage?.contextInfo ||
        {};
}

function getTargetJid(message, chatId, rawTarget) {
    const target = String(rawTarget || '').trim();
    if (target) {
        const number = target.replace(/[^\d]/g, '');
        if (number.length >= 7) return `${number}@s.whatsapp.net`;
    }

    const contextInfo = getContextInfo(message);
    if (contextInfo.participant) return contextInfo.participant;
    return chatId.endsWith('@g.us') ? '' : chatId;
}

async function getDisplayName(sock, chatId, jid) {
    try {
        if (chatId.endsWith('@g.us')) {
            const metadata = await sock.groupMetadata(chatId);
            const participant = metadata.participants.find(item => item.id === jid);
            if (participant?.notify || participant?.name) return participant.notify || participant.name;
        }
    } catch (_) {}

    return sock.contacts?.[jid]?.name ||
        sock.contacts?.[jid]?.notify ||
        `@${jid.split('@')[0].split(':')[0]}`;
}

async function getProfilePictureCommand(sock, chatId, message, rawTarget = '') {
    try {
        // 👤 Start reaction
        await addReaction(sock, message, '👤');

        const targetJid = getTargetJid(message, chatId, rawTarget);
        if (!targetJid) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('👤 ɢᴇᴛ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ', [
                    '📌 ᴜsᴀɢᴇ : .ɢᴇᴛᴘᴘ [ɴᴜᴍʙᴇʀ]',
                    '📌 ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍsɢ',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ɢᴇᴛᴘᴘ 923001234567'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // 🔄 Processing
        await addReaction(sock, message, '🔄');

        let profileUrl;
        try {
            profileUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (_) {
            profileUrl = await sock.profilePictureUrl(targetJid, 'preview');
        }

        const response = await axios.get(profileUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            maxContentLength: 8 * 1024 * 1024
        });

        const saveDir = path.join(process.cwd(), 'saved_profile_pictures');
        fs.mkdirSync(saveDir, { recursive: true });

        const safeId = targetJid.replace(/[^\w.-]/g, '_');
        const filePath = path.join(saveDir, `${safeId}_${Date.now()}.jpg`);
        fs.writeFileSync(filePath, Buffer.from(response.data));

        const displayName = await getDisplayName(sock, chatId, targetJid);

        // ✅ Send image
        await sock.sendMessage(chatId, {
            image: fs.readFileSync(filePath),
            caption: box('✅ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ ꜰᴏᴜɴᴅ', [
                `👤 ᴜsᴇʀ  : @${targetJid.split('@')[0].split(':')[0]}`,
                `📛 ɴᴀᴍᴇ  : ${displayName}`,
                '✅ sᴛᴀᴛᴜs : sᴀᴠᴇᴅ'
            ]),
            mentions: [targetJid],
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

        // Cleanup
        setTimeout(() => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
        }, 5000);

    } catch (error) {
        console.error('Error in getpp command:', error?.message || error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ ᴇʀʀᴏʀ', [
                '🔴 ᴜsᴇʀ ʜᴀs ɴᴏ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ',
                '🔒 ᴏʀ ᴘʀɪᴠᴀᴄʏ ʙʟᴏᴄᴋᴇᴅ',
                '💡 ᴛʀʏ ᴡɪᴛʜ ᴀɴᴏᴛʜᴇʀ ᴜsᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = getProfilePictureCommand;