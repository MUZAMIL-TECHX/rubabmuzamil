const axios = require('axios');

// ═══════════════════════════════════════════════════════════
//                    🎯 CHANNEL INFO
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
//                    🛠️ HELPERS
// ═══════════════════════════════════════════════════════════
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

function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

// ═══════════════════════════════════════════════════════════
//                    🔍 SEARCH - SIPUTZX
// ═══════════════════════════════════════════════════════════
async function searchSong(query) {
    const apiUrl = `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`;
    console.log(`🔍 [Search] ${query}`);
    
    const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.data.status || !response.data.data || response.data.data.length === 0) {
        throw new Error('No results');
    }

    const videoResult = response.data.data.find(item => item.type === 'video');
    if (!videoResult) throw new Error('No video found');

    console.log(`✅ [Search] Found: ${videoResult.title}`);
    
    return {
        title: videoResult.title,
        url: videoResult.url,
        thumbnail: videoResult.thumbnail || videoResult.image,
        timestamp: videoResult.timestamp,
        views: videoResult.views,
        author: videoResult.author?.name || 'Unknown'
    };
}

// ═══════════════════════════════════════════════════════════
//                    🎵 GET DOWNLOAD URLs (MULTIPLE SOURCES)
// ═══════════════════════════════════════════════════════════
async function getArslanAudio(youtubeUrl) {
    const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.data.status && response.data.result?.download?.url) {
        return {
            downloadUrl: response.data.result.download.url,
            title: response.data.result.metadata?.title || 'Audio'
        };
    }
    throw new Error('Arslan failed');
}

async function getYupraAudio(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.data.success && response.data.data?.download_url) {
        return {
            downloadUrl: response.data.data.download_url,
            title: response.data.data.title || 'Audio'
        };
    }
    throw new Error('Yupra failed');
}

async function getOkatsuAudio(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.data.dl) {
        return {
            downloadUrl: response.data.dl,
            title: response.data.title || 'Audio'
        };
    }
    throw new Error('Okatsu failed');
}

async function getEliteProTechAudio(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (response.data.success && response.data.downloadURL) {
        return {
            downloadUrl: response.data.downloadURL,
            title: response.data.title || 'Audio'
        };
    }
    throw new Error('EliteProTech failed');
}

// ✅ Try ALL APIs until one works
async function getAudioDownloadUrl(youtubeUrl) {
    const apis = [
        { name: 'Arslan', fn: () => getArslanAudio(youtubeUrl) },
        { name: 'Yupra', fn: () => getYupraAudio(youtubeUrl) },
        { name: 'Okatsu', fn: () => getOkatsuAudio(youtubeUrl) },
        { name: 'EliteProTech', fn: () => getEliteProTechAudio(youtubeUrl) }
    ];

    for (const api of apis) {
        try {
            console.log(`🔄 Trying ${api.name}...`);
            const data = await api.fn();
            console.log(`✅ ${api.name} SUCCESS`);
            return data;
        } catch (err) {
            console.log(`❌ ${api.name} failed: ${err.message}`);
        }
    }

    throw new Error('All download APIs failed');
}

