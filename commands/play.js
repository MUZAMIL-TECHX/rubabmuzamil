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
//                    🔍 SEARCH APIs (3 FALLBACK)
// ═══════════════════════════════════════════════════════════
async function searchSiputzx(query) {
    const apiUrl = `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.data.status || !response.data.data?.length) throw new Error('No results');
    const videoResult = response.data.data.find(item => item.type === 'video');
    if (!videoResult) throw new Error('No video');
    return {
        title: videoResult.title,
        url: videoResult.url,
        thumbnail: videoResult.thumbnail || videoResult.image,
        timestamp: videoResult.timestamp,
        views: videoResult.views,
        author: videoResult.author?.name || 'Unknown'
    };
}

async function searchYupra(query) {
    const apiUrl = `https://api.yupra.my.id/api/search/youtube?q=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.data.success || !response.data.data?.length) throw new Error('No results');
    const vid = response.data.data[0];
    return {
        title: vid.title || 'Unknown',
        url: vid.url || `https://youtube.com/watch?v=${vid.videoId}`,
        thumbnail: vid.thumbnail || vid.image,
        timestamp: vid.timestamp || 'Unknown',
        views: vid.views || 0,
        author: vid.author?.name || 'Unknown'
    };
}

async function searchYts(query) {
    const yts = require('yt-search');
    const { videos } = await yts(query);
    if (!videos || videos.length === 0) throw new Error('No results');
    const v = videos[0];
    return {
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail,
        timestamp: v.timestamp,
        views: v.views,
        author: v.author?.name || 'Unknown'
    };
}

async function searchSong(query) {
    const searchers = [
        { name: 'Siputzx', fn: () => searchSiputzx(query) },
        { name: 'Yupra', fn: () => searchYupra(query) },
        { name: 'yt-search', fn: () => searchYts(query) }
    ];

    for (const searcher of searchers) {
        try {
            console.log(`🔍 Trying ${searcher.name}...`);
            const data = await searcher.fn();
            console.log(`✅ ${searcher.name} SUCCESS: ${data.title}`);
            return data;
        } catch (err) {
            console.log(`❌ ${searcher.name} failed: ${err.message}`);
        }
    }

    throw new Error('All search APIs failed');
}

// ═══════════════════════════════════════════════════════════
//                    🎵 AUDIO DOWNLOAD APIs (5 FALLBACK)
// ═══════════════════════════════════════════════════════════
async function audioArslan(youtubeUrl) {
    const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(apiUrl, { timeout: 30000 });
    if (res.data.status && res.data.result?.download?.url) {
        return { url: res.data.result.download.url, title: res.data.result.metadata?.title || 'Audio' };
    }
    throw new Error('Arslan failed');
}

async function audioYupra(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(apiUrl, { timeout: 30000 });
    if (res.data.success && res.data.data?.download_url) {
        return { url: res.data.data.download_url, title: res.data.data.title || 'Audio' };
    }
    throw new Error('Yupra failed');
}

async function audioOkatsu(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(apiUrl, { timeout: 30000 });
    if (res.data.dl) {
        return { url: res.data.dl, title: res.data.title || 'Audio' };
    }
    throw new Error('Okatsu failed');
}

async function audioEliteProTech(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await axios.get(apiUrl, { timeout: 30000 });
    if (res.data.success && res.data.downloadURL) {
        return { url: res.data.downloadURL, title: res.data.title || 'Audio' };
    }
    throw new Error('EliteProTech failed');
}

async function audioAlya(youtubeUrl) {
    const apiUrl = `https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}&apikey=G7I6X7`;
    const res = await axios.get(apiUrl, { timeout: 30000 });
    if (res.data.status && res.data.data?.url) {
        return { url: res.data.data.url, title: res.data.data.title || 'Audio' };
    }
    throw new Error('Alya failed');
}

