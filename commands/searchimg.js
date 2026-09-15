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

async function searchimgCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🔍');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🔍 *IMAGE SEARCH* 〕━━━┈⊷
┃ ❍ Usage : .searchimg [query]
┃ ❍ Example : .searchimg cat
┃ ❍ Example : .searchimg beautiful nature
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // 🔄 Processing reaction
        await addReaction(sock, message, '🔄');

        // Call Pinterest API
        const apiUrl = `https://allstars-apis.vercel.app/pinterest?search=${encodeURIComponent(searchQuery)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // Check if API returned data
        if (!data || !data.data || data.data.length === 0) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO IMAGES FOUND* 〕━━━┈⊷
┃ ❍ No images found for: ${searchQuery}
┃ ❍ Try different keywords
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // Get first 3 images (remove duplicates)
        const uniqueImages = [...new Set(data.data)].slice(0, 3);
        const totalFound = data.count || data.data.length;

        // Send search results info
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 🖼️ *SEARCH RESULTS* 〕━━━┈⊷
┃ ❍ Query : ${searchQuery}
┃ ❍ Found : ${totalFound} images
┃ ❍ Showing : ${uniqueImages.length} images
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });

        // Send each image
        for (let i = 0; i < uniqueImages.length; i++) {
            try {
                const imgUrl = uniqueImages[i];
                const caption = `
╭━━━〔 🖼️ *IMAGE ${i + 1}/${uniqueImages.length}* 〕━━━┈⊷
┃ ❍ Query : ${searchQuery}
┃ ❍ Source : Pinterest
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;

                await sock.sendMessage(chatId, {
                    image: { url: imgUrl },
                    caption: caption
                }, { quoted: message });

                // Add small delay between images
                if (i < uniqueImages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (imgError) {
                console.error(`Error sending image ${i + 1}:`, imgError.message);
                // Continue with next image
            }
        }

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('SearchImg command error:', error);
        await addReaction(sock, message, '❌');
        
        let errorMsg = error.message || 'Something went wrong';
        if (error.code === 'ECONNABORTED') {
            errorMsg = 'Request timeout. Try again.';
        } else if (error.response?.status === 404) {
            errorMsg = 'API not found. Try again later.';
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

module.exports = searchimgCommand;
