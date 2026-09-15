const { readSessionJson, writeSessionJson } = require('../lib/session_data');
const isAdmin = require('../lib/isAdmin');

const DEFAULT_CONFIG = {
    enabled: false,
    action: 'delete'
};

const VALID_ACTIONS = new Set(['warn', 'kick', 'delete']);

function getConfig(sock) {
    return {
        ...DEFAULT_CONFIG,
        ...readSessionJson(sock, 'antistatus.json', {})
    };
}

function setConfig(sock, patch) {
    const config = {
        ...getConfig(sock),
        ...patch
    };
    writeSessionJson(sock, 'antistatus.json', config);
    return config;
}

function getWarnings(sock) {
    return readSessionJson(sock, 'antistatusWarnings.json', {});
}

function incrementWarning(sock, chatId, senderId) {
    const warnings = getWarnings(sock);
    if (!warnings[chatId]) warnings[chatId] = {};
    warnings[chatId][senderId] = (Number(warnings[chatId][senderId]) || 0) + 1;
    writeSessionJson(sock, 'antistatusWarnings.json', warnings);
    return warnings[chatId][senderId];
}

function clearWarnings(sock, chatId, senderId) {
    const warnings = getWarnings(sock);
    if (warnings[chatId]?.[senderId]) {
        delete warnings[chatId][senderId];
        writeSessionJson(sock, 'antistatusWarnings.json', warnings);
    }
}

function messageContainsStatusMention(message) {
    const root = message?.message;
    if (!root || typeof root !== 'object') return false;

    const statusKeys = new Set([
        'statusmentionmessage',
        'groupstatusmentionmessage',
        'statusmention'
    ]);

    function scan(node, depth = 0) {
        if (!node || typeof node !== 'object' || depth > 8) return false;
        for (const [key, value] of Object.entries(node)) {
            const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (statusKeys.has(normalized)) return true;
            if (value && typeof value === 'object' && scan(value, depth + 1)) return true;
        }
        return false;
    }

    return scan(root);
}

function deleteGroupMessage(sock, chatId, message, senderId) {
    return sock.sendMessage(chatId, {
        delete: {
            remoteJid: chatId,
            fromMe: false,
            id: message.key.id,
            participant: senderId
        }
    });
}

function displayName(jid) {
    return `@${String(jid || '').split('@')[0].split(':')[0] || 'user'}`;
}

async function handleAntiStatusCommand(sock, chatId, rawText, senderId, message) {
    if (!chatId?.endsWith('@g.us')) {
        await sock.sendMessage(chatId, {
            text: '╭━━━〔 ⚠️ 𝗚𝗥𝗢𝗨𝗣 𝗢𝗡𝗟𝗬 〕━━━╮\n┃ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗳𝗼𝗿 𝗴𝗿𝗼𝘂𝗽𝘀 𝗼𝗻𝗹𝘆.\n╰━━━━━━━━━━━━━━━━━━━━╯'
        }, { quoted: message });
        return true;
    }

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, {
            text: '╭━━━〔 ⚠️ 𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗤𝗨𝗜𝗥𝗘𝗗 〕━━━╮\n┃ 𝗣𝗹𝗲𝗮𝘀𝗲 𝗺𝗮𝗸𝗲 𝗺𝗲 𝗮 𝗴𝗿𝗼𝘂𝗽 𝗮𝗱𝗺𝗶𝗻 𝗳𝗶𝗿𝘀𝘁.\n╰━━━━━━━━━━━━━━━━━━━━━━╯'
        }, { quoted: message });
        return true;
    }
    if (!isSenderAdmin && !message.key.fromMe) {
        await sock.sendMessage(chatId, {
            text: '⚠️ 𝗢𝗻𝗹𝘆 𝗴𝗿𝗼𝘂𝗽 𝗮𝗱𝗺𝗶𝗻𝘀 𝗰𝗮𝗻 𝗰𝗵𝗮𝗻𝗴𝗲 𝗔𝗻𝘁𝗶-𝗦𝘁𝗮𝘁𝘂𝘀 𝘀𝗲𝘁𝘁𝗶𝗻𝗴𝘀.'
        }, { quoted: message });
        return true;
    }

    const match = String(rawText || '').match(/^\.antistatus(?:set)?\b\s*(.*)$/i);
    const command = String(rawText || '').toLowerCase().startsWith('.antistatusset')
        ? 'set'
        : 'toggle';
    const argument = (match?.[1] || '').trim().toLowerCase();
    const config = getConfig(sock);

    if (command === 'set') {
        if (!VALID_ACTIONS.has(argument)) {
            await sock.sendMessage(chatId, {
                text: '╭━━━〔 ⚙️ 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━╮\n┃ 𝗨𝘀𝗲: *.antistatusset warn*\n┃ 𝗢𝗿:  *.antistatusset kick*\n┃ 𝗢𝗿:  *.antistatusset delete*\n╰━━━━━━━━━━━━━━━━━━━━━━╯'
            }, { quoted: message });
            return true;
        }
        setConfig(sock, { action: argument });
        await sock.sendMessage(chatId, {
            text: `╭━━━〔 ✅ 𝗦𝗘𝗧𝗧𝗜𝗡𝗚 𝗨𝗣𝗗𝗔𝗧𝗘𝗗 〕━━━╮\n┃ 𝗔𝗻𝘁𝗶-𝗦𝘁𝗮𝘁𝘂𝘀 𝗮𝗰𝘁𝗶𝗼𝗻: *${argument.toUpperCase()}*\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀: ${config.enabled ? '*ON*' : '*OFF*'}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
        }, { quoted: message });
        return true;
    }

    if (argument === 'on' || argument === 'off') {
        const next = argument === 'on';
        setConfig(sock, { enabled: next });
        await sock.sendMessage(chatId, {
            text: next
                ? `╭━━━〔 ✅ 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 𝗢𝗡 〕━━━╮\n┃ 𝗔𝗰𝘁𝗶𝗼𝗻: *${config.action.toUpperCase()}*\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗺𝗲𝗻𝘁𝗶𝗼𝗻𝘀 𝘄𝗶𝗹𝗹 𝗯𝗲 𝗵𝗮𝗻𝗱𝗹𝗲𝗱.\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
                : '╭━━━〔 📴 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 𝗢𝗙𝗙 〕━━━╮\n┃ 𝗡𝗼 𝗮𝗰𝘁𝗶𝗼𝗻 𝘄𝗶𝗹𝗹 𝗯𝗲 𝘁𝗮𝗸𝗲𝗻.\n╰━━━━━━━━━━━━━━━━━━━━━━╯'
        }, { quoted: message });
        return true;
    }

    await sock.sendMessage(chatId, {
        text: `╭━━━〔 ⚙️ 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━╮\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀: *${config.enabled ? 'ON' : 'OFF'}*\n┃ 𝗔𝗰𝘁𝗶𝗼𝗻: *${config.action.toUpperCase()}*\n┃\n┃ *.antistatus on/off*\n┃ *.antistatusset warn/kick/delete*\n╰━━━━━━━━━━━━━━━━━━━━━━╯`
    }, { quoted: message });
    return true;
}

