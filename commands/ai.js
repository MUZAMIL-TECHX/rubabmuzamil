const { askProxAbdullah } = require('../lib/proxabdullah');

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

async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `🧠 *AI Chat Assistant*\n\n` +
                      `Usage:\n` +
                      `.gpt [question]\n` +
                      `.gemini [question]\n\n` +
                      `Example:\n` +
                      `.gpt write a basic html code\n` +
                      `.gemini What is AI?`
            }, { quoted: message });
        }

        // Get the command and query
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, { 
                text: `❌ *No Question Provided*\n\n` +
                      `Please provide a question after the command.\n\n` +
                      `Example:\n` +
                      `.gpt What is JavaScript?`
            }, { quoted: message });
        }

        try {
            // 🤖 Processing reaction
            await addReaction(sock, message, '🤖');

            if (command === '.gpt' || command === '.gemini') {
                const answer = await askProxAbdullah(query);
                const title = command === '.gpt' ? '𝗚𝗣𝗧' : '𝗚𝗲𝗺𝗶𝗻𝗶';
                const styledAnswer = `
╔═══════════════════════════════════════╗
║        🧠 ${title} 𝗥𝗲𝘀𝗽𝗼𝗻𝘀𝗲
╠═══════════════════════════════════════╣
║ 📌 𝗤𝘂𝗲𝗿𝘆 : ${query.substring(0, 40)}${query.length > 40 ? '...' : ''}
╠═══════════════════════════════════════╣
║ ${answer}
╚═══════════════════════════════════════╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗`;

                await sock.sendMessage(chatId, {
                    text: styledAnswer
                }, { quoted: message });
                await addReaction(sock, message, '✅');
            } else {
                await addReaction(sock, message, '❌');
                return await sock.sendMessage(chatId, { 
                    text: `❌ *Invalid Command*\n\n` +
                          `Available commands:\n` +
                          `• .gpt [question]\n` +
                          `• .gemini [question]`
                }, { quoted: message });
            }
        } catch (error) {
            console.error('API Error:', error);
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `❌ *API Error*\n\n` +
                      `Failed to get response. Please try again later.\n\n` +
                      `💡 ${error.message || 'Unknown error'}`
            }, { quoted: message });
        }
    } catch (error) {
        console.error('AI Command Error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *Error*\n\n` +
                  `Something went wrong. Please try again later.\n\n` +
                  `💡 ${error.message || 'Unknown error'}`
        }, { quoted: message });
    }
}

module.exports = aiCommand;
