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

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

// Format numbers with commas
function formatNumber(num) {
    if (!num) return '0';
    return parseInt(num).toLocaleString();
}

async function tiktokCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        processedMessages.add(message.key.id);
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        await addReaction(sock, message, '🎵');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🎵 *TIKTOK DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .tiktok [link]
┃ ❍ Example : .tiktok https://www.tiktok.com/@user/video/xxxxx
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // Extract URL
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO LINK* 〕━━━┈⊷
┃ ❍ Please provide a TikTok link
┃ ❍ Example : .tiktok https://www.tiktok.com/...
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // Validate TikTok URL
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
            /https?:\/\/(?:www\.)?tiktok\.com\/@/,
            /https?:\/\/(?:www\.)?tiktok\.com\/t\//
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *INVALID LINK* 〕━━━┈⊷
┃ ❍ Not a valid TikTok link
┃ ❍ Please check and try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        await addReaction(sock, message, '🔄');

        // ===============================
        // 📡 CALL NEW API
        // ===============================
        const apiUrl = `https://api.nexray.eu.cc/downloader/tiktok?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // ✅ Check API response
        if (!data.status || !data.result) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *API FAILED* 〕━━━┈⊷
┃ ❍ Could not fetch video
┃ ❍ ${data.message || 'Try again later'}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const result = data.result;
        const videoUrl = result.data;
        const title = result.title || 'TikTok Video';
        const cover = result.cover || '';
        const duration = result.duration || 'Unknown';
        const region = result.region || 'Unknown';
        
        // Stats
        const views = formatNumber(result.stats?.views);
        const likes = formatNumber(result.stats?.likes);
        const comments = formatNumber(result.stats?.comment);
        const shares = formatNumber(result.stats?.share);
        const saves = formatNumber(result.stats?.save);
        
        // Author info
        const authorName = result.author?.nickname || result.author?.fullname || 'Unknown';
        const authorAvatar = result.author?.avatar || '';
        
        // Music info
        const musicTitle = result.music_info?.title || 'Unknown';
        const musicAuthor = result.music_info?.author || 'Unknown';

        if (!videoUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO VIDEO* 〕━━━┈⊷
┃ ❍ Could not extract video URL
┃ ❍ Try again with a different link
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ===============================
        // 📤 SEND VIDEO INFO
        // ===============================
        const infoText = `
╭━━━〔 🎵 *TIKTOK VIDEO* 〕━━━┈⊷
┃ ❍ Title : ${title.substring(0, 40)}${title.length > 40 ? '...' : ''}
┃ ❍ Author : ${authorName}
┃ ❍ Duration : ${duration}
┃ ❍ Region : ${region}
┃
┃ 📊 *Stats*
┃ ❍ 👁️ Views : ${views}
┃ ❍ ❤️ Likes : ${likes}
┃ ❍ 💬 Comments : ${comments}
┃ ❍ 🔄 Shares : ${shares}
┃ ❍ 💾 Saves : ${saves}
┃
┃ 🎵 *Music*
┃ ❍ ${musicTitle}
┃ ❍ By : ${musicAuthor}
╰━━━━━━━━━━━━━━━━┈⊷

⏳ Downloading video...

> By; MUZAMIL-XD`;

        await sock.sendMessage(chatId, {
            text: infoText
        }, { quoted: message });

        // ===============================
        // 📥 DOWNLOAD & SEND VIDEO
        // ===============================
        try {
            // Download video as buffer
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'video/mp4,video/*,*/*;q=0.9',
                    'Referer': 'https://www.tiktok.com/'
                }
            });
            
            const videoBuffer = Buffer.from(videoResponse.data);
            
            if (videoBuffer.length === 0) {
                throw new Error("Video buffer is empty");
            }

            const caption = `
╭━━━〔 ✅ *VIDEO READY* 〕━━━┈⊷
┃ ❍ Title : ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}
┃ ❍ Author : ${authorName}
┃ ❍ Views : ${views}
┃ ❍ Likes : ${likes}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;

            await sock.sendMessage(chatId, {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption: caption
            }, { quoted: message });

            await addReaction(sock, message, '✅');

        } catch (downloadError) {
            console.error(`Download error: ${downloadError.message}`);
            
            // Fallback: Send video URL directly
            try {
                const caption = `
╭━━━〔 ⚠️ *STREAMING VIDEO* 〕━━━┈⊷
┃ ❍ Title : ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}
┃ ❍ Author : ${authorName}
┃ ❍ Views : ${views}
┃ ❍ Likes : ${likes}
╰━━━━━━━━━━━━━━━━┈⊷

💡 Video is being streamed directly

> By; MUZAMIL-XD`;

                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });

                await addReaction(sock, message, '✅');

            } catch (urlError) {
                console.error(`URL method also failed: ${urlError.message}`);
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❌ *DOWNLOAD FAILED* 〕━━━┈⊷
┃ ❍ Could not download video
┃ ❍ Try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
                }, { quoted: message });
            }
        }

    } catch (error) {
        console.error('TikTok command error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ ${error.message || 'Something went wrong'}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
