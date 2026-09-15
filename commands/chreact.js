const axios = require('axios');

const API_URL = 'https://arslanmd-apis.site.je/api/whatsapp-chreacts.php';
const API_KEY = 'adf0046c5e7ba018faea46c8635519e4d303400f02853ee2317dd883671bd1f';

function parseArguments(rawText) {
    const match = String(rawText || '').match(/^\.chreact\b\s*(\S+)\s+(.+)$/i);
    if (!match) return null;
    return {
        link: match[1].trim(),
        emoji: match[2].trim()
    };
}

function isValidChannelLink(link) {
    try {
        const url = new URL(link);
        return url.protocol === 'https:' &&
            (url.hostname === 'whatsapp.com' || url.hostname.endsWith('.whatsapp.com')) &&
            /\/channel\/[^/]+\/\d+/i.test(url.pathname);
    } catch (_) {
        return false;
    }
}

async function chreactCommand(sock, chatId, rawText, message) {
    const args = parseArguments(rawText);
    if (!args || !isValidChannelLink(args.link) || !args.emoji) {
        await sock.sendMessage(chatId, {
            text: '╭━━━〔 ⚙️ 𝗖𝗛𝗔𝗡𝗡𝗘𝗟 𝗥𝗘𝗔𝗖𝗧 〕━━━╮\n┃ 𝗨𝘀𝗲:\n┃ *.chreact <channel-post-link> <emoji-list>*\n┃\n┃ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲:\n┃ *.chreact https://whatsapp.com/channel/xxx/850 🙂,🥰,😘\n╰━━━━━━━━━━━━━━━━━━━━━━╯'
        }, { quoted: message });
        return;
    }

    try {
        const response = await axios.get(API_URL, {
            params: {
                api_key: API_KEY,
                link: args.link,
                emoji: args.emoji
            },
            timeout: 30000,
            validateStatus: () => true
        });

        const body = response.data;
        if (response.status < 200 || response.status >= 300 ||
            (body && typeof body === 'object' && (body.success === false || body.status === false))) {
            throw new Error(body?.message || `API returned HTTP ${response.status}`);
        }

        await sock.sendMessage(chatId, {
            text: `╭━━━〔 ✅ 𝗥𝗘𝗔𝗖𝗧 𝗦𝗘𝗡𝗧 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 〕━━━╮\n┃ 𝗣𝗼𝘀𝘁: ${args.link}\n┃ 𝗘𝗺𝗼𝗷𝗶: ${args.emoji}\n┃\n┃ 𝗥𝗲𝗮𝗰𝘁 𝗦𝗲𝗻𝘁 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆\n┃ 𝗕𝘆: 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: message });
    } catch (error) {
        console.error('Channel react error:', error.response?.data || error.message);
        await sock.sendMessage(chatId, {
            text: `╭━━━〔 ❌ 𝗥𝗘𝗔𝗖𝗧 𝗙𝗔𝗜𝗟𝗘𝗗 〕━━━╮\n┃ ${error.message || 'API request failed'}\n┃ 𝗟𝗶𝗻𝗸 𝗮𝘂𝗿 𝗲𝗺𝗼𝗷𝗶 𝗰𝗵𝗲𝗰𝗸 𝗸𝗮𝗿𝗸𝗲 𝗱𝗼𝗯𝗮𝗿𝗮 𝘁𝗿𝘆 𝗸𝗮𝗿𝗲𝗶𝗻.\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: message });
    }
}

module.exports = chreactCommand;