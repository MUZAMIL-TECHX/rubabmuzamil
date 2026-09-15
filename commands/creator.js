const settings = require('../settings');

async function creatorCommand(sock, chatId, message) {
    const reply = 
        '╔═══❖•ೋ° 🌙 °ೋ•❖═══╗\n' +
        '👑 𝑪𝑹𝑬𝑨𝑻𝑶𝑹 𝑵𝑨𝑴𝑬 👑\n' +
        '𝑴𝑼𝒁𝑨𝑴𝑰𝑳 𝑲𝑯𝑨𝑵\n' +
        '╚═══❖•ೋ° 📱 °ೋ•❖═══╝\n' +
        '\n' +
        '📞 𝑪𝑹𝑬𝑨𝑻𝑶𝑹 𝑵𝑼𝑴𝑩𝑬𝑹\n' +
        '➤ 𝟎𝟑𝟒𝟑𝟑𝟕𝟒𝟎𝟖𝟓𝟓\n' +
        '\n' +
        '⚡━━━━━━━━━━━━━━⚡\n' +
        '🔥 𝑷𝑶𝑾𝑬𝑹𝑬𝑫 𝑩𝒀 🔥\n' +
        '👑 𝑴𝑼𝒁𝑨𝑴𝑰𝑳-𝑿𝑫 👑\n' +
        '⚡━━━━━━━━━━━━━━⚡';

    await sock.sendMessage(
        chatId,
        { text: reply },
        { quoted: message }
    );
}

module.exports = creatorCommand;
