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

// Validate MediaFire URL
function isValidMediafireUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname === 'mediafire.com' || 
               hostname === 'www.mediafire.com' || 
               hostname === 'm.mediafire.com' ||
               hostname.endsWith('.mediafire.com');
    } catch {
        return false;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = parseFloat(bytes);
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function mediafireCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '📥');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 📥 *MEDIAFIRE DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .mediafire [link]
┃ ❍ Example : .mediafire https://www.mediafire.com/file/xxxxx
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Validate MediaFire URL
        if (!isValidMediafireUrl(url)) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *INVALID LINK* 〕━━━┈⊷
┃ ❍ Not a valid MediaFire link
┃ ❍ Please check and try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // 🔄 Processing reaction
        await addReaction(sock, message, '🔄');

        // Call Arslan API
        const apiUrl = `https://arslan-apis-v2.vercel.app/download/mfire?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // ✅ Check if API returned success
        if (!data.status || !data.result) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *FAILED* 〕━━━┈⊷
┃ ❍ ${data.message || 'Could not fetch file from MediaFire'}
┃ ❍ File might be private or deleted
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const fileData = data.result;
        const fileName = fileData.fileName || 'Unknown';
        const fileType = fileData.fileType || 'Unknown';
        const fileSize = fileData.size || 'Unknown';
        const fileDate = fileData.date || 'Unknown';
        const dlLink = fileData.dl_link;

        if (!dlLink) {
            await addReaction(sock, message, '❌');
            return await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO DOWNLOAD LINK* 〕━━━┈⊷
┃ ❍ Could not extract download link
┃ ❍ Try again with a different link
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        // ✅ Send file info first
        const infoCaption = `
╭━━━〔 📄 *FILE FOUND* 〕━━━┈⊷
┃ ❍ File : ${fileName}
┃ ❍ Type : ${fileType}
┃ ❍ Size : ${fileSize}
┃ ❍ Date : ${fileDate}
┃ ❍ Status : Downloading...
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;

        await sock.sendMessage(chatId, {
            text: infoCaption
        }, { quoted: message });

        // ✅ Check file size (WhatsApp limit ~100MB for documents)
        let fileSizeBytes = 0;
        let sizeInMB = 0;
        let sizeWarning = '';

        try {
            // Try to get file size from API response
            if (fileSize.includes('KB')) {
                const kb = parseFloat(fileSize.replace('KB', '').trim());
                fileSizeBytes = kb * 1024;
            } else if (fileSize.includes('MB')) {
                const mb = parseFloat(fileSize.replace('MB', '').trim());
                fileSizeBytes = mb * 1024 * 1024;
                sizeInMB = mb;
            } else if (fileSize.includes('GB')) {
                const gb = parseFloat(fileSize.replace('GB', '').trim());
                fileSizeBytes = gb * 1024 * 1024 * 1024;
                sizeInMB = gb * 1024;
            }
        } catch (e) {
            console.log('Could not parse file size');
        }

        // Warning for large files
        if (sizeInMB > 100) {
            sizeWarning = `\n⚠️ File is ${fileSize} (may fail if >100MB)`;
        }

        // ✅ Try to download and send file
        try {
            // Send file as document
            const documentCaption = `
╭━━━〔 ✅ *DOWNLOAD COMPLETE* 〕━━━┈⊷
┃ ❍ File : ${fileName}
┃ ❍ Size : ${fileSize}
┃ ❍ Status : Sent ✅${sizeWarning}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;

            await sock.sendMessage(chatId, {
                document: { url: dlLink },
                mimetype: fileType || 'application/octet-stream',
                fileName: fileName,
                caption: documentCaption
            }, { quoted: message });

            // ✅ Done reaction
            await addReaction(sock, message, '✅');

        } catch (sendError) {
            console.error('Send error:', sendError);
            
            // ✅ Fallback: Send download link only
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ⚠️ *CANNOT SEND FILE* 〕━━━┈⊷
┃ ❍ File : ${fileName}
┃ ❍ Size : ${fileSize}
┃ ❍ Status : Failed to send via WhatsApp
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 📥 *MANUAL DOWNLOAD* 〕━━━┈⊷
┃ ❍ Copy this link in browser:
┃ ❍ ${dlLink}
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

    } catch (error) {
        console.error('MediaFire command error:', error);
        await addReaction(sock, message, '❌');
        
        let errorMsg = error.message || 'Something went wrong';
        if (error.code === 'ECONNABORTED') {
            errorMsg = 'Request timeout. Try again.';
        } else if (error.response?.status === 404) {
            errorMsg = 'File not found. It may be deleted.';
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

module.exports = mediafireCommand;