async function getAudioUrl(youtubeUrl) {
    const apis = [
        { name: 'Arslan', fn: () => audioArslan(youtubeUrl) },
        { name: 'Yupra', fn: () => audioYupra(youtubeUrl) },
        { name: 'Okatsu', fn: () => audioOkatsu(youtubeUrl) },
        { name: 'EliteProTech', fn: () => audioEliteProTech(youtubeUrl) },
        { name: 'Alya', fn: () => audioAlya(youtubeUrl) }
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
    throw new Error('All audio APIs failed');
}

// ═══════════════════════════════════════════════════════════
//                    📥 DOWNLOAD BUFFER (5 STRATEGIES)
// ═══════════════════════════════════════════════════════════
async function downloadBuffer(url) {
    console.log(`📥 [Download] ${url.substring(0, 80)}...`);

    // Strategy 1: Arraybuffer
    try {
        console.log('🔄 [Strategy 1] Arraybuffer...');
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
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 0) {
            console.log(`✅ [Strategy 1] ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
            return buf;
        }
    } catch (err) {
        console.log(`❌ [Strategy 1] ${err.message}`);
    }

    // Strategy 2: Stream
    try {
        console.log('🔄 [Strategy 2] Stream...');
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
        for await (const chunk of response.data) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf && buf.length > 0) {
            console.log(`✅ [Strategy 2] ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
            return buf;
        }
    } catch (err) {
        console.log(`❌ [Strategy 2] ${err.message}`);
    }

    // Strategy 3: Redirects
    try {
        console.log('🔄 [Strategy 3] Redirects...');
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxRedirects: 15,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept-Encoding': 'identity'
            }
        });
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 0) {
            console.log(`✅ [Strategy 3] ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
            return buf;
        }
    } catch (err) {
        console.log(`❌ [Strategy 3] ${err.message}`);
    }

    // Strategy 4: HTTP
    try {
        console.log('🔄 [Strategy 4] HTTP...');
        const httpUrl = url.replace('https://', 'http://');
        const response = await axios.get(httpUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 0) {
            console.log(`✅ [Strategy 4] ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
            return buf;
        }
    } catch (err) {
        console.log(`❌ [Strategy 4] ${err.message}`);
    }

    // Strategy 5: node-fetch
    try {
        console.log('🔄 [Strategy 5] node-fetch...');
        const fetch = require('node-fetch');
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const arrayBuffer = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        if (buf && buf.length > 0) {
            console.log(`✅ [Strategy 5] ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
            return buf;
        }
    } catch (err) {
        console.log(`❌ [Strategy 5] ${err.message}`);
    }

    throw new Error('All 5 download strategies failed');
}

// ═══════════════════════════════════════════════════════════
//                    📤 SEND AUDIO (3 METHODS)
// ═══════════════════════════════════════════════════════════
async function sendAudio(sock, chatId, message, audioUrl, title) {
    const fileName = `${title.replace(/[^\w\s-]/g, '')}.mp3`;

    // Method 1: Buffer
    try {
        console.log('📤 [Method 1] Buffer send...');
        const buffer = await downloadBuffer(audioUrl);
        await sock.sendMessage(chatId, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            fileName,
            ptt: false,
            ...channelInfo
        }, { quoted: message });
        console.log('✅ [Method 1] SUCCESS');
        return true;
    } catch (err) {
        console.log(`❌ [Method 1] ${err.message}`);
    }

    // Method 2: Direct URL
    try {
        console.log('📤 [Method 2] URL send...');
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName,
            ptt: false,
            ...channelInfo
        }, { quoted: message });
        console.log('✅ [Method 2] SUCCESS');
        return true;
    } catch (err) {
        console.log(`❌ [Method 2] ${err.message}`);
    }

    // Method 3: Document
    try {
        console.log('📤 [Method 3] Document send...');
        const buffer = await downloadBuffer(audioUrl);
        await sock.sendMessage(chatId, {
            document: buffer,
            mimetype: 'audio/mpeg',
            fileName,
            ...channelInfo
        }, { quoted: message });
        console.log('✅ [Method 3] SUCCESS');
        return true;
    } catch (err) {
        console.log(`❌ [Method 3] ${err.message}`);
    }

    return false;
}

// ═══════════════════════════════════════════════════════════
//                    🚀 MAIN PLAY COMMAND (THUMBNAIL FIRST!)
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

        // ═══════════════════════════════════════
        // 🖼️ STEP 2: THUMBNAIL FIRST (FATAKAT!)
        // ═══════════════════════════════════════
        await addReaction(sock, message, '🖼️');

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
            console.log('✅ Thumbnail sent FIRST');
        } catch (thumbError) {
            console.error('❌ Thumbnail error:', thumbError.message);
        }

        // ═══════════════════════════════════════
        // STEP 3: GET AUDIO URL
        // ═══════════════════════════════════════
        await addReaction(sock, message, '📥');

        let audioData;
        try {
            audioData = await getAudioUrl(songData.url);
        } catch (urlError) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀʟʟ ᴀᴜᴅɪᴏ ᴀᴘɪs ꜰᴀɪʟᴇᴅ',
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴏɴɢ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ═══════════════════════════════════════
        // STEP 4: SEND AUDIO
        // ═══════════════════════════════════════
        const success = await sendAudio(sock, chatId, message, audioData.url, audioData.title);

        if (!success) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴄᴏᴜʟᴅ ɴᴏᴛ sᴇɴᴅ ᴀᴜᴅɪᴏ',
                    '💡 ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴏɴɢ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        await addReaction(sock, message, '✅');
        console.log(`✅ Song sent: ${audioData.title}`);

    } catch (error) {
        console.error('❌ Play error:', error);
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
