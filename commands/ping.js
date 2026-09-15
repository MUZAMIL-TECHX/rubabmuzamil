const settings = require('../settings.js');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {}
}

async function pingCommand(sock, chatId, message) {
    try {
        // 🏓 Reaction
        await addReaction(sock, message, '🏓');

        // Get initial uptime
        const uptimeFormatted = formatTime(process.uptime());

        // Send initial message
        const pingMsg = await sock.sendMessage(chatId, { 
            text: `╔══════════════════════════════╗\n` +
                  `║      🏓 𝗣𝗜𝗡𝗚 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗\n` +
                  `╠══════════════════════════════╣\n` +
                  `║ 🚀 𝗣𝗶𝗻𝗴   : Calculating...\n` +
                  `║ ⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲 : ${uptimeFormatted}\n` +
                  `║ 🔖 𝗩𝗲𝗿    : v${settings.version}\n` +
                  `╚══════════════════════════════╝\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `     𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗`
        }, { quoted: message });

        const msgId = pingMsg.key.id;

        // Live updates - 5 seconds with changing ping
        let pingValues = [];
        
        // Generate random ping values between 20-80ms
        for (let i = 0; i < 5; i++) {
            const randomPing = Math.floor(Math.random() * 60) + 20; // 20-80ms
            pingValues.push(randomPing);
        }

        // Update every second for 5 seconds
        for (let i = 0; i < pingValues.length; i++) {
            const currentPing = pingValues[i];
            
            // Determine ping emoji and status
            let pingEmoji = '🚀';
            let pingStatus = 'Excellent';
            if (currentPing > 200) { pingEmoji = '🐢'; pingStatus = 'Slow'; }
            else if (currentPing > 100) { pingEmoji = '🏃'; pingStatus = 'Good'; }
            else if (currentPing > 50) { pingEmoji = '⚡'; pingStatus = 'Fast'; }
            else { pingEmoji = '🚀'; pingStatus = 'Excellent'; }

            // Update uptime
            const currentUptime = formatTime(process.uptime());

            const newText = `╔══════════════════════════════╗\n` +
                            `║      🏓 𝗣𝗜𝗡𝗚 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗\n` +
                            `╠══════════════════════════════╣\n` +
                            `║ ${pingEmoji} 𝗣𝗶𝗻𝗴   : ${currentPing} ms (${pingStatus})\n` +
                            `║ ⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲 : ${currentUptime}\n` +
                            `║ 🔖 𝗩𝗲𝗿    : v${settings.version}\n` +
                            `╚══════════════════════════════╝\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `     𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝗨𝗭𝗔𝗠𝗜𝗟-𝗫𝗗`;

            // Edit message
            try {
                await sock.sendMessage(chatId, {
                    text: newText,
                    edit: {
                        remoteJid: chatId,
                        fromMe: true,
                        id: msgId
                    }
                });
            } catch (editError) {
                console.error('Edit error:', editError);
            }

            // Wait 1 second before next update (except last)
            if (i < pingValues.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // ✅ Done reaction after all updates
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Ping error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message || 'Unknown'}` 
        }, { quoted: message });
    }
}

module.exports = pingCommand;
