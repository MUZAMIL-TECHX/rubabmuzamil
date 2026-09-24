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

const processedMessages = new Set();

function formatNumber(num) {
    if (!num) return '0';
    return parseInt(num).toLocaleString();
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text?.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎵 ᴛɪᴋᴛᴏᴋ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .ᴛɪᴋᴛᴏᴋ [ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴛɪᴋᴛᴏᴋ https://...'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        if (!tiktokPatterns.some(p => p.test(url))) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ', [
                    '🔴 ɴᴏᴛ ᴀ ᴠᴀʟɪᴅ ᴛɪᴋᴛᴏᴋ ʟɪɴᴋ',
                    '💡 ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        const apiUrl = `https://api.nexray.eu.cc/downloader/tiktok?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        if (!data.status || !data.result) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴀᴘɪ ꜰᴀɪʟᴇᴅ', [
                    `🔴 ${data.message || 'Could not fetch video'}`,
                    '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const result = data.result;
        const videoUrl = result.data;
        const title = result.title || 'TikTok Video';
        const duration = result.duration || 'Unknown';
        const region = result.region || 'Unknown';

        const views = formatNumber(result.stats?.views);
        const likes = formatNumber(result.stats?.likes);
        const comments = formatNumber(result.stats?.comment);
        const shares = formatNumber(result.stats?.share);
        const saves = formatNumber(result.stats?.save);

        const authorName = result.author?.nickname || result.author?.fullname || 'Unknown';
        const musicTitle = result.music_info?.title || 'Unknown';
        const musicAuthor = result.music_info?.author || 'Unknown';

        if (!videoUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ᴠɪᴅᴇᴏ', [
                    '🔴 ᴄᴏᴜʟᴅ ɴᴏᴛ ᴇxᴛʀᴀᴄᴛ ᴠɪᴅᴇᴏ ᴜʀʟ',
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ʟɪɴᴋ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ===============================
        // 📤 INFO MESSAGE
        // ===============================
        const infoText = box('🎵 ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ', [
            `📌 ᴛɪᴛʟᴇ : ${title.substring(0, 38)}${title.length > 38 ? '...' : ''}`,
            `👤 ᴀᴜᴛʜᴏʀ : ${authorName}`,
            `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${duration}`,
            `🌍 ʀᴇɢɪᴏɴ : ${region}`,
            '━━━━━━━━━━━━━━━━━━',
            `👁️ ᴠɪᴇᴡs : ${views}`,
            `❤️ ʟɪᴋᴇs : ${likes}`,
            `💬 ᴄᴏᴍᴍᴇɴᴛs : ${comments}`,
            `🔄 sʜᴀʀᴇs : ${shares}`,
            `💾 sᴀᴠᴇs : ${saves}`,
            '━━━━━━━━━━━━━━━━━━',
            `🎵 ᴍᴜsɪᴄ : ${musicTitle.substring(0, 30)}`,
            `🎤 ʙʏ : ${musicAuthor}`,
            '━━━━━━━━━━━━━━━━━━',
            '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ...'
        ]);

        await sock.sendMessage(chatId, { text: infoText, ...channelInfo }, { quoted: message });

        // ===============================
        // 📥 DOWNLOAD & SEND
        // ===============================
        try {
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'video/mp4,video/*,*/*;q=0.9',
                    'Referer': 'https://www.tiktok.com/'
                }
            });

            const videoBuffer = Buffer.from(videoResponse.data);
            if (videoBuffer.length === 0) throw new Error('Video buffer is empty');

            const caption = box('✅ ᴠɪᴅᴇᴏ ʀᴇᴀᴅʏ', [
                `📌 ᴛɪᴛʟᴇ : ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
                `👤 ᴀᴜᴛʜᴏʀ : ${authorName}`,
                `👁️ ᴠɪᴇᴡs : ${views}`,
                `❤️ ʟɪᴋᴇs : ${likes}`
            ]);

            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: caption,
                ...channelInfo
            }, { quoted: message });

            await addReaction(sock, message, '✅');

        } catch (downloadError) {
            console.error('Download error:', downloadError.message);

            try {
                const caption = box('⚠️ sᴛʀᴇᴀᴍɪɴɢ ᴠɪᴅᴇᴏ', [
                    `📌 ᴛɪᴛʟᴇ : ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
                    `👤 ᴀᴜᴛʜᴏʀ : ${authorName}`,
                    `👁️ ᴠɪᴇᴡs : ${views}`,
                    `❤️ ʟɪᴋᴇs : ${likes}`
                ]);

                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: caption,
                    ...channelInfo
                }, { quoted: message });

                await addReaction(sock, message, '✅');

            } catch (urlError) {
                console.error('URL method failed:', urlError.message);
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                        '🔴 ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ',
                        '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        }

    } catch (error) {
        console.error('TikTok command error:', error);
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

module.exports = tiktokCommand;