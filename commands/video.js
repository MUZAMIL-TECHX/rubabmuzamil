const axios = require('axios');
const yts = require('yt-search');

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

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// ===============================
// HELPERS
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

function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

function trim(str, n) {
    if (!str) return 'Unknown';
    return str.length > n ? str.slice(0, n) + '...' : str;
}

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// ===============================
// VIDEO APIs
// ===============================
async function getEliteProTechVideoByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech failed');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title };
    }
    throw new Error('Yupra failed');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu failed');
}

async function getArslanVideoByUrl(youtubeUrl) {
    const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.status && res?.data?.result?.download?.url) {
        return {
            download: res.data.result.download.url,
            title: res.data.result.metadata?.title || 'Video'
        };
    }
    throw new Error('Arslan failed');
}

// ===============================
// MAIN VIDEO COMMAND
// ===============================
async function videoCommand(sock, chatId, message) {
    try {
        // 📥 Loading reaction
        await addReaction(sock, message, '📥');

        const messageContent = message.message?.ephemeralMessage?.message || 
                              message.message?.viewOnceMessage?.message || 
                              message.message?.viewOnceMessageV2?.message || 
                              message.message;
        
        const text = (messageContent.conversation || 
                     messageContent.extendedTextMessage?.text || 
                     messageContent.imageMessage?.caption || 
                     messageContent.videoMessage?.caption || '').trim();
        
        const query = text.replace(/^\.video\s+/i, '').trim();

        if (!query || query.toLowerCase() === '.video') {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎬 ᴠɪᴅᴇᴏ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .ᴠɪᴅᴇᴏ [ɴᴀᴍᴇ/ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 1 : .ᴠɪᴅᴇᴏ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔗 ᴇxᴀᴍᴘʟᴇ 2 : .ᴠɪᴅᴇᴏ https://youtu.be/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ⏳ Processing reaction
        await addReaction(sock, message, '⏳');

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';

        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoUrl = query;
            videoTitle = 'YouTube Video';
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            videoThumbnail = ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : '';
        } else {
            const { videos } = await yts(query);
            if (!videos || videos.length === 0) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ɴᴏ ᴠɪᴅᴇᴏs', [
                        `🔍 ɴᴏ ᴠɪᴅᴇᴏs ꜰᴏᴜɴᴅ ꜰᴏʀ : ${query}`,
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // 🎥 Video found
        await addReaction(sock, message, '🎥');

        // 🖼️ Send thumbnail FIRST
        await sock.sendMessage(chatId, {
            image: { url: videoThumbnail || 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' },
            caption: box('🎬 ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ', [
                `📌 ᴛɪᴛʟᴇ : ${trim(videoTitle, 38)}`,
                '━━━━━━━━━━━━━━━━━━',
                '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ...'
            ]),
            ...channelInfo
        }, { quoted: message });

        // 📥 Downloading
        await addReaction(sock, message, '📥');

        let videoData;
        let downloadSuccess = false;

        const apiMethods = [
            { name: 'Arslan', method: () => getArslanVideoByUrl(videoUrl) },
            { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
            { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
            { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                console.log(`🔄 Trying ${apiMethod.name}...`);
                videoData = await apiMethod.method();
                if (videoData.download) {
                    console.log(`✅ ${apiMethod.name} SUCCESS`);
                    downloadSuccess = true;
                    break;
                }
            } catch (err) {
                console.log(`❌ ${apiMethod.name} failed:`, err.message);
            }
        }

        if (!downloadSuccess) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀʟʟ sᴏᴜʀᴄᴇs ꜰᴀɪʟᴇᴅ',
                    '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const finalTitle = videoData.title || videoTitle || 'Video';

        // ✅ Send video with styled caption
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp4`,
            caption: box('✅ ᴠɪᴅᴇᴏ ʀᴇᴀᴅʏ', [
                `📌 ᴛɪᴛʟᴇ : ${trim(finalTitle, 35)}`,
                '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
            ]),
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');
        console.log(`✅ Video sent: ${finalTitle}`);

    } catch (error) {
        console.error('Video error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Unknown error';
        if (errorMsg.length > 80) errorMsg = errorMsg.substring(0, 80) + '...';

        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${errorMsg}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = videoCommand;
