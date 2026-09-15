const axios = require('axios');

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

async function newsCommand(sock, chatId, message) {
    try {
        // 📰 Reaction
        await addReaction(sock, message, '📰');

        // Send initial loading message
        const loadingMsg = await sock.sendMessage(chatId, { 
            text: `📰 *Fetching Latest News...*\n\n` +
                  `⏳ Please wait, getting top headlines...`
        }, { quoted: message });

        const apiKey = 'dcd720a6f1914e2d9dba9790c188c08c';
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.data || !response.data.articles || response.data.articles.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, { 
                text: `❌ *No News Found*\n\n` +
                      `Could not fetch news right now. Please try again later.`
            }, { quoted: message });
            return;
        }

        const articles = response.data.articles.slice(0, 5);
        const totalResults = response.data.totalResults || articles.length;

        // Build styled news message
        let newsMessage = `
╔═══════════════════════════════════════╗
║        📰 𝗧𝗢𝗣 𝗛𝗘𝗔𝗗𝗟𝗜𝗡𝗘𝗦
╠═══════════════════════════════════════╣
║ 📊 𝗧𝗼𝘁𝗮𝗹 : ${totalResults} Articles
║ 🌍 𝗖𝗼𝘂𝗻𝘁𝗿𝘆 : United States
╚═══════════════════════════════════════╝

`;

        articles.forEach((article, index) => {
            const title = article.title || 'No Title';
            const description = article.description || 'No description available';
            const source = article.source?.name || 'Unknown Source';
            
            // Truncate title if too long
            const shortTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
            
            // Truncate description if too long
            const shortDesc = description.length > 80 ? description.substring(0, 77) + '...' : description;

            // News category emoji based on content
            let newsEmoji = '📌';
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('covid') || lowerTitle.includes('virus') || lowerTitle.includes('health')) newsEmoji = '🏥';
            else if (lowerTitle.includes('tech') || lowerTitle.includes('apple') || lowerTitle.includes('google') || lowerTitle.includes('ai')) newsEmoji = '💻';
            else if (lowerTitle.includes('sport') || lowerTitle.includes('football') || lowerTitle.includes('cricket') || lowerTitle.includes('game')) newsEmoji = '⚽';
            else if (lowerTitle.includes('politic') || lowerTitle.includes('govt') || lowerTitle.includes('election') || lowerTitle.includes('president')) newsEmoji = '🏛️';
            else if (lowerTitle.includes('weather') || lowerTitle.includes('storm') || lowerTitle.includes('flood') || lowerTitle.includes('earthquake')) newsEmoji = '🌤️';
            else if (lowerTitle.includes('business') || lowerTitle.includes('stock') || lowerTitle.includes('market') || lowerTitle.includes('economy')) newsEmoji = '💹';
            else if (lowerTitle.includes('entertain') || lowerTitle.includes('movie') || lowerTitle.includes('film') || lowerTitle.includes('celebrity')) newsEmoji = '🎬';
            else if (lowerTitle.includes('crime') || lowerTitle.includes('police') || lowerTitle.includes('court') || lowerTitle.includes('murder')) newsEmoji = '🚨';
            else if (lowerTitle.includes('world') || lowerTitle.includes('international') || lowerTitle.includes('global')) newsEmoji = '🌍';
            else newsEmoji = '📌';

            newsMessage += `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ${newsEmoji} 𝗡𝗲𝘄𝘀 #${index + 1}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📰 ${shortTitle}
┃ 📝 ${shortDesc}
┃ 📡 ${source}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

`;
        });

        newsMessage += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗`;

        // Delete loading message
        try {
            await sock.sendMessage(chatId, {
                delete: { 
                    remoteJid: chatId, 
                    fromMe: true, 
                    id: loadingMsg.key.id 
                }
            });
        } catch (e) {}

        // Send final news
        await sock.sendMessage(chatId, { 
            text: newsMessage
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Error fetching news:', error);
        await addReaction(sock, message, '❌');
        
        let errorMessage = `❌ *News Error*\n\n`;
        if (error.response?.status === 401) {
            errorMessage += `🔴 Invalid API Key. Please check your NewsAPI key.`;
        } else if (error.response?.status === 429) {
            errorMessage += `🔴 Rate limit exceeded. Please try again later.`;
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += `⏰ Request timed out. Please try again.`;
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            errorMessage += `🌐 No internet connection. Please check your network.`;
        } else {
            errorMessage += `🔴 ${error.message || 'Something went wrong. Please try again.'}`;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = newsCommand;
