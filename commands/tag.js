const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

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

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    try {
        await addReaction(sock, message, '🏷️');

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ʙᴏᴛ ɴᴏᴛ ᴀᴅᴍɪɴ', [
                    '🔴 ᴘʟᴇᴀsᴇ ᴍᴀᴋᴇ ᴛʜᴇ ʙᴏᴛ ᴀɴ ᴀᴅᴍɪɴ ꜰɪʀsᴛ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await addReaction(sock, message, '⛔');
            await sock.sendMessage(chatId, {
                text: box('⛔ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ', [
                    '🔴 ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ᴄᴀɴ ᴜsᴇ ᴛʜɪs'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        const mentionedJidList = participants.map(p => p.id);

        await addReaction(sock, message, '🔄');

        if (replyMessage) {
            let messageContent = {};

            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                messageContent = {
                    image: { url: filePath },
                    caption: messageText || replyMessage.imageMessage.caption || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            } else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                messageContent = {
                    video: { url: filePath },
                    caption: messageText || replyMessage.videoMessage.caption || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                messageContent = {
                    text: replyMessage.conversation || replyMessage.extendedTextMessage.text,
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            } else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                messageContent = {
                    document: { url: filePath },
                    fileName: replyMessage.documentMessage.fileName,
                    caption: messageText || '',
                    mentions: mentionedJidList,
                    ...channelInfo
                };
            }

            if (Object.keys(messageContent).length > 0) {
                await sock.sendMessage(chatId, messageContent);
                await addReaction(sock, message, '✅');
            } else {
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: box('❌ ᴜɴsᴜᴘᴘᴏʀᴛᴇᴅ ᴍᴇᴅɪᴀ', [
                        '🔴 ᴛʜɪs ᴍᴇᴅɪᴀ ɪs ɴᴏᴛ sᴜᴘᴘᴏʀᴛᴇᴅ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        } else {
            const text = messageText || '📢 Attention Everyone!';
            await sock.sendMessage(chatId, {
                text: text,
                mentions: mentionedJidList,
                ...channelInfo
            });
            await addReaction(sock, message, '✅');
        }

    } catch (error) {
        console.error('Tag command error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${error.message || 'Something went wrong'}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = tagCommand;