const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
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
// APIS - SAME AS BEFORE
// ===============================
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('EliteProTech ytdown returned no download');
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
    throw new Error('Okatsu ytmp3 returned no download');
}

// ===============================
// MAIN SONG COMMAND
// ===============================
async function songCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🔄');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

        if (!text) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('🎵 sᴏɴɢ ᴅʟ', [
                    '📌 ᴜsᴀɢᴇ : .sᴏɴɢ [ɴᴀᴍᴇ/ʟɪɴᴋ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 1 : .sᴏɴɢ ᴀᴛɪꜰ ᴀsʟᴀᴍ',
                    '🔗 ᴇxᴀᴍᴘʟᴇ 2 : .sᴏɴɢ https://youtu.be/xxxxx'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = { url: text };
        } else {
            const search = await yts(text);
            if (!search || !search.videos.length) {
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: box('❌ ɴᴏ sᴏɴɢs ꜰᴏᴜɴᴅ', [
                        `🔍 ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏʀ : ${text}`,
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        // 📸 Send thumbnail FIRST
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                `📌 ᴛɪᴛʟᴇ : ${trim(video.title, 35)}`,
                `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${video.timestamp || 'Unknown'}`,
                `📺 ᴄʜᴀɴɴᴇʟ : ${trim(video.author?.name, 25)}`,
                '━━━━━━━━━━━━━━━━━━',
                '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ...'
            ]),
            ...channelInfo
        }, { quoted: message });

        // 📥 Processing
        await addReaction(sock, message, '📥');

        // Try APIs
        let audioData;
        let audioBuffer;
        let downloadSuccess = false;

        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
            { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                audioData = await apiMethod.method();
                const audioUrl = audioData.download || audioData.dl || audioData.url;

                if (!audioUrl) {
                    console.log(`${apiMethod.name} returned no download URL, trying next API...`);
                    continue;
                }

                try {
                    const audioResponse = await axios.get(audioUrl, {
                        responseType: 'arraybuffer',
                        timeout: 90000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        decompress: true,
                        validateStatus: s => s >= 200 && s < 400,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': '*/*',
                            'Accept-Encoding': 'identity'
                        }
                    });
                    audioBuffer = Buffer.from(audioResponse.data);

                    if (audioBuffer && audioBuffer.length > 0) {
                        downloadSuccess = true;
                        break;
                    }
                } catch (downloadErr) {
                    const statusCode = downloadErr.response?.status || downloadErr.status;
                    if (statusCode === 451) {
                        console.log(`Download blocked (451) from ${apiMethod.name}, trying next...`);
                        continue;
                    }

                    try {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'stream',
                            timeout: 90000,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            validateStatus: s => s >= 200 && s < 400,
                            headers: {
                                'User-Agent': 'Mozilla/5.0',
                                'Accept': '*/*',
                                'Accept-Encoding': 'identity'
                            }
                        });
                        const chunks = [];
                        await new Promise((resolve, reject) => {
                            audioResponse.data.on('data', c => chunks.push(c));
                            audioResponse.data.on('end', resolve);
                            audioResponse.data.on('error', reject);
                        });
                        audioBuffer = Buffer.concat(chunks);

                        if (audioBuffer && audioBuffer.length > 0) {
                            downloadSuccess = true;
                            break;
                        }
                    } catch (streamErr) {
                        console.log(`Stream download failed:`, streamErr.message);
                        continue;
                    }
                }
            } catch (apiErr) {
                console.log(`${apiMethod.name} API failed:`, apiErr.message);
                continue;
            }
        }

        if (!downloadSuccess || !audioBuffer) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀʟʟ sᴏᴜʀᴄᴇs ꜰᴀɪʟᴇᴅ',
                    '💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // Detect format
        const firstBytes = audioBuffer.slice(0, 12);
        const hexSignature = firstBytes.toString('hex');
        const asciiSignature = firstBytes.toString('ascii', 4, 8);

        let fileExtension = 'mp3';
        let detectedFormat = 'unknown';

        if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
            const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
            if (ftypBox === 'ftyp') {
                detectedFormat = 'M4A/MP4';
                fileExtension = 'm4a';
            }
        } else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' ||
                   (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
            detectedFormat = 'MP3';
            fileExtension = 'mp3';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
            detectedFormat = 'OGG/Opus';
            fileExtension = 'ogg';
        } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
            detectedFormat = 'WAV';
            fileExtension = 'wav';
        } else {
            fileExtension = 'm4a';
            detectedFormat = 'Unknown (defaulting to M4A)';
        }

        // Convert to MP3 if needed
        let finalBuffer = audioBuffer;
        let finalExtension = 'mp3';

        if (fileExtension !== 'mp3') {
            try {
                finalBuffer = await toAudio(audioBuffer, fileExtension);
                if (!finalBuffer || finalBuffer.length === 0) {
                    throw new Error('Conversion returned empty buffer');
                }
                finalExtension = 'mp3';
            } catch (convErr) {
                throw new Error(`Failed to convert ${detectedFormat} to MP3: ${convErr.message}`);
            }
        }

        const finalTitle = audioData.title || video.title || 'Song';

        // ✅ Send audio with design
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.${finalExtension}`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');

        // Cleanup
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                const now = Date.now();
                files.forEach(file => {
                    const filePath = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > 10000) {
                            if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                                fs.unlinkSync(filePath);
                            }
                        }
                    } catch (e) {}
                });
            }
        } catch (cleanupErr) {}

    } catch (err) {
        console.error('Song command error:', err);
        await addReaction(sock, message, '❌');

        let errorMsg = 'Unknown error';
        if (err.message && err.message.includes('blocked')) errorMsg = 'Content blocked in your region.';
        else if (err.response?.status === 451) errorMsg = 'Content unavailable (451).';
        else if (err.message && err.message.includes('All download sources failed')) errorMsg = 'All sources failed.';
        else errorMsg = err.message || 'Unknown error';
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
