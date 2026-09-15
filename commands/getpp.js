const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
    const targetJid = getTargetJid(message, chatId, rawTarget);
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '⚠️ 𝗡𝘂𝗺𝗯𝗲𝗿 𝗱𝗼 𝘆𝗮 𝗸𝗶𝘀𝗶 𝗽𝗲𝗿𝘀𝗼𝗻 𝗸𝗲 𝗺𝗲𝘀𝘀𝗮𝗴𝗲 𝗸𝗼 𝗿𝗲𝗽𝗹𝘆 𝗸𝗮𝗿𝗼.\n𝗨𝘀𝗮𝗴𝗲: .getpp 923xxxxxxxxx',
            quoted: message
        });
        return;
    }

    try {
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
        await sock.sendMessage(chatId, {
            image: fs.readFileSync(filePath),
            caption: [
                '𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗣𝗶𝗰𝘁𝘂𝗿𝗲 𝗦𝗮𝘃𝗲𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 ✅',
                `@${targetJid.split('@')[0].split(':')[0]}`,
                `𝗡𝗮𝗺𝗲: ${displayName}`,
                '> 𝗕𝘆 : 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗'
            ].join('\n'),
            mentions: [targetJid]
        }, { quoted: message });
    } catch (error) {
        console.error('Error in getpp command:', error?.message || error);
        await sock.sendMessage(chatId, {
            text: '❌ 𝗜𝘀 𝗽𝗲𝗿𝘀𝗼𝗻 𝗸𝗶 𝗽𝗿𝗼𝗳𝗶𝗹𝗲 𝗽𝗶𝗰𝘁𝘂𝗿𝗲 𝗽𝗿𝗶𝘃𝗮𝘁𝗲 𝗵𝗮𝗶 𝘆𝗮 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗻𝗮𝗵𝗶 𝗵𝗮𝗶.',
            quoted: message
        });
    }
}

module.exports = getProfilePictureCommand;