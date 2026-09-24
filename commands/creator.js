const settings = require('../settings');

async function creatorCommand(sock, chatId, message) {
    // Add reaction
    await sock.sendMessage(chatId, {
        react: {
            text: '👑',
            key: message.key
        }
    });

    const reply = 
`╔════════════════════════╗
║     👑 𝑪𝑹𝑬𝑨𝑻𝑶𝑹𝑺 👑
╚════════════════════════╝

╭┈──〔 👤 𝑪𝑹𝑬𝑨𝑻𝑶𝑹 𝟏 〕┈──⊷
┋⋄ ➠ 👤 𝑵𝒂𝒎𝒆   : 𝑴𝑼𝒁𝑨𝑴𝑰𝑳
┋⋄ ➠ 📱 𝑵𝒖𝒎𝒃𝒆𝒓 : 𝟎𝟑𝟏𝟑𝟎𝟏𝟐𝟐𝟔𝟒𝟑
┋⋄ ➠ 📢 𝑯𝒂𝒏𝒅𝒍𝒆  : @Muzamil
╰─────────────────────⊷

╭┈──〔 👤 𝑪𝑹𝑬𝑨𝑻𝑶𝑹 𝟐 〕┈──⊷
┋⋄ ➠ 👤 𝑵𝒂𝒎𝒆   : 𝑹𝑼𝑩𝑨𝑩 𝑺𝑯𝑬𝑰𝑲𝑯
┋⋄ ➠ 📱 𝑵𝒖𝒎𝒃𝒆𝒓 : 𝟎𝟑𝟏𝟑𝟎𝟏𝟐𝟐𝟔𝟒𝟑
┋⋄ ➠ 📢 𝑯𝒂𝒏𝒅𝒍𝒆  : @Rubab
╰─────────────────────⊷

╭┈──〔 🔗 𝒄𝒐𝒏𝒏𝒆𝒄𝒕 〕┈──⊷
┋⋄ ➠ 📱 𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽 𝗖𝗵𝗮𝗻𝗻𝗲𝗹
┋⋄ ➠ https://whatsapp.com/channel/0029VbCkm3rAe5VzCYLtNb2u
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

    await sock.sendMessage(
        chatId,
        { 
            text: reply,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363426106687970@newsletter',
                    newsletterName: '𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋',
                    serverMessageId: -1
                }
            }
        },
        { quoted: message }
    );
}

module.exports = creatorCommand;