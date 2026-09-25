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
//                    🔍 SEARCH - SIPUTZX API
// ═══════════════════════════════════════════════════════════
async function searchSong(query) {
    try {
        const apiUrl = `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`;
        console.log(`🔍 [Search] ${query}`);
        
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.data.status || !response.data.data || response.data.data.length === 0) {
            throw new Error('No results');
        }

        // ✅ Get first VIDEO type result
        const videoResult = response.data.data.find(item => item.type === 'video');
        if (!videoResult) throw new Error('No video found');

        console.log(`✅ [Search] Found: ${videoResult.title}`);
        
        return {
            title: videoResult.title,
            url: videoResult.url,
            thumbnail: videoResult.thumbnail || videoResult.image,
            timestamp: videoResult.timestamp,
            views: videoResult.views,
            author: videoResult.author?.name || 'Unknown',
            videoId: videoResult.videoId
        };
    } catch (error) {
        console.error('❌ Search failed:', error.message);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
//                    🎵 DOWNLOAD - ARSLAN API
// ═══════════════════════════════════════════════════════════
async function getAudioDownloadUrl(youtubeUrl) {
    try {
        const apiUrl = `https://arslan-apis-v2.vercel.app/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
        console.log(`🎵 [Download] Fetching audio URL...`);
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.data.status || !response.data.result?.download?.url) {
            throw new Error('No download URL');
        }

        const downloadUrl = response.data.result.download.url;
        const title = response.data.result.metadata?.title || 'Audio';
        
        console.log(`✅ [Download] Got URL: ${downloadUrl.substring(0, 80)}`);
        
        return { downloadUrl, title };
    } catch (error) {
        console.error('❌ Download URL failed:', error.message);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
//                    📥 BUFFER DOWNLOAD (FAST)
// ═══════════════════════════════════════════════════════════
async function downloadAudioBuffer(url) {
    console.log(`📥 [Buffer] Downloading...`);
    
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        decompress: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'audio/*,*/*;q=0.8',
            'Accept-Encoding': 'identity'
        }
    });

    const buffer = Buffer.from(response.data);
    
    if (!buffer || buffer.length === 0) {
        throw new Error('Empty buffer');
    }

    console.log(`✅ [Buffer] Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return buffer;
}

// ═══════════════════════════════════════════════════════════
//                    🚀 MAIN PLAY COMMAND
// ═══════════════════════════════════════════════════════════
async function playCommand(sock, chatId, message) {
    try {
        // 📥 Start reaction
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
        // STEP 1: SEARCH (Siputzx)
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

        // 🎵 Song found
        await addReaction(sock, message, '🎵');

        // ═══════════════════════════════════════
        // STEP 2: SEND THUMBNAIL FIRST (FAST)
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
        // STEP 3: GET DOWNLOAD URL (Arslan)
        // ═══════════════════════════════════════
        await addReaction(sock, message, '📥');

        let audioData;
        try {
            audioData = await getAudioDownloadUrl(songData.url);
        } catch (urlError) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: box('❌ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ', [
                    '🔴 ᴀᴜᴅɪᴏ ᴜʀʟ ɴᴏᴛ ꜰᴏᴜɴᴅ',
                    '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
                ]),
                ...channelInfo
            }, { quoted: message });
        }

        // ═══════════════════════════════════════
        // STEP 4: DOWNLOAD AS BUFFER (FAST)
        // ═══════════════════════════════════════
        let audioBuffer;
        try {
            audioBuffer = await downloadAudioBuffer(audioData.downloadUrl);
        } catch (bufferError) {
            console.error('Buffer failed, trying URL method:', bufferError.message);
            
            // ✅ Fallback: Direct URL send
            await sock.sendMessage(chatId, {
                audio: { url: audioData.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${audioData.title.replace(/[^\w\s-]/g, '')}.mp3`,
                ptt: false,
                ...channelInfo
            }, { quoted: message });

            await addReaction(sock, message, '✅');
            return;
        }

        // ═══════════════════════════════════════
        // STEP 5: SEND AUDIO (FAST)
        // ═══════════════════════════════════════
        await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${audioData.title.replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
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
