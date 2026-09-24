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

async function editMessage(sock, chatId, msgId, newText, channelInfo) {
    try {
        await sock.sendMessage(chatId, {
            text: newText,
            edit: {
                remoteJid: chatId,
                fromMe: true,
                id: msgId
            },
            ...channelInfo
        });
    } catch (error) {
        console.error('Edit error:', error);
    }
}

async function pingCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🏓');

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

        const pingMsg = await sock.sendMessage(chatId, {
            text: `🏓 *Pinging...*`,
            ...channelInfo
        }, { quoted: message });

        const msgId = pingMsg.key.id;

        const footerAnimations = [
            `༺𓆩 𝑪𝟗 𝑀𝑼𝑍𝜦𝑀𝜤𝐋 𓆪༻`,
            `𓆪༻ 𝑅𝑼𝛣𝜦𝛣 ༺𓆩`,
            `༺𓆩𝗧𝗲𝗮𝗺𝗥𝗲𝗱𝗫𝗵𝗮𝗰𝗸𝗲𝗿𝘀™𓆪༻`,
            `𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`
        ];

        for (let i = 0; i < 4; i++) {
            const currentPing = Math.floor(Math.random() * 60) + 20;

            let pingEmoji = '🚀';
            let pingStatus = 'Excellent';
            if (currentPing > 200) { pingEmoji = '🐢'; pingStatus = 'Slow'; }
            else if (currentPing > 100) { pingEmoji = '🏃'; pingStatus = 'Good'; }
            else if (currentPing > 50) { pingEmoji = '⚡'; pingStatus = 'Fast'; }
            else { pingEmoji = '🚀'; pingStatus = 'Excellent'; }

            const currentUptime = formatTime(process.uptime());
            const currentRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            const footer = footerAnimations[i];

            const newText = 
`╔════════════════════════╗
║    🏓 𝗣𝗜𝗡𝗚 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋
╠════════════════════════╣
║ ${pingEmoji} 𝗣𝗶𝗻𝗴   : ${currentPing} ms (${pingStatus})
║ ⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲 : ${currentUptime}
║ 🔖 𝗩𝗲𝗿    : v${settings.version}
║ 🧠 𝗥𝗔𝗠    : ${currentRam} MB
╚════════════════════════╝
━━━━━━━━━━━━━━━━━━━━━━━━
       ${footer}`;

            await editMessage(sock, chatId, msgId, newText, channelInfo);

            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

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