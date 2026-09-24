const axios = require('axios');
const yts = require('yt-search');
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

function trim(str, n) {
    if (!str) return 'Unknown';
    return str.length > n ? str.slice(0, n) + '...' : str;
}

function isValidYoutubeUrl(url) {
    return /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/i.test(url);
}

// ===============================
// ✅ FIXED: BUFFER DOWNLOAD WITH PROPER HEADERS
// ===============================
async function downloadVideoBuffer(url) {
    // ✅ Try 1: Arraybuffer mode
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'video/mp4,video/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity', // ✅ Important for Google Video
                'Connection': 'keep-alive',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com'
            }
        });
        const buf = Buffer.from(res.data);
        if (buf.length > 0) return buf;
        throw new Error('Empty buffer');
    } catch (e1) {
        console.log('⚠️ Arraybuffer failed:', e1.message);

        // ✅ Try 2: Stream mode (better for Google Video)
        const res = await axios.get(url, {
            responseType: 'stream',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'video/mp4,video/*,*/*;q=0.8',
                'Accept-Encoding': 'identity',
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com'
            }
        });

        const chunks = [];
        await new Promise((resolve, reject) => {
            res.data.on('data', c => chunks.push(c));
            res.data.on('end', resolve);
            res.data.on('error', reject);
        });

        const buf = Buffer.concat(chunks);
        if (buf.length > 0) return buf;
        throw new Error('Empty stream buffer');
    }
}

// ===============================
// APIs - MULTIPLE FALLBACK
// ===============================
async function getArslanVideo(url) {
    const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, { timeout: 60000 });
    if (res?.data?.status && res?.data?.result?.download?.url) {
        return {
            download: res.data.result.download.url,
            title: res.data.result.metadata?.title || 'Video'
        };
    }
    throw new Error('Arslan failed');
}

async function getEliteProTechVideo(url) {
    const api = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`;
    const res = await axios.get(api, {
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title || 'Video'
        };
    }
    throw new Error('EliteProTech failed');
}

async function getYupraVideo(url) {
    const api = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`;
    const res = await axios.get(api, {
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title || 'Video'
        };
    }
    throw new Error('Yupra failed');
}

async function tryDownloadApis(url) {
    const apis = [
        { name: 'Arslan', fn: () => getArslanVideo(url) },
        { name: 'EliteProTech', fn: () => getEliteProTechVideo(url) },
        { name: 'Yupra', fn: () => getYupraVideo(url) }
    ];

    for (const api of apis) {
        try {
            const data = await api.fn();
            if (data && data.download) {
                console.log(`✅ ${api.name} API success`);
                return data;
            }
        } catch (err) {
            console.log(`❌ ${api.name} failed:`, err.message);
        }
    }
    return null;
}

// ===============================
// MAIN COMMAND
// ===============================
async function videoCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🎬');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎬 ᴠɪᴅᴇᴏ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .ᴠɪᴅᴇᴏ [ɴᴀᴍᴇ/ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴠɪᴅᴇᴏ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔗 ᴇxᴀᴍᴘʟᴇ : .ᴠɪᴅᴇᴏ https://youtu.be/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const isDirectLink = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');

        let candidates = [];

        if (isDirectLink) {
            if (!isValidYoutubeUrl(searchQuery)) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ', [
                        '🔴 ɴᴏᴛ ᴀ ᴠᴀʟɪᴅ ʏᴏᴜᴛᴜʙᴇ ʟɪɴᴋ',
                        '💡 ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }

            const ytId = (searchQuery.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            candidates.push({
                url: searchQuery,
                title: '',
                thumbnail: ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : '',
                duration: ''
            });
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ɴᴏ ᴠɪᴅᴇᴏs', [
                        `🔍 ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏʀ : ${searchQuery}`,
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }

            candidates = videos
                .filter(v => !v.live)
                .slice(0, 4)
                .map(v => ({
                    url: v.url,
                    title: v.title,
                    thumbnail: v.thumbnail,
                    duration: v.timestamp || 'Unknown'
                }));

            if (candidates.length === 0) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ɴᴏ ᴠɪᴅᴇᴏs', [
                        '🔴 ᴏɴʟʏ ʟɪᴠᴇ sᴛʀᴇᴀᴍs ꜰᴏᴜɴᴅ',
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        }

        // Send preview
        const first = candidates[0];
        if (first.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: first.thumbnail },
                    caption: box('🎬 ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ', [
                        `📌 ᴛɪᴛʟᴇ : ${trim(first.title || searchQuery, 32)}`,
                        `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${first.duration || 'Unknown'}`,
                        '⏳ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ...'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            } catch (e) {
                console.error('Thumbnail error:', e);
            }
        }

        // Try candidates
        let videoData = null;
        let usedCandidate = null;

        for (const candidate of candidates) {
            videoData = await tryDownloadApis(candidate.url);
            if (videoData && videoData.download) {
                usedCandidate = candidate;
                break;
            }
        }

        if (!videoData || !videoData.download) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀʟʟ sᴏᴜʀᴄᴇs ꜰᴀɪʟᴇᴅ',
                    '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        const finalTitle = videoData.title || usedCandidate?.title || searchQuery || 'Video';

        // 📥 Download as buffer (FIXED!)
        await addReaction(sock, message, '📥');

        let videoBuffer;
        try {
            console.log('[VIDEO] Downloading buffer from:', videoData.download.substring(0, 100));
            videoBuffer = await downloadVideoBuffer(videoData.download);
            console.log('[VIDEO] Buffer size:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        } catch (bufferError) {
            console.error('[VIDEO] Buffer download failed:', bufferError.message);

            // ❌ Final fallback: Send URL directly
            try {
                await sock.sendMessage(chatId, {
                    video: { url: videoData.download },
                    mimetype: 'video/mp4',
                    fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp4`,
                    caption: box('⚠️ sᴛʀᴇᴀᴍɪɴɢ ᴠɪᴅᴇᴏ', [
                        `📌 ᴛɪᴛʟᴇ : ${trim(finalTitle, 30)}`,
                        '⚠️ ᴅɪʀᴇᴄᴛ sᴛʀᴇᴀᴍ ᴍᴏᴅᴇ'
                    ]),
                    ...channelInfo
                }, { quoted: message });

                await addReaction(sock, message, '✅');
                return;
            } catch (urlError) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ꜰᴀɪʟᴇᴅ', [
                        `🔴 ${bufferError.message.substring(0, 60)}`,
                        '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        }

        // ✅ Send video buffer
        await sock.sendMessage(chatId, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp4`,
            caption: box('✅ ᴠɪᴅᴇᴏ ʀᴇᴀᴅʏ', [
                `📌 ᴛɪᴛʟᴇ : ${trim(finalTitle, 30)}`,
                `📏 sɪᴢᴇ  : ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`,
                '✅ sᴛᴀᴛᴜs : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ'
            ]),
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('[VIDEO] Error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Unknown error';
        if (error.message?.includes('blocked')) errorMsg = 'Content blocked in your region.';
        else if (error.response?.status === 451) errorMsg = 'Content unavailable (451).';
        else if (error.message?.includes('timeout')) errorMsg = 'Request timeout.';
        else if (error.message?.includes('Failed to fetch')) errorMsg = 'Cannot fetch stream from server.';
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
