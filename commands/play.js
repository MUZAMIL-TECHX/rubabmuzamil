const yts = require('yt-search');
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

// ===============================
// HELPER: Add Reaction
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

// ===============================
// HELPER: Box Builder
// ===============================
function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

function cleanFileName(value) {
    return String(value || 'song')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'song';
}

function trimTitle(title, max = 38) {
    if (!title) return 'Unknown';
    return title.length > max ? title.slice(0, max) + '...' : title;
}

// ===============================
// DOWNLOAD AUDIO HELPER (Buffer Safe)
// ===============================
async function downloadAudio(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'audio/*,*/*;q=0.8'
        }
    });

    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('json') || contentType.includes('text/html')) {
        throw new Error('Provider returned error instead of MP3');
    }

    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('Downloaded MP3 is empty');
    return buffer;
}

// ===============================
// API #1: Ziaul API (Primary)
// ===============================
async function getZiaulAudio(query) {
    const apiUrl = `https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl, {
        timeout: 90000,
        maxContentLength: 2 * 1024 * 1024
    });
    const result = response.data?.result;
    if (response.data?.status === true && result?.downloadUrl) {
        return {
            downloadUrl: result.downloadUrl,
            title: result.title || query,
            duration: result.duration || 'Unknown',
            quality: result.quality || 'MP3',
            thumbnail: result.thumbnail || ''
        };
    }
    throw new Error('Ziaul API failed');
}

// ===============================
// API #2: Hectormanuel API (Fallback)
// ===============================
async function getHectorAudio(youtubeUrl) {
    const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, { timeout: 90000 });
    const data = response.data;
    if (data?.status && data.audio) {
        return {
            downloadUrl: data.audio,
            title: data.title || 'Song',
            duration: data.duration || 'Unknown',
            quality: 'MP3',
            thumbnail: ''
        };
    }
    throw new Error('Hector API failed');
}

// ===============================
// MAIN PLAY COMMAND
// ===============================
async function playCommand(sock, chatId, message) {
    try {
        // 🎵 Start reaction
        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.replace(/^\.(?:play|song|music|sound)\b/i, '').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎵 ᴘʟᴀʏ ᴄᴏᴍᴍᴀɴᴅ', [
                    '📌 ᴜsᴀɢᴇ : .ᴘʟᴀʏ [sᴏɴɢ ɴᴀᴍᴇ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴘʟᴀʏ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔍 ᴇxᴀᴍᴘʟᴇ : .ᴘʟᴀʏ ꜰᴀᴅᴇᴅ ᴀʟᴀɴ ᴡᴀʟᴋᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // 🔍 Search on YouTube
        await addReaction(sock, message, '🔍');

        let video = null;
        let audioData = null;
        let usedApi = '';

        // ===============================
        // TRY API #1: Ziaul
        // ===============================
        try {
            console.log('[PLAY] Trying Ziaul API...');
            audioData = await getZiaulAudio(searchQuery);
            usedApi = 'Ziaul';
            console.log('✅ Ziaul API success');
        } catch (apiError1) {
            console.log('❌ Ziaul API failed:', apiError1.message);

            // Fallback: Search YouTube and use Hector API
            try {
                const { videos } = await yts(searchQuery);
                if (!videos || videos.length === 0) {
                    await addReaction(sock, message, '❌');
                    return await sock.sendMessage(chatId, {
                        text: box('❌ ɴᴏ sᴏɴɢs ꜰᴏᴜɴᴅ', [
                            `🔍 ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏʀ : ${searchQuery}`,
                            '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                        ]),
                        ...channelInfo
                    }, { quoted: message });
                }

                video = videos[0];
                console.log('[PLAY] Trying Hector API...');
                const hectorData = await getHectorAudio(video.url);
                audioData = {
                    downloadUrl: hectorData.downloadUrl,
                    title: hectorData.title || video.title,
                    duration: video.timestamp || hectorData.duration,
                    quality: 'MP3',
                    thumbnail: video.thumbnail
                };
                usedApi = 'Hector';
                console.log('✅ Hector API success');

            } catch (apiError2) {
                console.log('❌ Hector API failed:', apiError2.message);
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ᴀᴘɪ ꜰᴀɪʟᴇᴅ', [
                        '🔴 ᴀʟʟ ᴀᴘɪs ᴀʀᴇ ᴅᴏᴡɴ',
                        '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        }

        const finalTitle = audioData.title || searchQuery;

        // ===============================
        // SEND PREVIEW
        // ===============================
        try {
            const previewCaption = box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                `📌 ᴛɪᴛʟᴇ : ${trimTitle(finalTitle, 35)}`,
                `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${audioData.duration || 'Unknown'}`,
                `🎚️ ǫᴜᴀʟɪᴛʏ : ${audioData.quality || 'MP3'}`,
                '━━━━━━━━━━━━━━━━━━',
                '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴍᴘ3...'
            ]);

            if (audioData.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: audioData.thumbnail },
                    caption: previewCaption,
                    ...channelInfo
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: previewCaption,
                    ...channelInfo
                }, { quoted: message });
            }
        } catch (e) {
            console.error('Preview error:', e);
        }

        // 📥 Download reaction
        await addReaction(sock, message, '📥');

        // ===============================
        // DOWNLOAD AS BUFFER (Safe)
        // ===============================
        let audioBuffer;
        try {
            audioBuffer = await downloadAudio(audioData.downloadUrl);
        } catch (downloadError) {
            console.error('Buffer download failed, trying URL method:', downloadError.message);

            // Fallback: Send via URL
            await sock.sendMessage(chatId, {
                audio: { url: audioData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${cleanFileName(finalTitle)}.mp3`,
                ptt: false,
                ...channelInfo
            }, { quoted: message });

            await addReaction(sock, message, '✅');
            return;
        }

        // ===============================
        // SEND AUDIO
        // ===============================
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${cleanFileName(finalTitle)}.mp3`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error in play command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${error.message || 'Download failed'}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = playCommand;
