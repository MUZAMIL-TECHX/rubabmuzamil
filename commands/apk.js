const axios = require('axios');

async function apkCommand(sock, chatId, message, query) {
    if (!query) {
        await sock.sendMessage(
            chatId,
            {
                text: '📱 *APK Downloader*\n\n' +
                      'Usage:\n' +
                      '.apk <app name>\n\n' +
                      'Example:\n' +
                      '.apk whatsapp\n' +
                      '.apk facebook\n' +
                      '.apk instagram'
            },
            { quoted: message }
        );
        return;
    }

    try {
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
            await sock.sendMessage(
                chatId,
                {
                    text: `❌ *APK NOT FOUND*\n\n🔍 No results found for: *${query}*\n\n💡 Try:\n• Check spelling\n• Use shorter name\n• Example: .apk whatsapp`
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

        // Build download URL if path is relative
        let downloadUrl = appPath;
        if (!downloadUrl.startsWith('http')) {
            downloadUrl = `https://ws75.aptoide.com${downloadUrl}`;
        }

        // Build stylish response
        let caption = `❖━━━━━━━━━━━━━━━━━━━❖\n`;
        caption += `╔═══❖•ೋ° 📱 °ೋ•❖═══╗\n`;
        caption += `      𝗔𝗣𝗞 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻\n`;
        caption += `╚═══❖•ೋ° 📱 °ೋ•❖═══╝\n`;
        caption += `❖━━━━━━━━━━━━━━━━━━━❖\n\n`;
        
        caption += `┌─────────────────────┐\n`;
        caption += `│ 👑 𝗡𝗮𝗺𝗲    : ${appName.toUpperCase()}\n`;
        caption += `│ 📦 𝗣𝗮𝗰𝗸𝗮𝗴𝗲 : ${appPackage.toUpperCase()}\n`;
        caption += `│ 📏 𝗦𝗶𝘇𝗲    : ${appSize} MB\n`;
        caption += `│ 🔄 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${appVersion}\n`;
        caption += `└─────────────────────┘\n\n`;

        // Check if file is too large for WhatsApp
        if (parseFloat(appSize) > 95) { // 95MB to be safe
            caption += `⚠️ *File too large for WhatsApp!*\n`;
            caption += `📥 *Download Link:*\n${downloadUrl}\n\n`;
            caption += `💡 Open this link in your browser to download.\n\n`;
            caption += `❖━━━━━━━━━━━━━━━━━━━❖\n`;
            caption += `  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n`;
            caption += `❖━━━━━━━━━━━━━━━━━━━❖`;

            // Send info with icon
            if (appIcon) {
                try {
                    await sock.sendMessage(
                        chatId,
                        {
                            image: { url: appIcon },
                            caption: caption
                        },
                        { quoted: message }
                    );
                } catch (imgError) {
                    await sock.sendMessage(
                        chatId,
                        { text: caption },
                        { quoted: message }
                    );
                }
            } else {
                await sock.sendMessage(
                    chatId,
                    { text: caption },
                    { quoted: message }
                );
            }
            return;
        }

        // If file is small enough, send directly
        caption += `❖━━━━━━━━━━━━━━━━━━━❖\n`;
        caption += `      📥 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗶𝗻𝗴...\n`;
        caption += `    𝗣𝗹𝗲𝗮𝘀𝗲 𝗪𝗮𝗶𝘁 ⏳\n`;
        caption += `❖━━━━━━━━━━━━━━━━━━━❖`;

        // Send app info with icon
        if (appIcon) {
            try {
                await sock.sendMessage(
                    chatId,
                    {
                        image: { url: appIcon },
                        caption: caption
                    },
                    { quoted: message }
                );
            } catch (imgError) {
                await sock.sendMessage(
                    chatId,
                    { text: caption },
                    { quoted: message }
                );
            }
        } else {
            await sock.sendMessage(
                chatId,
                { text: caption },
                { quoted: message }
            );
        }

        // Send the APK file
        await sock.sendMessage(
            chatId,
            {
                document: { url: downloadUrl },
                mimetype: "application/vnd.android.package-archive",
                fileName: `${appName}.apk`,
                caption: `📱 *${appName}*\n\n✅ Download Complete!\n\n❖━━━━━━━━━━━━━━━━━━━❖\n  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n❖━━━━━━━━━━━━━━━━━━━❖`
            },
            { quoted: message }
        );

        console.log(`[APK] Successfully sent: ${appName}`);

    } catch (error) {
        console.error('[APK] Error:', error.message);
        
        let errorMessage = '❖━━━━━━━━━━━━━━━━━━━❖\n';
        errorMessage += '╔═══❖•ೋ° ❌ °ೋ•❖═══╗\n';
        errorMessage += '      𝗘𝗿𝗿𝗼𝗿 𝗢𝗰𝗰𝘂𝗿𝗿𝗲𝗱\n';
        errorMessage += '╚═══❖•ೋ° ❌ °ೋ•❖═══╝\n';
        errorMessage += '❖━━━━━━━━━━━━━━━━━━━❖\n\n';
        errorMessage += '🔴 ' + (error.message || 'Something went wrong.\nPlease try again.');
        errorMessage += '\n\n💡 Try:\n.apk whatsapp\n.apk facebook';
        errorMessage += '\n\n❖━━━━━━━━━━━━━━━━━━━❖\n';
        errorMessage += '  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n';
        errorMessage += '❖━━━━━━━━━━━━━━━━━━━❖';

        await sock.sendMessage(
            chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = apkCommand;
