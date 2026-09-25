const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs').promises;
const path = require('path');
const { toAudio } = require('../lib/converter');

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
// APIS - ALL WORKING
// ===============================
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech returned no download');
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu returned no download');
}

async function getAlyaDownloadByUrl(youtubeUrl) {
    const res = await axios.get(
        `https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}&apikey=G7I6X7`,
        AXIOS_DEFAULTS
    );
    if (res.data.status && res.data.data.url) {
        return { download: res.data.data.url, title: res.data.data.title };
    }
    throw new Error('Alya failed');
}

async function getVredenDownloadByUrl(youtubeUrl) {
    const res = await axios.get(
        `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
        AXIOS_DEFAULTS
    );
    if (res.data.status && res.data.result.download.url) {
        return {
            download: res.data.result.download.url,
            title: res.data.result.metadata.title
        };
    }
    throw new Error('Vreden failed');
}

// ===============================
// MAIN SONG COMMAND
// ===============================
async function songCommand(sock, chatId, message) {
    try {
        // 📥 Loading reactions
        await addReaction(sock, message, '📥');

        const messageContent = message.message?.ephemeralMessage?.message || 
                              message.message?.viewOnceMessage?.message || 
                              message.message?.viewOnceMessageV2?.message || 
                              message.message;
        
        const text = (messageContent.conversation || 
                     messageContent.extendedTextMessage?.text || 
                     messageContent.imageMessage?.caption || 
                     messageContent.videoMessage?.caption || '').trim();
        
        const query = text.replace(/^\.song\s+/i, '').trim();

        if (!query || query.toLowerCase() === '.song') {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎵 sᴏɴɢ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .sᴏɴɢ [ɴᴀᴍᴇ/ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 1 : .sᴏɴɢ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔗 ᴇxᴀᴍᴘʟᴇ 2 : .sᴏɴɢ https://youtu.be/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ⏳ Processing reaction
        await addReaction(sock, message, '⏳');

        let video;
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            video = { 
                url: query, 
                title: 'YouTube Audio', 
                thumbnail: 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' 
            };
        } else {
            const search = await yts(query);
            if (!search || !search.videos.length) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ɴᴏ ʀᴇsᴜʟᴛs', [
                        `🔍 ɴᴏ sᴏɴɢs ꜰᴏᴜɴᴅ ꜰᴏʀ : ${query}`,
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
            video = search.videos[0];
        }

        // 🎵 Song found
        await addReaction(sock, message, '🎵');

        // 📸 Send thumbnail FIRST
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                `📌 ᴛɪᴛʟᴇ : ${trim(video.title, 38)}`,
                `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${video.timestamp || 'N/A'}`,
                '━━━━━━━━━━━━━━━━━━',
                '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ...'
            ]),
            ...channelInfo
        }, { quoted: message });

        // 📥 Processing
        await addReaction(sock, message, '📥');

        // Try multiple APIs with fallback
        let audioBuffer;
        let downloadSuccess = false;
        let finalTitle = video.title;

        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
            { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) },
            { name: 'Alya', method: () => getAlyaDownloadByUrl(video.url) },
            { name: 'Vreden', method: () => getVredenDownloadByUrl(video.url) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                console.log(`🔄 Trying ${apiMethod.name}...`);
                const audioData = await apiMethod.method();
                const audioUrl = audioData.download;
                finalTitle = audioData.title || video.title;

                if (!audioUrl) continue;

                const audioResponse = await axios.get(audioUrl, {
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Accept-Encoding': 'identity'
                    }
                });

                audioBuffer = Buffer.from(audioResponse.data);

                if (audioBuffer && audioBuffer.length > 0) {
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

        // Detect format and convert if needed
        const firstBytes = audioBuffer.slice(0, 4).toString('hex');
        let fileExtension = 'mp3';
        if (firstBytes.startsWith('000000') || audioBuffer.slice(4, 8).toString('ascii') === 'ftyp') {
            fileExtension = 'm4a';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
            fileExtension = 'ogg';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
            fileExtension = 'wav';
        }

        let finalBuffer = audioBuffer;
        let finalExtension = 'mp3';

        if (fileExtension !== 'mp3') {
            console.log(`🎛️ Converting ${fileExtension} → mp3...`);
            finalBuffer = await toAudio(audioBuffer, fileExtension);
            if (!finalBuffer || finalBuffer.length === 0) {
                throw new Error('Conversion returned empty buffer');
            }
        }

        // ✅ Send audio with styled caption
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.${finalExtension}`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');
        console.log(`✅ Song sent: ${finalTitle}`);

    } catch (err) {
        console.error('Song command error:', err);
        await addReaction(sock, message, '❌');

        let errorMsg = err.message || 'Unknown error';
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

module.exports = songCommand;
