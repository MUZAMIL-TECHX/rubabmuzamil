const axios = require('axios');
const yts = require('yt-search');
const https = require('node:https');

const activeDownloads = new Set();
const SEARCH_TIMEOUT_MS = 12000;
const API_TIMEOUT_MS = 30000;
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 12 });
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

function withTimeout(promise, timeoutMs, label) {
    let timer;
    return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const error = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
                error.code = 'ETIMEDOUT';
                reject(error);
            }, timeoutMs);
            timer.unref?.();
        })
    ]).finally(() => clearTimeout(timer));
}

async function searchSong(query) {
    // Skip a search round trip when the user already supplied a YouTube URL.
    if (/^https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be)\//i.test(query)) {
        return { title: 'YouTube audio', url: query };
    }
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
    const totalStartedAt = Date.now();
    let phase = 'YouTube search';
    let phaseStartedAt = totalStartedAt;
    const logPhase = nextPhase => {
        const now = Date.now();
        console.info(`[.song timing] ${phase}: ${now - phaseStartedAt}ms; total ${now - totalStartedAt}ms`);
        phase = nextPhase;
        phaseStartedAt = now;
    };

    try {
        // Start the status send without making search wait for WhatsApp's
        // acknowledgement. The old remote-thumbnail preview blocked the
        // downloader from even starting, so keep this first message text-only.
        sock.sendMessage(chatId, {
            text: `🔎 *Searching and preparing MP3:* ${query}\n⏳ Please wait...`,
            ...channelInfo
        }, { quoted: message }).catch(error => {
            console.warn('[.song] Could not send progress message:', error.message);
        });

        const video = await withTimeout(
            searchSong(query),
            SEARCH_TIMEOUT_MS,
            'YouTube search'
        );
        logPhase('Hector download API');
        if (!video) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `❌ No song found for: ${query}`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const downloadApi = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(video.url)}`;
        const { data } = await axios.get(downloadApi, {
            timeout: API_TIMEOUT_MS,
            maxContentLength: 2 * 1024 * 1024,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
        });
        if (data?.status !== true || !data?.audio) {
            throw new Error('The song API did not return an MP3 download link.');
        }

        let audioUrl;
        try {
            audioUrl = new URL(data.audio);
        } catch {
            throw new Error('The song API returned an invalid MP3 link.');
        }
        if (audioUrl.protocol !== 'https:') {
            throw new Error('The song API returned an insecure MP3 link.');
        }

        // Pass the provider URL to Baileys instead of downloading the entire
        // MP3 into this process first. Baileys can fetch and prepare the media
        // as part of its upload, avoiding an extra full-file buffer/copy here.
        logPhase('Media stream and WhatsApp send');
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl.toString() },
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
        logPhase('completed');
    } catch (error) {
        console.error(`[.song] Failed during ${phase} after ${Date.now() - phaseStartedAt}ms (total ${Date.now() - totalStartedAt}ms):`, error);
        await addReaction(sock, message, '❌');
        const timedOut = error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' ||
            /timeout|timed out/i.test(error.message || '');
        const errorText = timedOut
            ? `⏱️ ${phase} timed out. The provider or connection is slow; please try again shortly.`
            : error.message || 'Please try again later.';
        await sock.sendMessage(chatId, {
            text: `❌ *Song download failed*\n\n${errorText}`,
            ...channelInfo
        }, { quoted: message });
    } finally {
        activeDownloads.delete(sender);
    }
}

module.exports = songCommand;
