const { igdl } = require("ruhend-scraper");

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

const processedMessages = new Set();

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

function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();
    for (const media of mediaData) {
        if (!media.url) continue;
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    return uniqueMedia;
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        await addReaction(sock, message, '📸');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text?.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('📸 ɪɴsᴛᴀɢʀᴀᴍ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .ɪɴsᴛᴀɢʀᴀᴍ [ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ɪɴsᴛᴀɢʀᴀᴍ https://www.instagram.com/p/xxxxx',
                    '━━━━━━━━━━━━━━━━━━',
                    '✅ ᴠᴀʟɪᴅ ꜰᴏʀᴍᴀᴛs:',
                    '• instagram.com/p/xxxxx',
                    '• instagram.com/reel/xxxxx',
                    '• instagram.com/tv/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//
        ];

        if (!instagramPatterns.some(p => p.test(url))) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ', [
                    '🔴 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ɪɴsᴛᴀɢʀᴀᴍ ʟɪɴᴋ',
                    '✅ ꜰᴏʀᴍᴀᴛs:',
                    '• instagram.com/p/xxxxx',
                    '• instagram.com/reel/xxxxx',
                    '• instagram.com/tv/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        const downloadData = await igdl(url);

        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ᴍᴇᴅɪᴀ ꜰᴏᴜɴᴅ', [
                    '🔴 ᴘᴏsᴛ ᴍɪɢʜᴛ ʙᴇ ᴘʀɪᴠᴀᴛᴇ ᴏʀ ɪɴᴠᴀʟɪᴅ',
                    '💡 ᴛʀʏ:',
                    '• ᴄʜᴇᴄᴋ ɪꜰ ᴘᴏsᴛ ɪs ᴘᴜʙʟɪᴄ',
                    '• ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ʟɪɴᴋ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const mediaData = downloadData.data;
        const uniqueMedia = extractUniqueMedia(mediaData);
        const mediaToDownload = uniqueMedia.slice(0, 20);

        if (mediaToDownload.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ᴠᴀʟɪᴅ ᴍᴇᴅɪᴀ', ['🔴 ɴᴏ ᴠᴀʟɪᴅ ᴍᴇᴅɪᴀ ꜰᴏᴜɴᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ']),
                ...channelInfo
            }, { quoted: message });
        }

        // Send count message
        await sock.sendMessage(chatId, {
            text: box('📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ', [
                `📊 ᴛᴏᴛᴀʟ : ${mediaToDownload.length} ᴍᴇᴅɪᴀ(s)`,
                '⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ...'
            ]),
            ...channelInfo
        }, { quoted: message });

        // Download all media
        for (let i = 0; i < mediaToDownload.length; i++) {
            try {
                const media = mediaToDownload[i];
                const mediaUrl = media.url;

                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || 
                              media.type === 'video' || 
                              url.includes('/reel/') || 
                              url.includes('/tv/');

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: "video/mp4",
                        caption: box('📹 ᴠɪᴅᴇᴏ', [
                            `📊 ᴍᴇᴅɪᴀ : ${i + 1}/${mediaToDownload.length}`,
                            '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
                        ]),
                        ...channelInfo
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: box('📸 ɪᴍᴀɢᴇ', [
                            `📊 ᴍᴇᴅɪᴀ : ${i + 1}/${mediaToDownload.length}`,
                            '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
                        ]),
                        ...channelInfo
                    }, { quoted: message });
                }

                if (i < mediaToDownload.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (mediaError) {
                console.error(`Error downloading media ${i + 1}:`, mediaError);
            }
        }

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Instagram command error:', error);
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

module.exports = instagramCommand;