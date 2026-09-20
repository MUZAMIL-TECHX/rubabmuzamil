const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, writeSessionJson, BASE_DATA_DIR } = require('../lib/session_data');

const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'white'
};

const ROOT_CONFIG_PATH = path.join(BASE_DATA_DIR, 'indicator.json');
const VALID_MODES = new Set(['blue', 'white', 'null']);
const handledMessages = new WeakMap();

function normalizeConfig(value) {
    const config = value && typeof value === 'object' ? value : {};
    return {
        ...DEFAULT_CONFIG,
        ...config,
        enabled: config.enabled === true,
        mode: VALID_MODES.has(config.mode) ? config.mode : DEFAULT_CONFIG.mode
    };
}

function readRootConfig() {
    try {
        return normalizeConfig(JSON.parse(fs.readFileSync(ROOT_CONFIG_PATH, 'utf8')));
    } catch (_) {
        return { ...DEFAULT_CONFIG };
    }
}

function getConfig(sock) {
    // Keep account settings isolated when a socket has a session directory,
    // while also maintaining data/indicator.json as the canonical shipped
    // config and fallback for the first/default socket.
    const sessionConfig = readSessionJson(sock, 'indicator.json', null);
    return normalizeConfig(sessionConfig || readRootConfig());
}

function saveConfig(sock, config) {
    const normalized = normalizeConfig(config);
    writeSessionJson(sock, 'indicator.json', normalized);

    // The root file is intentionally kept in sync so deployments that use
    // the default data directory, panel-side tools, and newly created
    // sessions all see the same setting.
    const temporary = `${ROOT_CONFIG_PATH}.tmp`;
    fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(normalized, null, 2) + '\n');
    fs.renameSync(temporary, ROOT_CONFIG_PATH);
    return normalized;
}

function helpText() {
    return [
        '╭━━━〔 ✅ 𝗜𝗡𝗗𝗜𝗖𝗔𝗧𝗢𝗥 〕━━━╮',
        '┃',
        '┃ ❍ .indicator on/off/status',
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
    if (!arg || arg === 'status') {
        const config = getConfig(sock);
        if (arg === 'status') {
            await sock.sendMessage(chatId, {
                text: `📡 𝗜𝗻𝗱𝗶𝗰𝗮𝘁𝗼𝗿 𝗦𝘁𝗮𝘁𝘂𝘀\n❍ Status: ${config.enabled ? 'ON' : 'OFF'}\n❍ Mode: ${config.mode.toUpperCase()}\n❍ Blue: explicit read receipt / blue tick\n❍ White: no read receipt / grey double tick`,
                quoted: message
            });
            return;
        }
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

    const mode = String(match || '').trim().toLowerCase().split(/\s+/)[0];
    if (!VALID_MODES.has(mode)) {
        await sock.sendMessage(chatId, {
            text: '❌ 𝗨𝘀𝗲: .indicatorset blue/white/null',
            quoted: message
        });
        return;
    }

    const config = getConfig(sock);
    config.mode = mode;
    // Selecting a mode is an explicit request to use the indicator. This
    // avoids the confusing state where .indicatorset reports success but the
    // feature remains disabled until a second command is sent.
    config.enabled = true;
    saveConfig(sock, config);
    await sock.sendMessage(chatId, {
        text: `✅ 𝗜𝗻𝗱𝗶𝗰𝗮𝘁𝗼𝗿 𝗶𝘀 𝗢𝗡\n❍ 𝗠𝗼𝗱𝗲: ${mode.toUpperCase()}\n❍ ${mode === 'blue' ? 'Incoming messages will be marked read (blue tick).' : 'Incoming messages will stay delivered (grey double tick).'}`,
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

        // The same message may be delivered to the handler more than once.
        // Avoid sending two read receipts for that message.
        const messageKey = [
            message.key.remoteJid,
            message.key.id,
            message.key.participant || ''
        ].join('|');
        let recent = handledMessages.get(sock);
        if (!recent) {
            recent = new Map();
            handledMessages.set(sock, recent);
        }
        const now = Date.now();
        for (const [key, timestamp] of recent) {
            if (now - timestamp > 60_000) recent.delete(key);
        }
        if (recent.has(messageKey)) return true;
        recent.set(messageKey, now);

        if (config.mode === 'blue' && typeof sock.readMessages === 'function') {
            await sock.readMessages([{
                remoteJid: message.key.remoteJid,
                id: message.key.id,
                participant: message.key.participant
            }]);
        }
        // White/null deliberately do not call readMessages(). WhatsApp then
        // leaves the normal delivered/grey double tick in place. There is no
        // client-side API that can manufacture a different grey glyph.
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