// ═══════════════════════════════════════════════════════════
//                    📥 BUFFER DOWNLOAD (FIXED FOR 123tokyo)
// ═══════════════════════════════════════════════════════════
async function downloadAudioBuffer(url) {
    console.log(`📥 [Buffer] Downloading from: ${url.substring(0, 80)}...`);

    // ✅ FIX: Try multiple download strategies
    const strategies = [
        // Strategy 1: Arraybuffer with proper headers
        async () => {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                decompress: true,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'audio/mpeg,audio/*,video/*,*/*;q=0.8',
                    'Accept-Encoding': 'identity',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive'
                }
            });
            return Buffer.from(response.data);
        },
        
        // Strategy 2: Stream mode
        async () => {
            const response = await axios.get(url, {
                responseType: 'stream',
                timeout: 120000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity'
                }
            });
            
            const chunks = [];
            for await (const chunk of response.data) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        },
        
        // Strategy 3: Follow redirects manually
        async () => {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxRedirects: 10,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept-Encoding': 'identity'
                }
            });
            return Buffer.from(response.data);
        }
    ];

    let lastError;
    for (let i = 0; i < strategies.length; i++) {
        try {
            console.log(`🔄 [Strategy ${i + 1}] Trying...`);
            const buffer = await strategies[i]();
            
            if (buffer && buffer.length > 0) {
                console.log(`✅ [Strategy ${i + 1}] Success: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
                return buffer;
            }
        } catch (err) {
            console.log(`❌ [Strategy ${i + 1}] Failed: ${err.message}`);
            lastError = err;
        }
    }

    throw lastError || new Error('All download strategies failed');
}

// ═══════════════════════════════════════════════════════════
//                    🚀 MAIN PLAY COMMAND
// ═══════════════════════════════════════════════════════════
async function playCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';
        
        const query = text.replace(/^\.(?:play|song|music|mp3|ytmp3)\b/i, '').trim();

        if (!query) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('🎵 ᴘʟᴀʏ ᴄᴏᴍᴍᴀɴᴅ', [
                    '📌 ᴜsᴀɢᴇ : .ᴘʟᴀʏ [sᴏɴɢ ɴᴀᴍᴇ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 1 : .ᴘʟᴀʏ ᴘᴀsᴏᴏʀɪ',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 2 : .ᴘʟᴀʏ ᴀᴛɪꜰ ᴀsʟᴀᴍ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ═══════════════════════════════════════
        // STEP 1: SEARCH
        // ═══════════════════════════════════════
        await addReaction(sock, message, '🔍');

        let songData;
        try {
            songData = await searchSong(query);
        } catch (searchError) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ʀᴇsᴜʟᴛs', [
                    `🔍 ɴᴏ sᴏɴɢ ꜰᴏᴜɴᴅ ꜰᴏʀ : ${query}`,
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅs'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        await addReaction(sock, message, '🎵');

        // ═══════════════════════════════════════
        // STEP 2: SEND THUMBNAIL FIRST
        // ═══════════════════════════════════════
        try {
            await sock.sendMessage(chatId, {
                image: { url: songData.thumbnail },
                caption: box('🎵 sᴏɴɢ ꜰᴏᴜɴᴅ', [
                    `📌 ᴛɪᴛʟᴇ : ${trim(songData.title, 38)}`,
                    `⏱️ ᴅᴜʀᴀᴛɪᴏɴ : ${songData.timestamp || 'N/A'}`,
                    `📺 ᴄʜᴀɴɴᴇʟ : ${trim(songData.author, 25)}`,
                    `👁️ ᴠɪᴇᴡs : ${formatViews(songData.views)}`,
                    '━━━━━━━━━━━━━━━━━━',
                    '⏳ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ...'
                ]),
                ...channelInfo
            }, { quoted: message });
        } catch (thumbError) {
            console.error('Thumbnail error:', thumbError.message);
        }

        // ═══════════════════════════════════════
        // STEP 3: GET DOWNLOAD URL (ALL APIs)
        // ═══════════════════════════════════════
        await addReaction(sock, message, '📥');

        let audioData;
        try {
            audioData = await getAudioDownloadUrl(songData.url);
        } catch (urlError) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀʟʟ ᴀᴜᴅɪᴏ ᴀᴘɪs ꜰᴀɪʟᴇᴅ',
                    '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ═══════════════════════════════════════
        // STEP 4: DOWNLOAD AS BUFFER (3 STRATEGIES)
        // ═══════════════════════════════════════
        let audioBuffer;
        try {
            audioBuffer = await downloadAudioBuffer(audioData.downloadUrl);
        } catch (bufferError) {
            console.error('All buffer strategies failed:', bufferError.message);
            
            // ✅ Last resort: Direct URL
            try {
                await sock.sendMessage(chatId, {
                    audio: { url: audioData.downloadUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${audioData.title.replace(/[^\w\s-]/g, '')}.mp3`,
                    ptt: false,
                    ...channelInfo
                }, { quoted: message });

                await addReaction(sock, message, '✅');
                return;
            } catch (finalError) {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, {
                    text: box('❌ ꜰᴀɪʟᴇᴅ', [
                        '🔴 ᴄᴏᴜʟᴅ ɴᴏᴛ ᴅᴏᴡɴʟᴏᴀᴅ sᴏɴɢ',
                        '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴏɴɢ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
            }
        }

        // ═══════════════════════════════════════
        // STEP 5: SEND AUDIO
        // ═══════════════════════════════════════
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${audioData.title.replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');
        console.log(`✅ Song sent: ${audioData.title}`);

    } catch (error) {
        console.error('❌ Play command error:', error);
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

module.exports = playCommand;
