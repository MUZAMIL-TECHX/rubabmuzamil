const {
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

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
        console.error('Reaction error:', error);
    }
}

function unwrapMessage(message) {
    let current = message;
    while (current?.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    while (current?.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    while (current?.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    while (current?.viewOnceMessageV2Extension?.message) current = current.viewOnceMessageV2Extension.message;
    return current || {};
}

function quotedMessageOf(message) {
    const contextInfo =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        message?.message?.audioMessage?.contextInfo ||
        message?.message?.documentMessage?.contextInfo ||
        {};
    return unwrapMessage(contextInfo.quotedMessage);
}

function messageContextInfo(message) {
    return (
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        message?.message?.audioMessage?.contextInfo ||
        message?.message?.documentMessage?.contextInfo ||
        {}
    );
}

async function downloadMedia(media, type) {
    try {
        const stream = await downloadContentFromMessage(media, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    } catch (error) {
        console.error('Download media error:', error);
        return null;
    }
}

function ownerJid(sock) {
    const connected = String(sock?.user?.id || sock?.user?.jid || '')
        .split('@')[0]
        .split(':')[0]
        .replace(/[^\d]/g, '');
    return connected ? `${connected}@s.whatsapp.net` : null;
}

// ===============================
// ✅ UPLOAD HANDLER (FIXED)
// ===============================
async function uploadToWA(sock, buffer, type) {
    if (typeof sock.waUploadToServer === 'function') {
        return await sock.waUploadToServer(buffer, type);
    }
    if (sock?.mediaUploader?.upload) {
        return await sock.mediaUploader.upload(buffer, type);
    }
    throw new Error('Media uploader not available');
}

// ===============================
// ✅ GROUP STATUS SENDER (FIXED)
// ===============================
async function sendGroupStatus(sock, groupJid, content) {
    if (!groupJid?.endsWith('@g.us')) {
        throw new Error('This command can only be used in a group.');
    }

    // ✅ STEP 1: Upload media first (agar media hai)
    const uploadedContent = { ...content };

    if (content.image) {
        const up = await uploadToWA(sock, content.image, 'image');
        uploadedContent.image = up.url || up;
        delete content.image;
    }
    if (content.video) {
        const up = await uploadToWA(sock, content.video, 'video');
        uploadedContent.video = up.url || up;
        delete content.video;
    }
    if (content.audio) {
        const up = await uploadToWA(sock, content.audio, 'audio');
        uploadedContent.audio = up.url || up;
        delete content.audio;
    }
    if (content.document) {
        const up = await uploadToWA(sock, content.document, 'document');
        uploadedContent.document = up.url || up;
        delete content.document;
    }

    // ✅ STEP 2: Build message content with proper keys
    const messageSecret = crypto.randomBytes(32);
    const innerMessage = await generateWAMessageContent(uploadedContent, {
        upload: (buf, type) => uploadToWA(sock, buf, type)
    });

    // ✅ STEP 3: Wrap for group status
    const wrapped = generateWAMessageFromContent(groupJid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: {
            message: {
                ...innerMessage,
                messageContextInfo: { messageSecret }
            }
        }
    }, {});

    await sock.relayMessage(groupJid, wrapped.message, {
        messageId: wrapped.key.id
    });

    return true;
}

// ===============================
// 📡 GCSTATUS COMMAND (ULTRA DESIGN)
// ===============================
async function gcstatusCommand(sock, chatId, message, commandText = '') {
    try {
        await addReaction(sock, message, '📡');

        if (!chatId?.endsWith('@g.us')) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ɢʀᴏᴜᴘ ᴏɴʟʏ 〕┈──⊷
┋⋄ ➠ 🔴 ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const quoted = quotedMessageOf(message);
        const quotedText = quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';
        const directText = String(commandText || '').trim();

        const hasMedia =
            quoted.imageMessage ||
            quoted.videoMessage ||
            quoted.audioMessage ||
            quoted.documentMessage;

        if (!hasMedia && !quotedText && !directText) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ɴᴏ ʀᴇᴘʟʏ 〕┈──⊷
┋⋄ ➠ 📌 ʀᴇᴘʟʏ ᴛᴏ ᴀɴʏ ᴍᴇᴅɪᴀ ᴏʀ ᴛᴇxᴛ
┋⋄ ➠ 🖼️ ɪᴍᴀɢᴇ / ᴠɪᴅᴇᴏ / ᴀᴜᴅɪᴏ
┋⋄ ➠ 📎 ᴅᴏᴄᴜᴍᴇɴᴛ / ᴛᴇxᴛ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // ✅ Build status content with correct keys
        let statusContent;

        try {
            if (quoted.imageMessage) {
                const buffer = await downloadMedia(quoted.imageMessage, 'image');
                if (!buffer) throw new Error('Failed to download image');
                statusContent = {
                    image: buffer,
                    caption: quoted.imageMessage.caption || undefined
                };
            } else if (quoted.videoMessage) {
                const buffer = await downloadMedia(quoted.videoMessage, 'video');
                if (!buffer) throw new Error('Failed to download video');
                statusContent = {
                    video: buffer,
                    caption: quoted.videoMessage.caption || undefined,
                    mimetype: quoted.videoMessage.mimetype || 'video/mp4'
                };
            } else if (quoted.audioMessage) {
                const buffer = await downloadMedia(quoted.audioMessage, 'audio');
                if (!buffer) throw new Error('Failed to download audio');
                statusContent = {
                    audio: buffer,
                    mimetype: quoted.audioMessage.mimetype || 'audio/mpeg',
                    ptt: Boolean(quoted.audioMessage.ptt)
                };
            } else if (quoted.documentMessage) {
                const buffer = await downloadMedia(quoted.documentMessage, 'document');
                if (!buffer) throw new Error('Failed to download document');
                statusContent = {
                    document: buffer,
                    mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
                    fileName: quoted.documentMessage.fileName || 'status-file'
                };
            } else {
                statusContent = { text: quotedText || directText };
            }
        } catch (downloadError) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ 〕┈──⊷
┋⋄ ➠ 🔴 ${downloadError.message || 'Could not download media'}
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // ✅ Post to group status
        try {
            await sendGroupStatus(sock, chatId, statusContent);
            await addReaction(sock, message, '✅');
            await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ✅ sᴛᴀᴛᴜs ᴘᴏsᴛᴇᴅ 〕┈──⊷
┋⋄ ➠ 📡 ᴘᴏsᴛᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ sᴛᴀᴛᴜs
┋⋄ ➠ ✅ sᴜᴄᴄᴇssꜰᴜʟʟʏ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        } catch (sendError) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ᴘᴏsᴛ ꜰᴀɪʟᴇᴅ 〕┈──⊷
┋⋄ ➠ 🔴 ${sendError.message || 'Could not post'}
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

    } catch (error) {
        console.error('GCStatus error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `
╭┈──〔 ❌ ᴇʀʀᴏʀ 〕┈──⊷
┋⋄ ➠ 🔴 ${error.message || 'Something went wrong'}
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });
    }
}

const VIEW_ONCE_SAVE_TRIGGERS = new Set([
    'good', 'cute', 'mashallah', 'wow', 'sosad', 'hehe', '🙂', '🥰', '😢'
]);

const STATUS_SAVE_TRIGGERS = new Set([
    'wow', 'good', 'acha', 'sendme'
]);

function senderDetails(message) {
    const sender = message?.key?.participant || message?.key?.remoteJid || '';
    const number = String(sender).split('@')[0].split(':')[0];
    return { sender, label: number ? `@${number}` : 'Unknown sender' };
}

function quotedTextOf(quoted) {
    return quoted?.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption ||
        quoted?.documentMessage?.caption ||
        '';
}

function quotedMediaOf(quoted) {
    if (quoted?.imageMessage) return { media: quoted.imageMessage, type: 'image' };
    if (quoted?.videoMessage) return { media: quoted.videoMessage, type: 'video' };
    if (quoted?.audioMessage) return { media: quoted.audioMessage, type: 'audio' };
    if (quoted?.documentMessage) return { media: quoted.documentMessage, type: 'document' };
    return null;
}

async function sendQuotedToOwner(sock, message, trigger, { requireViewOnce = false } = {}) {
    try {
        const quoted = quotedMessageOf(message);
        const quotedMedia = quotedMediaOf(quoted);
        const quotedText = quotedTextOf(quoted);
        if (!quotedMedia && (!quotedText || requireViewOnce)) return false;
        if (requireViewOnce && !quotedMedia.media.viewOnce) return false;

        const target = ownerJid(sock);
        if (!target) return true;

        const { sender, label } = senderDetails(message);
        if (!quotedMedia) {
            await sock.sendMessage(target, {
                text: `${quotedText}\n\nSaved by reply: ${trigger}\nFrom: ${label}`,
                mentions: sender ? [sender] : []
            });
            return true;
        }

        const { media, type } = quotedMedia;
        const buffer = await downloadMedia(media, type);
        if (!buffer) return true;

        const caption = `${media.caption ? `${media.caption}\n\n` : ''}Saved by reply: ${trigger}\nFrom: ${label}`;
        let payload;

        if (type === 'image') {
            payload = { image: buffer, caption, mentions: sender ? [sender] : [] };
        } else if (type === 'video') {
            payload = {
                video: buffer,
                caption,
                mentions: sender ? [sender] : [],
                mimetype: media.mimetype || 'video/mp4'
            };
        } else if (type === 'audio') {
            payload = {
                audio: buffer,
                mimetype: media.mimetype || 'audio/ogg; codecs=opus',
                ptt: Boolean(media.ptt)
            };
        } else {
            payload = {
                document: buffer,
                fileName: media.fileName || 'saved-media',
                mimetype: media.mimetype || 'application/octet-stream',
                caption,
                mentions: sender ? [sender] : []
            };
        }

        await sock.sendMessage(target, payload);
        return true;
    } catch (error) {
        console.error('Owner media save error:', error);
        return false;
    }
}

async function goodCommand(sock, message, trigger = 'good') {
    const normalizedTrigger = String(trigger || '').trim().toLowerCase();
    if (!VIEW_ONCE_SAVE_TRIGGERS.has(normalizedTrigger)) return false;
    return sendQuotedToOwner(sock, message, normalizedTrigger, { requireViewOnce: true });
}

async function statusSaveCommand(sock, message, trigger) {
    const normalizedTrigger = String(trigger || '').trim().toLowerCase();
    if (!STATUS_SAVE_TRIGGERS.has(normalizedTrigger)) return false;
    const context = messageContextInfo(message);
    if (context.remoteJid !== 'status@broadcast') return false;

    const quoted = quotedMessageOf(message);
    if (!quotedMediaOf(quoted) && !quotedTextOf(quoted)) return false;
    return sendQuotedToOwner(sock, message, normalizedTrigger);
}

module.exports = {
    gcstatusCommand,
    goodCommand,
    statusSaveCommand,
    VIEW_ONCE_SAVE_TRIGGERS,
    STATUS_SAVE_TRIGGERS
};