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

// Helper function to add reaction
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Reaction error:', error);
    }
}

// Validate Facebook URL properly
function isValidFacebookUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname === 'facebook.com' || 
               hostname === 'www.facebook.com' || 
               hostname === 'fb.watch' ||
               hostname === 'm.facebook.com' ||
               hostname === 'l.facebook.com' ||
               hostname.endsWith('.facebook.com');
    } catch {
        return false;
    }
}

async function facebookCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '📥');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 📥 ꜰᴀᴄᴇʙᴏᴏᴋ ᴅʟ 〕┈──⊷
┋⋄ ➠ 📌 ᴜsᴀɢᴇ : .ꜰʙ [ᴠɪᴅᴇᴏ ʟɪɴᴋ]
┋⋄ ➠ 🔍 ᴇxᴀᴍᴘʟᴇ : .ꜰʙ https://www.facebook.com/...
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        // ✅ Proper URL validation
        if (!isValidFacebookUrl(url)) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ 〕┈──⊷
┋⋄ ➠ 🔴 ɴᴏᴛ ᴀ ᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ʟɪɴᴋ
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        const apiUrl = `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        if (!data || typeof data !== 'object') {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ᴀᴘɪ ᴇʀʀᴏʀ 〕┈──⊷
┋⋄ ➠ 🔴 ɪɴᴠᴀʟɪᴅ ᴀᴘɪ ʀᴇsᴘᴏɴsᴇ
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        if (data.status !== true) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ꜰᴀɪʟᴇᴅ 〕┈──⊷
┋⋄ ➠ 🔴 ${data.message || 'No video found'}
┋⋄ ➠ 💡 ᴠɪᴅᴇᴏ ᴍᴀʏ ʙᴇ ᴘʀɪᴠᴀᴛᴇ ᴏʀ ᴅᴇʟᴇᴛᴇᴅ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ɴᴏ ᴍᴇᴅɪᴀ 〕┈──⊷
┋⋄ ➠ 🔴 ɴᴏ ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ
┋⋄ ➠ 💡 ᴠɪᴅᴇᴏ ᴍᴀʏ ʙᴇ ᴘʀɪᴠᴀᴛᴇ ᴏʀ ᴅᴇʟᴇᴛᴇᴅ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        // ✅ Get HD video (prefer HD, fallback to SD)
        let videoUrl = null;
        let quality = 'SD';

        const hdVideo = data.result.find(item => 
            item.quality === 'HD' && 
            item.type === 'mp4' && 
            item.url && 
            typeof item.url === 'string'
        );
        
        const sdVideo = data.result.find(item => 
            item.quality === 'SD' && 
            item.type === 'mp4' && 
            item.url && 
            typeof item.url === 'string'
        );

        if (hdVideo && hdVideo.url) {
            videoUrl = hdVideo.url;
            quality = 'HD';
        } else if (sdVideo && sdVideo.url) {
            videoUrl = sdVideo.url;
            quality = 'SD';
        }

        if (!videoUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭┈──〔 ❌ ꜰᴀɪʟᴇᴅ 〕┈──⊷
┋⋄ ➠ 🔴 ᴄᴏᴜʟᴅ ɴᴏᴛ ᴇxᴛʀᴀᴄᴛ ᴠɪᴅᴇᴏ ᴜʀʟ
┋⋄ ➠ 💡 ᴛʀʏ ᴀɢᴀɪɴ ᴡɪᴛʜ ᴅɪꜰꜰᴇʀᴇɴᴛ ʟɪɴᴋ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            }, { quoted: message });
        }

        // ✅ Check video size
        let videoSize = 0;
        try {
            const headResponse = await axios.head(videoUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            videoSize = parseInt(headResponse.headers['content-length'] || '0');
        } catch (headError) {
            console.log('Could not fetch video size, proceeding anyway');
        }

        const sizeMB = (videoSize / (1024 * 1024)).toFixed(2);
        let sizeWarning = '';
        if (videoSize > 95 * 1024 * 1024) {
            sizeWarning = `\n┋⋄ ➠ ⚠️ sɪᴢᴇ : ${sizeMB} MB (ᴍᴀʏ ꜰᴀɪʟ)`;
        }

        const caption = `
╭┈──〔 ✅ ᴠɪᴅᴇᴏ ʀᴇᴀᴅʏ 〕┈──⊷
┋⋄ ➠ 🎬 ǫᴜᴀʟɪᴛʏ : ${quality}
┋⋄ ➠ 👑 sᴏᴜʀᴄᴇ  : ${sock.botname || '𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋'}
┋⋄ ➠ ✅ sᴛᴀᴛᴜs  : ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ${sizeWarning}
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: caption,
            ...channelInfo
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Facebook command error:', error);
        await addReaction(sock, message, '❌');
        
        let errorMsg = error.message || 'Something went wrong';
        if (error.code === 'ECONNABORTED') {
            errorMsg = 'Request timeout. Try again.';
        } else if (error.response?.status === 404) {
            errorMsg = 'Video not found. It may be deleted.';
        } else if (error.response?.status === 429) {
            errorMsg = 'Rate limited. Try again later.';
        }
        
        await sock.sendMessage(chatId, {
            text: `
╭┈──〔 ❌ ᴇʀʀᴏʀ 〕┈──⊷
┋⋄ ➠ 🔴 ${errorMsg}
┋⋄ ➠ 💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = facebookCommand;