async function handleAntiStatus(sock, chatId, message, senderId) {
    try {
        const config = getConfig(sock);
        if (!config.enabled || !chatId?.endsWith('@g.us') || message.key?.fromMe) return false;
        if (!messageContainsStatusMention(message)) return false;

        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        // Never moderate group admins or the connected account.
        if (isSenderAdmin) return false;
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '⚠️ 𝗔𝗻𝘁𝗶-𝗦𝘁𝗮𝘁𝘂𝘀: 𝗺𝗲 𝗱𝗲𝗹𝗲𝘁𝗲/𝗸𝗶𝗰𝗸 𝗸𝗲 𝗹𝗶𝘆𝗲 𝗴𝗿𝗼𝘂𝗽 𝗮𝗱𝗺𝗶𝗻 𝗯𝗮𝗻𝗮𝗼.'
            });
            return true;
        }

        await deleteGroupMessage(sock, chatId, message, senderId);
        const name = displayName(senderId);

        if (config.action === 'delete') {
            await sock.sendMessage(chatId, {
                text: `╭━━━〔 🛡️ 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━╮\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗺𝗲𝗻𝘁𝗶𝗼𝗻 𝗱𝗲𝗹𝗲𝘁𝗲𝗱.\n┃ 𝗨𝘀𝗲𝗿: ${name}\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
                mentions: [senderId]
            });
            return true;
        }

        if (config.action === 'kick') {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            await sock.sendMessage(chatId, {
                text: `╭━━━〔 🚫 𝗔𝗡𝗧𝗜-𝗦𝗧𝗔𝗧𝗨𝗦 〕━━━╮\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗺𝗲𝗻𝘁𝗶𝗼𝗻 𝗱𝗲𝗹𝗲𝘁𝗲𝗱.\n┃ ${name} 𝗸𝗶𝗰𝗸 𝗸𝗮𝗿 𝗱𝗶𝘆𝗮 𝗴𝗮𝘆𝗮.\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
                mentions: [senderId]
            });
            return true;
        }

        const warningCount = incrementWarning(sock, chatId, senderId);
        if (warningCount >= 3) {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            clearWarnings(sock, chatId, senderId);
            await sock.sendMessage(chatId, {
                text: `╭━━━〔 🚫 𝗙𝗜𝗡𝗔𝗟 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 〕━━━╮\n┃ ${name} 𝗸𝗼 𝟯 𝘄𝗮𝗿𝗻𝗶𝗻𝗴𝘀 𝗸𝗲 𝗯𝗮𝗮𝗱 𝗸𝗶𝗰𝗸 𝗸𝗶𝘆𝗮 𝗴𝗮𝘆𝗮.\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
                mentions: [senderId]
            });
        } else {
            await sock.sendMessage(chatId, {
                text: `╭━━━〔 ⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚 〕━━━╮\n┃ 𝗦𝘁𝗮𝘁𝘂𝘀 𝗺𝗲𝗻𝘁𝗶𝗼𝗻 𝗱𝗲𝗹𝗲𝘁𝗲𝗱.\n┃ 𝗨𝘀𝗲𝗿: ${name}\n┃ 𝗪𝗮𝗿𝗻𝗶𝗻𝗴: *${warningCount}/3*\n┃ 𝟯𝗿𝗱 𝘄𝗮𝗿𝗻𝗶𝗻𝗴 𝗽𝗮𝗿 𝗸𝗶𝗰𝗸 𝗵𝗼𝗴𝗮.\n╰━━━━━━━━━━━━━━━━━━━━━━╯`,
                mentions: [senderId]
            });
        }
        return true;
    } catch (error) {
        console.error('Anti-status error:', error);
        return false;
    }
}

module.exports = {
    handleAntiStatusCommand,
    handleAntiStatus,
    messageContainsStatusMention
};