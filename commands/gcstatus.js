const {
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

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
    // The connected WhatsApp account is the owner for this session. Do not
    // use settings.ownerNumber here: a copied/default setting can point to a
    // different account and makes saved media land in the wrong inbox.
    const connected = String(sock?.user?.id || sock?.user?.jid || '')
        .split('@')[0]
        .split(':')[0]
        .replace(/[^\d]/g, '');
    return connected ? `${connected}@s.whatsapp.net` : null;
}

async function sendGroupStatus(sock, groupJid, content) {
    if (!groupJid?.endsWith('@g.us')) {
        throw new Error('This command can only be used in a group.');
    }

    try {
        // Create the message with proper upload function
        const messageSecret = crypto.randomBytes(32);
        const innerMessage = await generateWAMessageContent(content, {
            upload: async (buffer, type) => {
                // Fallback upload if waUploadToServer is not available
                if (typeof sock.waUploadToServer === 'function') {
                    return sock.waUploadToServer(buffer, type);
                }
                // Alternative upload method
                const { upload } = require('@whiskeysockets/baileys');
                return upload(buffer, type);
            }
        });

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
    } catch (error) {
        console.error('Send group status error:', error);
        throw new Error(`Failed to post status: ${error.message}`);
    }
}

async function gcstatusCommand(sock, chatId, message, commandText = '') {
    try {
        await addReaction(sock, message, '📡');

        if (!chatId?.endsWith('@g.us')) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *GROUP ONLY* 〕━━━┈⊷
┃ ❍ This command can only be used in a group
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
            return;
        }

        const quoted = quotedMessageOf(message);
        const media = quoted.imageMessage || quoted.videoMessage || quoted.audioMessage || quoted.documentMessage;
        const quotedText = quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';
        const directText = String(commandText || '').trim();

        if (!media && !quotedText && !directText) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO REPLY* 〕━━━┈⊷
┃ ❍ Reply to an image, video, audio,
┃ ❍ document, or text with .gcstatus
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
            return;
        }

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
╭━━━〔 ❌ *DOWNLOAD FAILED* 〕━━━┈⊷
┃ ❍ ${downloadError.message || 'Could not download media'}
┃ ❍ Please try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
            return;
        }

        // Send to group status
        try {
            await sendGroupStatus(sock, chatId, statusContent);
            await addReaction(sock, message, '✅');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ✅ *STATUS POSTED* 〕━━━┈⊷
┃ ❍ Posted to group status successfully
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        } catch (sendError) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *POST FAILED* 〕━━━┈⊷
┃ ❍ ${sendError.message || 'Could not post to group status'}
┃ ❍ Please try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

    } catch (error) {
        console.error('GCStatus error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ ${error.message || 'Something went wrong'}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });
    }
}

const VIEW_ONCE_SAVE_TRIGGERS = new Set([
    'good',
    'cute',
    'mashallah',
    'wow',
    'sosad',
    'hehe',
    '🙂',
    '🥰',
    '😢'
]);

const STATUS_SAVE_TRIGGERS = new Set([
    'wow',
    'good',
    'acha',
    'sendme'
]);

function senderDetails(message) {
    const sender = message?.key?.participant || message?.key?.remoteJid || '';
    const number = String(sender).split('@')[0].split(':')[0];
    return {
        sender,
        label: number ? `@${number}` : 'Unknown sender'
    };
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

// Replying to a view-once image, video, or voice note with any supported
// trigger saves it in the inbox of the currently connected account.
async function goodCommand(sock, message, trigger = 'good') {
    const normalizedTrigger = String(trigger || '').trim().toLowerCase();
    if (!VIEW_ONCE_SAVE_TRIGGERS.has(normalizedTrigger)) return false;
    return sendQuotedToOwner(sock, message, normalizedTrigger, { requireViewOnce: true });
}

// A status reply has contextInfo.remoteJid === status@broadcast in Baileys.
// Only status replies are handled here, so "wow"/"good" in an ordinary chat
// remains available to the normal bot/chatbot flow.
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
