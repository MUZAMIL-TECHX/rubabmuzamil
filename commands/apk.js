const axios = require('axios');

// ===============================
// 🎯 CHANNEL INFO
// ===============================
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

async function apkCommand(sock, chatId, message, query) {
    try {
        await addReaction(sock, message, '📱');

        if (!query) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(
                chatId,
                {
                    text: `
╭┈──〔 📱 ᴀᴘᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ 〕┈──⊷
┋⋄ ➠ 📌 ᴜsᴀɢᴇ : .ᴀᴘᴋ <ᴀᴘᴘ ɴᴀᴍᴇ>
┋⋄ ➠ 🔍 ᴇxᴀᴍᴘʟᴇ : .ᴀᴘᴋ ᴡʜᴀᴛsᴀᴘᴘ
┋⋄ ➠ 🔍 ᴇxᴀᴍᴘʟᴇ : .ᴀᴘᴋ ꜰᴀᴄᴇʙᴏᴏᴋ
┋⋄ ➠ 🔍 ᴇxᴀᴍᴘʟᴇ : .ᴀᴘᴋ ɪɴsᴛᴀɢʀᴀᴍ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                    ...channelInfo
                },
                { quoted: message }
            );
            return;
        }

        await addReaction(sock, message, '🔄');
        await sock.sendPresenceUpdate('composing', chatId);

        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`;

        console.log(`[APK] Searching: ${query}`);

        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;

        if (!data || !data.datalist || !data.datalist.list || data.datalist.list.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(
                chatId,
                {
                    text: `
╭┈──〔 ❌ ᴀᴘᴋ ɴᴏᴛ ꜰᴏᴜɴᴅ 〕┈──⊷
┋⋄ ➠ 🔍 ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏʀ : *${query}*
┋⋄ ➠ 💡 ᴛʀʏ :
┋⋄ ➠ ᴄʜᴇᴄᴋ sᴘᴇʟʟɪɴɢ
┋⋄ ➠ ᴜsᴇ sʜᴏʀᴛᴇʀ ɴᴀᴍᴇ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                    ...channelInfo
                },
                { quoted: message }
            );
            return;
        }

        const app = data.datalist.list[0];
        const appSize = (app.size / 1048576).toFixed(2);
        const appName = app.name || query;
        const appPackage = app.package || 'Unknown';
        const appVersion = app.file?.vername || 'Unknown';
        const appIcon = app.icon || '';
        const appPath = app.file?.path || app.file?.path_alt;

        if (!appPath) {
            throw new Error('Download link not available');
        }

        let downloadUrl = appPath;
        if (!downloadUrl.startsWith('http')) {
            downloadUrl = `https://ws75.aptoide.com${downloadUrl}`;
        }

        // ===============================
        // 📱 APK INFO
        // ===============================
        if (parseFloat(appSize) > 95) {
            const largeCaption = `
╭┈──〔 📱 ᴀᴘᴋ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 〕┈──⊷
┋⋄ ➠ 👑 ɴᴀᴍᴇ    : ${appName.toUpperCase()}
┋⋄ ➠ 📦 ᴘᴀᴄᴋᴀɢᴇ : ${appPackage.toUpperCase()}
┋⋄ ➠ 📏 sɪᴢᴇ    : ${appSize} MB
┋⋄ ➠ 🔄 ᴠᴇʀsɪᴏɴ : ${appVersion}
╰─────────────────────⊷

╭┈──〔 ⚠️ ꜰɪʟᴇ ᴛᴏᴏ ʟᴀʀɢᴇ 〕┈──⊷
┋⋄ ➠ 🔴 ᴄᴀɴɴᴏᴛ sᴇɴᴅ ᴠɪᴀ ᴡʜᴀᴛsᴀᴘᴘ
┋⋄ ➠ 💡 ᴜsᴇ ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ ʙᴇʟᴏᴡ
╰─────────────────────⊷

╭┈──〔 📥 ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ 〕┈──⊷
┋⋄ ➠ ${downloadUrl}
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

            if (appIcon) {
                try {
                    await sock.sendMessage(
                        chatId,
                        {
                            image: { url: appIcon },
                            caption: largeCaption,
                            ...channelInfo
                        },
                        { quoted: message }
                    );
                } catch (imgError) {
                    await sock.sendMessage(
                        chatId,
                        { text: largeCaption, ...channelInfo },
                        { quoted: message }
                    );
                }
            } else {
                await sock.sendMessage(
                    chatId,
                    { text: largeCaption, ...channelInfo },
                    { quoted: message }
                );
            }
            await addReaction(sock, message, '⚠️');
            return;
        }

        // ===============================
        // 📥 SMALL FILE - SEND DIRECTLY
        // ===============================
        const caption = `
╭┈──〔 📱 ᴀᴘᴋ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 〕┈──⊷
┋⋄ ➠ 👑 ɴᴀᴍᴇ    : ${appName.toUpperCase()}
┋⋄ ➠ 📦 ᴘᴀᴄᴋᴀɢᴇ : ${appPackage.toUpperCase()}
┋⋄ ➠ 📏 sɪᴢᴇ    : ${appSize} MB
┋⋄ ➠ 🔄 ᴠᴇʀsɪᴏɴ : ${appVersion}
╰─────────────────────⊷

╭┈──〔 📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ 〕┈──⊷
┋⋄ ➠ ⏳ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ...
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

        // Send app info with icon
        if (appIcon) {
            try {
                await sock.sendMessage(
                    chatId,
                    {
                        image: { url: appIcon },
                        caption: caption,
                        ...channelInfo
                    },
                    { quoted: message }
                );
            } catch (imgError) {
                await sock.sendMessage(
                    chatId,
                    { text: caption, ...channelInfo },
                    { quoted: message }
                );
            }
        } else {
            await sock.sendMessage(
                chatId,
                { text: caption, ...channelInfo },
                { quoted: message }
            );
        }

        // Send APK file
        await sock.sendMessage(
            chatId,
            {
                document: { url: downloadUrl },
                mimetype: "application/vnd.android.package-archive",
                fileName: `${appName}.apk`,
                caption: `
╭┈──〔 ✅ ᴀᴘᴋ ʀᴇᴀᴅʏ 〕┈──⊷
┋⋄ ➠ 📱 ${appName}
┋⋄ ➠ 📏 ${appSize} MB
┋⋄ ➠ ✅ ᴅᴏᴡɴʟᴏᴀᴅ ᴄᴏᴍᴘʟᴇᴛᴇ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            },
            { quoted: message }
        );

        await addReaction(sock, message, '✅');
        console.log(`[APK] Successfully sent: ${appName}`);

    } catch (error) {
        console.error('[APK] Error:', error.message);
        await addReaction(sock, message, '❌');

        await sock.sendMessage(
            chatId,
            {
                text: `
╭┈──〔 ❌ ᴇʀʀᴏʀ 〕┈──⊷
┋⋄ ➠ 🔴 ${error.message || 'Something went wrong'}
┋⋄ ➠ 💡 ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ
╰─────────────────────⊷

      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`,
                ...channelInfo
            },
            { quoted: message }
        );
    }
}

module.exports = apkCommand;