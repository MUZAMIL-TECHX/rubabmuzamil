const axios = require('axios');
const yts = require('yt-search');

const activeDownloads = new Set();
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
        console.error('Reaction error:', error.message);
    }
}

function cleanFileName(value) {
    return String(value || 'song')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'song';
}

async function downloadBuffer(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*'
        }
    });
    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('json') || contentType.includes('text/html')) {
        throw new Error('The song provider returned an error instead of an MP3.');
    }
    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('Downloaded audio is empty');
    return buffer;
}

async function searchSong(query) {
    const result = await yts(query);
    const video = result?.videos?.[0];
    if (!video?.url) return null;
    return video;
}

async function songCommand(sock, chatId, message) {
    const sender = message.key.participant || message.key.remoteJid;
    if (activeDownloads.has(sender)) {
        await sock.sendMessage(chatId, {
            text: '⏳ Aapki previous song request abhi process ho rahi hai. Please wait.',
            ...channelInfo
        }, { quoted: message });
        return;
    }

    const rawText = message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const query = rawText.replace(/^\.?(?:song|mp3|ytmp3)\b/i, '').trim();

    if (!query) {
        await sock.sendMessage(chatId, {
            text: `╭━━━〔 🎵 *SONG DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .song [name/link]
┃ ❍ Example: .song Atif Aslam
┃ ❍ Fast MP3 : .play [song name]
╰━━━━━━━━━━━━━━━━┈⊷

> 𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });
        return;
    }

    activeDownloads.add(sender);
    try {
        await addReaction(sock, message, '🔍');
        await sock.sendMessage(chatId, {
            text: `🔎 *Searching:* ${query}\n⏳ Please wait...`,
            ...channelInfo
        }, { quoted: message });

        const video = await searchSong(query);
        if (!video) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `❌ No song found for: ${query}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // Thumbnail is sent before the API download so the user can see
        // exactly which result is being processed.
        const previewCaption = `╭━━━〔 🎵 *SONG FOUND* 〕━━━┈⊷
┃ ❍ Title    : ${String(video.title || 'Unknown').slice(0, 55)}
┃ ❍ Duration : ${video.timestamp || 'Unknown'}
┃ ❍ Status   : Downloading... ⏳
╰━━━━━━━━━━━━━━━━┈⊷

> 𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
        await sock.sendMessage(chatId, {
            ...(video.thumbnail
                ? { image: { url: video.thumbnail }, caption: previewCaption }
                : { text: previewCaption }),
            ...channelInfo
        }, { quoted: message });

        // Search with yt-search, then ask the requested provider for its MP3
        // stream using the selected YouTube URL.
        const downloadApi = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(video.url)}`;
        const { data } = await axios.get(downloadApi, {
            timeout: 90000,
            maxContentLength: 2 * 1024 * 1024
        });
        if (data?.status !== true || !data?.audio) {
            throw new Error('The song API did not return an MP3 download link.');
        }

        const audioBuffer = await downloadBuffer(data.audio);
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${cleanFileName(data.title || video.title)}.mp3`,
            ptt: false,
            caption: `╭━━━〔 ✅ *SONG READY* 〕━━━┈⊷
┃ ❍ Title  : ${String(data.title || video.title || 'Song').slice(0, 55)}
┃ ❍ Status : Downloaded ✅
╰━━━━━━━━━━━━━━━━┈⊷

> 𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });
        await addReaction(sock, message, '✅');
    } catch (error) {
        console.error('Song command error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *Song download failed*\n\n${error.message || 'Please try again later.'}`,
            ...channelInfo
        }, { quoted: message });
    } finally {
        activeDownloads.delete(sender);
    }
}

module.exports = songCommand;