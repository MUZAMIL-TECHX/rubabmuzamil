const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, writeSessionJson } = require('../lib/session_data');

const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'white'
};

function getConfig(sock) {
    const value = readSessionJson(sock, 'indicator.json', DEFAULT_CONFIG);
    return {
        ...DEFAULT_CONFIG,
        ...value,
        mode: ['blue', 'white', 'null'].includes(value?.mode) ? value.mode : 'white'
    };
}

function saveConfig(sock, config) {
    writeSessionJson(sock, 'indicator.json', config);
    return config;
}

function helpText() {
    return [
        '╭━━━〔 ✅ 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥 〕━━━╮',
        '┃',
        '┃ ❍ .indicator on/off',
        '┃ ❍ .indicatorset blue',
        '┃ ❍ .indicatorset white',
        '┃ ❍ .indicatorset null',
        '┃',
        '┃ 𝗕𝗹𝘂𝗲: message read / blue tick',
        '┃ 𝗪𝗵𝗶𝘁𝗲: delivered / grey double tick',
        '┃ 𝗡𝘂𝗹𝗹: no explicit read receipt',
        '╰━━━━━━━━━━━━━━━━━━━━━━╯'
    ].join('\n');
}

async function ensureOwner(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const allowed = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!allowed) {
        await sock.sendMessage(chatId, {
            text: '❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗼𝗻𝗹𝘆 𝗳𝗼𝗿 𝘁𝗵𝗲 𝗼𝘄𝗻𝗲𝗿/𝘀𝘂𝗱𝗼.',
            quoted: message
        });
    }
    return allowed;
}

async function indicatorCommand(sock, chatId, message, match = '') {
    if (!await ensureOwner(sock, chatId, message)) return;

    const arg = String(match || '').trim().toLowerCase();
    if (!arg) {
        await sock.sendMessage(chatId, { text: helpText(), quoted: message });
        return;
    }

    const config = getConfig(sock);
    if (arg === 'on' || arg === 'enable') {
        config.enabled = true;
        saveConfig(sock, config);
        await sock.sendMessage(chatId, {
            text: `✅ 𝗜𝗻𝗱𝗶𝗰𝗮𝘁𝗼𝗿 𝗶𝘀 𝗻𝗼𝘄 𝗢𝗡\n❍ 𝗠𝗼𝗱𝗲: ${config.mode}`,
            quoted: message
        });
        return;
    }

    if (arg === 'off' || arg === 'disable') {
        config.enabled = false;
        saveConfig(sock, config);
        await sock.sendMessage(chatId, {
            text: '✅ 𝗜𝗻𝗱𝗶𝗰𝗮𝘁𝗼𝗿 𝗶𝘀 𝗻𝗼𝘄 𝗢𝗙𝗙',
            quoted: message
        });
        return;
    }

    await sock.sendMessage(chatId, { text: helpText(), quoted: message });
}

async function indicatorSetCommand(sock, chatId, message, match = '') {
    if (!await ensureOwner(sock, chatId, message)) return;

    const mode = String(match || '').trim().toLowerCase();
    if (!['blue', 'white', 'null'].includes(mode)) {
        await sock.sendMessage(chatId, {
            text: '❌ 𝗨𝘀𝗲: .indicatorset blue/white/null',
            quoted: message
        });
        return;
    }

    const config = getConfig(sock);
    config.mode = mode;
    saveConfig(sock, config);
    await sock.sendMessage(chatId, {
        text: `✅ 𝗜𝗻𝗱𝗶𝗰𝗮𝘁𝗼𝗿 𝗺𝗼𝗱𝗲 𝘀𝗲𝘁 𝘁𝗼: ${mode.toUpperCase()}`,
        quoted: message
    });
}

// Returns true when custom indicator settings are active, so the older
// autoread feature cannot accidentally turn a white/null indicator blue.
async function handleIndicator(sock, message) {
    try {
        const config = getConfig(sock);
        if (!config.enabled || message?.key?.fromMe) return false;
        if (!message?.key?.remoteJid || !message?.key?.id) return true;

        if (config.mode === 'blue' && typeof sock.readMessages === 'function') {
            await sock.readMessages([{
                remoteJid: message.key.remoteJid,
                id: message.key.id,
                participant: message.key.participant
            }]);
        }
        // WhatsApp sends the normal delivered/grey receipt without an
        // explicit read receipt. There is no reliable client-side API for
        // forcing a different grey/white glyph.
        return true;
    } catch (error) {
        console.error('⚠️ Indicator handling skipped:', error?.message || error);
        return true;
    }
}

module.exports = {
    indicatorCommand,
    indicatorSetCommand,
    handleIndicator,
    getIndicatorConfig: getConfig
};