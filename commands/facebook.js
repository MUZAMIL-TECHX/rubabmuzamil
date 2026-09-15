const axios = require('axios');

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
        // Check if it's actually a Facebook domain
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
╭━━━〔 📥 *FACEBOOK DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .fb [video link]
┃ ❍ Example : .fb https://www.facebook.com/...
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Proper URL validation
        if (!isValidFacebookUrl(url)) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *INVALID LINK* 〕━━━┈⊷
┃ ❍ Not a valid Facebook link
┃ ❍ Please check and try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // 🔄 Processing reaction
        await addReaction(sock, message, '🔄');

        // Call JawadTech API
        const apiUrl = `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // ✅ Verify API response structure
        if (!data || typeof data !== 'object') {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *API ERROR* 〕━━━┈⊷
┃ ❍ Invalid API response
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Check if API returned success
        if (data.status !== true) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *FAILED* 〕━━━┈⊷
┃ ❍ ${data.message || 'No video found for this link'}
┃ ❍ Video might be private or deleted
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Check if result is array and has items
        if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO MEDIA* 〕━━━┈⊷
┃ ❍ No video found for this link
┃ ❍ Video might be private or deleted
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Get HD video (prefer HD, fallback to SD)
        let videoUrl = null;
        let quality = 'SD';

        // Find HD video
        const hdVideo = data.result.find(item => 
            item.quality === 'HD' && 
            item.type === 'mp4' && 
            item.url && 
            typeof item.url === 'string'
        );
        
        // Find SD video
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

        // ✅ Check if video URL found
        if (!videoUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *FAILED* 〕━━━┈⊷
┃ ❍ Could not extract video URL
┃ ❍ Try again with a different link
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Check video size before sending (WhatsApp limit ~100MB)
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

        // If video size > 95MB, show warning but still try to send
        const sizeMB = (videoSize / (1024 * 1024)).toFixed(2);
        let sizeWarning = '';
        if (videoSize > 95 * 1024 * 1024) {
            sizeWarning = `\n⚠️ Video size: ${sizeMB} MB (may fail if >100MB)`;
        }

        // Send video with styled caption
        const caption = `
╭━━━〔 ✅ *VIDEO READY* 〕━━━┈⊷
┃ ❍ Quality : ${quality}
┃ ❍ Source  : MUZAMIL-XD
┃ ❍ Status  : Downloaded ✅${sizeWarning}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;

        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: "video/mp4",
            caption: caption
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Facebook command error:', error);
        await addReaction(sock, message, '❌');
        
        // ✅ Better error messages
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
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ ${errorMsg}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
