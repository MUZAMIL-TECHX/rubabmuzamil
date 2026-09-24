const axios = require('axios');
const yts = require('yt-search');
const { toAudio } = require('../lib/converter');
const { downloadAudioFromYts } = require('./yts');

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

function detectExtension(buffer) {
    if (buffer.toString('ascii', 0, 3) === 'ID3' ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'mp3';
    if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
    if (buffer.toString('ascii', 0, 4) === 'RIFF') return 'wav';
    if (buffer.slice(4, 8).toString('ascii') === 'ftyp') return 'm4a';
    return 'm4a';
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
    const query = rawText.replace(/^\.?(?:song|play)\b/i, '').trim();

    if (!query) {
        await sock.sendMessage(chatId, {
            text: `╭━━━〔 🎵 *SONG DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .song [name/link]
┃ ❍ Example: .song Atif Aslam
┃ ❍ Alias  : .play [name/link]
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
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `╭━━━〔 🎵 *SONG FOUND* 〕━━━┈⊷
┃ ❍ Title    : ${String(video.title || 'Unknown').slice(0, 55)}
┃ ❍ Duration : ${video.timestamp || 'Unknown'}
┃ ❍ Status   : Downloading... ⏳
╰━━━━━━━━━━━━━━━━┈⊷

> 𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });

        // Keep the download providers in yts.js as the single source of
        // truth. This uses its Arslan/Yupra MP3 fallback chain.
        const audioData = await downloadAudioFromYts(video.url);
        if (!audioData?.download) throw new Error('All audio sources failed');

        const audioBuffer = await downloadBuffer(audioData.download);
        const inputExtension = detectExtension(audioBuffer);
        const finalBuffer = inputExtension === 'mp3'
            ? audioBuffer
            : await toAudio(audioBuffer, inputExtension);

        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${cleanFileName(audioData.title || video.title)}.mp3`,
            ptt: false,
            caption: `╭━━━〔 ✅ *SONG READY* 〕━━━┈⊷
┃ ❍ Title  : ${String(audioData.title || video.title || 'Song').slice(0, 55)}
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