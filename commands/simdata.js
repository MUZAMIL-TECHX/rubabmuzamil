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

function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

async function simdataCommand(sock, chatId, message, input) {
    try {
        // 🔍 Start reaction
        await addReaction(sock, message, '📊');

        if (!input) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('📊 sɪᴍ ᴅᴀᴛᴀ ʟᴏᴏᴋᴜᴘ', [
                    '📌 ᴜsᴀɢᴇ : .sɪᴍᴅᴀᴛᴀ [ɴᴜᴍʙᴇʀ]',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 1 : .sɪᴍᴅᴀᴛᴀ 3101234567',
                    '🔍 ᴇxᴀᴍᴘʟᴇ 2 : .sɪᴍᴅᴀᴛᴀ 4120112345678',
                    '⚠️ ᴇɴᴛᴇʀ ᴍᴏʙɪʟᴇ ᴏʀ ᴄɴɪᴄ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // Clean input
        const cleanInput = input.replace(/[\s\-+]/g, '');

        if (!/^\d{10,13}$/.test(cleanInput)) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɪɴᴠᴀʟɪᴅ ꜰᴏʀᴍᴀᴛ', [
                    '📌 ᴍᴏʙɪʟᴇ : .sɪᴍᴅᴀᴛᴀ 3101234567',
                    '📌 ᴄɴɪᴄ   : .sɪᴍᴅᴀᴛᴀ 4120112345678',
                    '⚠️ 10-13 ᴅɪɢɪᴛs ᴏɴʟʏ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        // 🔄 Processing reaction
        await addReaction(sock, message, '🔄');
        await sock.sendPresenceUpdate('composing', chatId);

        // ✅ NEW API from HTML
        const apiUrl = `https://sim-db-api.faizankhichi.me/?search=${cleanInput}`;
        console.log(`[SIM DATA] Requesting: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;

        // ✅ Check API response (HTML format: { data: [...] })
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɴᴏ ᴅᴀᴛᴀ ꜰᴏᴜɴᴅ', [
                    `📭 ɴᴏ ʀᴇᴄᴏʀᴅs ꜰᴏʀ : ${cleanInput}`,
                    '💡 ᴄʜᴇᴄᴋ ɴᴜᴍʙᴇʀ/ᴄɴɪᴄ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const records = data.data;
        const totalCount = records.length;

        // Build stylish response
        let reply = `╭┈──〔 📊 sɪᴍ ᴅᴀᴛᴀ ʀᴇsᴜʟᴛ 〕┈──⊷\n`;
        reply += `┋⋄ ➠ 📱 ǫᴜᴇʀʏ : ${cleanInput}\n`;
        reply += `┋⋄ ➠ 📊 ᴛᴏᴛᴀʟ : ${totalCount}\n`;
        reply += `╰─────────────────────⊷\n\n`;

        records.forEach((record, index) => {
            const name = record.nam || 'Unknown';
            const mobile = record.nbr || 'N/A';
            const cnic = record.cni || 'N/A';
            const address = record.adr || 'N/A';

            // Format CNIC
            const formattedCnic = cnic !== 'N/A' && cnic !== 'NO' && cnic.length === 13 
                ? cnic.replace(/(\d{5})(\d{7})(\d{1})/, '$1-$2-$3')
                : cnic;

            // Format mobile
            const formattedMobile = mobile !== 'N/A' && mobile.length === 11
                ? mobile.replace(/(\d{4})(\d{4})(\d{3})/, '$1-$2-$3')
                : mobile;

            // Name check
            const isNotFound = name === 'NOT FOUND' || 
                              name === 'DATA NOT RECIEVED FROM NADRA' || 
                              name === 'NO DATA' ||
                              name === 'Unknown';

            reply += `╭┈──〔 👤 ʀᴇᴄᴏʀᴅ #${index + 1} 〕┈──⊷\n`;
            
            if (!isNotFound) {
                reply += `┋⋄ ➠ 👤 ɴᴀᴍᴇ    : ${name}\n`;
            } else {
                reply += `┋⋄ ➠ 👤 ɴᴀᴍᴇ    : ❌ ɴᴏᴛ ꜰᴏᴜɴᴅ\n`;
            }
            
            reply += `┋⋄ ➠ 📞 ᴍᴏʙɪʟᴇ  : ${formattedMobile}\n`;
            
            if (cnic !== 'N/A' && cnic !== 'NO' && cnic !== 'NO DATA' && cnic !== '') {
                reply += `┋⋄ ➠ 🆔 ᴄɴɪᴄ    : ${formattedCnic}\n`;
            } else {
                reply += `┋⋄ ➠ 🆔 ᴄɴɪᴄ    : ❌ ɴ/ᴀ\n`;
            }
            
            if (address !== 'N/A' && address !== 'NO' && address !== 'NO DATA' && address !== '' && address !== 'NO ADDRESS') {
                const shortAddress = address.length > 40 ? address.substring(0, 37) + '...' : address;
                reply += `┋⋄ ➠ 📍 ᴀᴅᴅʀᴇss : ${shortAddress}\n`;
            } else {
                reply += `┋⋄ ➠ 📍 ᴀᴅᴅʀᴇss : ❌ ɴ/ᴀ\n`;
            }
            
            reply += `╰─────────────────────⊷\n\n`;
        });

        reply += `      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;

        await sock.sendMessage(chatId, {
            text: reply,
            ...channelInfo
        }, { quoted: message });

        // ✅ Done reaction
        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('[SIM DATA] Error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Something went wrong';
        if (error.code === 'ECONNABORTED') errorMsg = 'Request timed out. Try again.';
        else if (error.response?.status === 404) errorMsg = 'API not found.';
        else if (error.response?.status === 429) errorMsg = 'Rate limited. Try later.';
        else if (error.message.includes('ENOTFOUND')) errorMsg = 'No internet connection.';

        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${errorMsg}`,
                '💡 ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = simdataCommand;