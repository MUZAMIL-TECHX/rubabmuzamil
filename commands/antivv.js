const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { readSessionJson, writeSessionJson } = require('../lib/session_data');
const isOwnerOrSudo = require('../lib/isOwner');

function getConfig(sock) {
    return readSessionJson(sock, 'antivv.json', { enabled: false });
}

async function antiVvCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    if (!message.key.fromMe && !(await isOwnerOrSudo(senderId, sock, chatId))) {
        return sock.sendMessage(chatId, { text: 'Only the bot owner can use this command.' }, { quoted: message });
    }

    const config = getConfig(sock);
    const argument = String(match || '').trim().toLowerCase();
    if (!argument) {
        return sock.sendMessage(chatId, {
            text: `Anti-ViewOnce is ${config.enabled ? 'ON' : 'OFF'}.\nUsage: .antivv on/off`
        }, { quoted: message });
    }
    if (argument !== 'on' && argument !== 'off') {
        return sock.sendMessage(chatId, { text: 'Invalid option. Use .antivv on or .antivv off.' }, { quoted: message });
    }

    config.enabled = argument === 'on';
    writeSessionJson(sock, 'antivv.json', config);
    return sock.sendMessage(chatId, {
        text: `Anti-ViewOnce is now ${config.enabled ? 'ON' : 'OFF'} for this session.`
    }, { quoted: message });
}

function unwrap(message) {
    let current = message;
    while (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    while (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    while (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    while (current?.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message;
    return current || {};
}

async function handleAntiVv(sock, message) {
    try {
        const config = getConfig(sock);
        if (!config.enabled || message.key?.fromMe) return false;

        const content = unwrap(message.message);
        const media = content.imageMessage || content.videoMessage || content.audioMessage;
        if (!media || !media.viewOnce) return false;

        const type = content.imageMessage ? 'image' : content.videoMessage ? 'video' : 'audio';
        const stream = await downloadContentFromMessage(media, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const sender = message.key.participant || message.key.remoteJid;
        const senderLabel = `@${String(sender).split('@')[0].split(':')[0]}`;
        const caption = `Sended by ${senderLabel}\nPowered by Muzamil-XD (antivv)`;
        const number = String(sock.user?.id || '').split(':')[0].split('@')[0];
        if (!number) return false;
        const destination = `${number}@s.whatsapp.net`;
        const payload = type === 'image' ? { image: buffer, caption, mentions: [sender] }
            : type === 'video' ? { video: buffer, caption, mentions: [sender] }
                : { audio: buffer, mimetype: media.mimetype || 'audio/ogg', caption, mentions: [sender] };
        await sock.sendMessage(destination, payload);
        return true;
    } catch (error) {
        console.error('Anti-ViewOnce error:', error.message);
        return false;
    }
}

module.exports = { antiVvCommand, handleAntiVv };