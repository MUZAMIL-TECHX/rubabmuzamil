'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_NUMBER = '923433740855';
const AUTOFOLLOW_FILE = path.join(__dirname, '..', 'data', 'autofollow.json');

function ensureFile() {
    fs.mkdirSync(path.dirname(AUTOFOLLOW_FILE), { recursive: true });
    if (!fs.existsSync(AUTOFOLLOW_FILE)) fs.writeFileSync(AUTOFOLLOW_FILE, '[]');
}

function readChannels() {
    ensureFile();
    try {
        const data = JSON.parse(fs.readFileSync(AUTOFOLLOW_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

function saveChannels(channels) {
    ensureFile();
    const temporary = `${AUTOFOLLOW_FILE}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(channels, null, 2));
    fs.renameSync(temporary, AUTOFOLLOW_FILE);
}

function cleanNumber(value) {
    return String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}

function isAllowed(sock, senderId, message) {
    // fromMe is accepted only for the linked account whose session number is
    // the hardcoded authorized number; other linked bot accounts are denied.
    return cleanNumber(senderId) === ALLOWED_NUMBER
        || (message?.key?.fromMe && (
            cleanNumber(sock?.user?.id) === ALLOWED_NUMBER
            || cleanNumber(message?.key?.remoteJid) === ALLOWED_NUMBER
        ));
}

function parseChannelLink(input) {
    const match = String(input || '').trim().match(
        /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)(?:\/\d+)?(?:[?#].*)?$/i
    );
    return match ? match[1] : null;
}

async function addAutofollowCommand(sock, chatId, message, input, senderId) {
    if (!isAllowed(sock, senderId, message)) {
        return sock.sendMessage(chatId, {
            text: '⚠️ 𝗢𝗻𝗹𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹 𝗖𝗮𝗻 𝗔𝗰𝗰𝗲𝘀𝘀 𝗧𝗵𝗶𝘀 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 !'
        }, { quoted: message });
    }

    const link = String(input || '').trim();
    const inviteCode = parseChannelLink(link);
    if (!inviteCode) {
        return sock.sendMessage(chatId, {
            text: 'Usage: .addautofollow https://whatsapp.com/channel/XXXXXXXX'
        }, { quoted: message });
    }

    if (typeof sock.newsletterMetadata !== 'function' || typeof sock.newsletterFollow !== 'function') {
        return sock.sendMessage(chatId, {
            text: '❌ This Baileys version does not support WhatsApp Channel following.'
        }, { quoted: message });
    }

    try {
        const metadata = await sock.newsletterMetadata('invite', inviteCode);
        const jid = metadata?.id || metadata?.jid;
        if (!jid || !/@newsletter$/i.test(jid)) throw new Error('Channel could not be resolved');

        const channels = readChannels();
        const exists = channels.some(channel => channel.jid === jid);
        if (!exists) {
            channels.push({
                url: `https://whatsapp.com/channel/${inviteCode}`,
                jid,
                name: metadata?.name || '',
                addedAt: new Date().toISOString()
            });
            saveChannels(channels);
        }

        await sock.newsletterFollow(jid);
        return sock.sendMessage(chatId, {
            text: exists
                ? '✅ Ye channel pehle se autofollow list mein hai aur current bot ne follow kar liya.'
                : `✅ Channel autofollow mein add ho gaya.\n\nhttps://whatsapp.com/channel/${inviteCode}\n\nAb connected hone wale bots automatically follow karenge.`
        }, { quoted: message });
    } catch (error) {
        console.error('[autofollow]', error);
        return sock.sendMessage(chatId, {
            text: '❌ Channel add/follow nahi ho saka. Link check karein aur dobara try karein.'
        }, { quoted: message });
    }
}

async function listAutofollowCommand(sock, chatId, message, senderId) {
    if (!isAllowed(sock, senderId, message)) {
        return sock.sendMessage(chatId, {
            text: '⚠️ 𝗢𝗻𝗹𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹 𝗖𝗮𝗻 𝗔𝗰𝗰𝗲𝘀𝘀 𝗧𝗵𝗶𝘀 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 !'
        }, { quoted: message });
    }

    const channels = readChannels();
    if (!channels.length) {
        return sock.sendMessage(chatId, { text: '📋 Autofollow list empty hai.' }, { quoted: message });
    }
    const lines = channels.map((channel, index) => `${index + 1}. ${channel.url}`);
    return sock.sendMessage(chatId, {
        text: `📋 *Autofollow Channels (${channels.length})*\n\n${lines.join('\n')}`
    }, { quoted: message });
}

async function followSavedChannels(sock) {
    if (typeof sock.newsletterFollow !== 'function') return;
    for (const channel of readChannels()) {
        if (!channel.jid) continue;
        try {
            await sock.newsletterFollow(channel.jid);
            console.log(`✅ Autofollowed ${channel.jid} for ${sock.sessionKey || 'default'}`);
        } catch (error) {
            console.warn(`⚠️ Autofollow failed for ${channel.jid}: ${error.message}`);
        }
    }
}

module.exports = { addAutofollowCommand, listAutofollowCommand, followSavedChannels };