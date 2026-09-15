const { igdl } = require("ruhend-scraper");

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

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

// Function to extract unique media URLs with simple deduplication
function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();
    
    for (const media of mediaData) {
        if (!media.url) continue;
        
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    
    return uniqueMedia;
}

async function instagramCommand(sock, chatId, message) {
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `📸 *Instagram Downloader*\n\n` +
                      `Usage:\n` +
                      `.instagram [link]\n\n` +
                      `Example:\n` +
                      `.instagram https://www.instagram.com/p/xxxxx`
            }, { quoted: message });
        }

        // Check for various Instagram URL formats
        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(text));
        
        if (!isValidUrl) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `❌ *Invalid Link*\n\n` +
                      `Please provide a valid Instagram link.\n\n` +
                      `✅ Valid formats:\n` +
                      `• instagram.com/p/xxxxx\n` +
                      `• instagram.com/reel/xxxxx\n` +
                      `• instagram.com/tv/xxxxx`
            }, { quoted: message });
        }

        // 🔄 Processing reaction
        await addReaction(sock, message, '🔄');

        const downloadData = await igdl(text);
        
        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `❌ *No Media Found*\n\n` +
                      `The post might be private or the link is invalid.\n\n` +
                      `💡 Try:\n` +
                      `• Check if post is public\n` +
                      `• Try a different link`
            }, { quoted: message });
        }

        const mediaData = downloadData.data;
        const uniqueMedia = extractUniqueMedia(mediaData);
        const mediaToDownload = uniqueMedia.slice(0, 20);
        
        if (mediaToDownload.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `❌ *No Valid Media*\n\n` +
                      `No valid media found to download.`
            }, { quoted: message });
        }

        // Send count message
        await sock.sendMessage(chatId, { 
            text: `📥 *Downloading ${mediaToDownload.length} media(s)...*\n\n` +
                  `⏳ Please wait...`
        }, { quoted: message });

        // Download all media
        for (let i = 0; i < mediaToDownload.length; i++) {
            try {
                const media = mediaToDownload[i];
                const mediaUrl = media.url;

                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) || 
                              media.type === 'video' || 
                              text.includes('/reel/') || 
                              text.includes('/tv/');

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: mediaUrl },
                        mimetype: "video/mp4",
                        caption: `📹 *Media ${i + 1}/${mediaToDownload.length}*\n\n` +
                                 `❖━━━━━━━━━━━━━━━━━━━❖\n` +
                                 `  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n` +
                                 `❖━━━━━━━━━━━━━━━━━━━❖`
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: `📸 *Media ${i + 1}/${mediaToDownload.length}*\n\n` +
                                 `❖━━━━━━━━━━━━━━━━━━━❖\n` +
                                 `  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n` +
                                 `❖━━━━━━━━━━━━━━━━━━━❖`
                    }, { quoted: message });
                }
                
                // Add small delay between downloads
                if (i < mediaToDownload.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (mediaError) {
                console.error(`Error downloading media ${i + 1}:`, mediaError);
                // Continue with next media if one fails
            }
        }

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error in Instagram command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, { 
            text: `❌ *Error*\n\n` +
                  `Something went wrong. Please try again.\n\n` +
                  `💡 ${error.message || 'Unknown error'}`
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
