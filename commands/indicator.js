const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { readSessionJson, writeSessionJson, BASE_DATA_DIR } = require('../lib/session_data');

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

const DEFAULT_CONFIG = {
    enabled: false,
    mode: 'white'
};

const ROOT_CONFIG_PATH = path.join(BASE_DATA_DIR, 'indicator.json');
const VALID_MODES = new Set(['blue', 'white', 'null']);
const handledMessages = new WeakMap();

// ===============================
// HELPER: Add Reaction
// ===============================
async function addReaction(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Reaction error:', error);
    }
}

// ===============================
// HELPER: Box Builder
// ===============================
function box(title, lines = []) {
    let out = `╭┈──〔 ${title} 〕┈──⊷\n`;
    for (const l of lines) out += `┋⋄ ➠ ${l}\n`;
    out += `╰─────────────────────⊷\n\n      𝗕𝘆 : 𝑅𝑼𝛣𝜦𝛣 × 𝑀𝑼𝑍𝜦𝑀𝜤𝐋`;
    return out;
}

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
    const sessionConfig = readSessionJson(sock, 'indicator.json', null);
    return normalizeConfig(sessionConfig || readRootConfig());
}

function saveConfig(sock, config) {
    const normalized = normalizeConfig(config);
    writeSessionJson(sock, 'indicator.json', normalized);
    const temporary = `${ROOT_CONFIG_PATH}.tmp`;
    fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(normalized, null, 2) + '\n');
    fs.renameSync(temporary, ROOT_CONFIG_PATH);
    return normalized;
}

function helpText() {
    return box('📡 ɪɴᴅɪᴄᴀᴛᴏʀ ᴄᴏᴍᴍᴀɴᴅs', [
        '📌 .ɪɴᴅɪᴄᴀᴛᴏʀ ᴏɴ/ᴏꜰꜰ/sᴛᴀᴛᴜs',
        '📌 .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ʙʟᴜᴇ',
        '📌 .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ᴡʜɪᴛᴇ',
        '📌 .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ɴᴜʟʟ',
        '━━━━━━━━━━━━━━━━━━',
        '🔵 ʙʟᴜᴇ  : ᴍᴇssᴀɢᴇ ʀᴇᴀᴅ / ʙʟᴜᴇ ᴛɪᴄᴋ',
        '⚪ ᴡʜɪᴛᴇ : ᴅᴇʟɪᴠᴇʀᴇᴅ / ɢʀᴇʏ ᴛɪᴄᴋ',
        '⚫ ɴᴜʟʟ  : ɴᴏ ʀᴇᴀᴅ ʀᴇᴄᴇɪᴘᴛ'
    ]);
}

async function ensureOwner(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const allowed = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!allowed) {
        await addReaction(sock, message, '⛔');
        await sock.sendMessage(chatId, {
            text: box('⛔ ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ', [
                '🔴 ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ᴏᴡɴᴇʀ/sᴜᴅᴏ ᴏɴʟʏ'
            ]),
            ...channelInfo
        }, { quoted: message });
    }
    return allowed;
}

// ===============================
// MAIN COMMAND
// ===============================
async function indicatorCommand(sock, chatId, message, match = '') {
    try {
        await addReaction(sock, message, '📡');

        if (!await ensureOwner(sock, chatId, message)) return;

        const arg = String(match || '').trim().toLowerCase();

        if (!arg || arg === 'status') {
            const config = getConfig(sock);
            if (arg === 'status') {
                await addReaction(sock, message, '📊');
                await sock.sendMessage(chatId, {
                    text: box('📊 ɪɴᴅɪᴄᴀᴛᴏʀ sᴛᴀᴛᴜs', [
                        `📌 sᴛᴀᴛᴜs : ${config.enabled ? '🟢 ᴏɴ' : '🔴 ᴏꜰꜰ'}`,
                        `🎨 ᴍᴏᴅᴇ  : ${config.mode.toUpperCase()}`,
                        '━━━━━━━━━━━━━━━━━━',
                        '🔵 ʙʟᴜᴇ  : ʀᴇᴀᴅ ʀᴇᴄᴇɪᴘᴛ',
                        '⚪ ᴡʜɪᴛᴇ : ɴᴏ ʀᴇᴀᴅ ʀᴇᴄᴇɪᴘᴛ',
                        '⚫ ɴᴜʟʟ  : ɴᴏ ʀᴇᴄᴇɪᴘᴛ'
                    ]),
                    ...channelInfo
                }, { quoted: message });
                return;
            }
            await addReaction(sock, message, '📖');
            await sock.sendMessage(chatId, { text: helpText(), ...channelInfo }, { quoted: message });
            return;
        }

        const config = getConfig(sock);

        if (arg === 'on' || arg === 'enable') {
            config.enabled = true;
            saveConfig(sock, config);
            await addReaction(sock, message, '✅');
            await sock.sendMessage(chatId, {
                text: box('✅ ɪɴᴅɪᴄᴀᴛᴏʀ ᴏɴ', [
                    `🎨 ᴍᴏᴅᴇ : ${config.mode.toUpperCase()}`
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        if (arg === 'off' || arg === 'disable') {
            config.enabled = false;
            saveConfig(sock, config);
            await addReaction(sock, message, '✅');
            await sock.sendMessage(chatId, {
                text: box('❌ ɪɴᴅɪᴄᴀᴛᴏʀ ᴏꜰꜰ', [
                    '🔴 sᴛᴀᴛᴜs : ᴅɪsᴀʙʟᴇᴅ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        await addReaction(sock, message, '📖');
        await sock.sendMessage(chatId, { text: helpText(), ...channelInfo }, { quoted: message });

    } catch (error) {
        console.error('Indicator command error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [
                `🔴 ${error.message || 'Something went wrong'}`
            ]),
            ...channelInfo
        }, { quoted: message });
    }
}

async function indicatorSetCommand(sock, chatId, message, match = '') {
    try {
        await addReaction(sock, message, '⚙️');

        if (!await ensureOwner(sock, chatId, message)) return;

        const mode = String(match || '').trim().toLowerCase().split(/\s+/)[0];

        if (!VALID_MODES.has(mode)) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: box('❌ ɪɴᴠᴀʟɪᴅ ᴍᴏᴅᴇ', [
                    '📌 ᴜsᴇ : .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ʙʟᴜᴇ',
                    '📌 ᴜsᴇ : .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ᴡʜɪᴛᴇ',
                    '📌 ᴜsᴇ : .ɪɴᴅɪᴄᴀᴛᴏʀsᴇᴛ ɴᴜʟʟ'
                ]),
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const config = getConfig(sock);
        config.mode = mode;
        config.enabled = true;
        saveConfig(sock, config);

        const modeDesc = mode === 'blue'
            ? 'ɪɴᴄᴏᴍɪɴɢ ᴍsɢs ᴡɪʟʟ ʙᴇ ᴍᴀʀᴋᴇᴅ ʀᴇᴀᴅ'
            : mode === 'white'
            ? 'ɪɴᴄᴏᴍɪɴɢ ᴍsɢs sᴛᴀʏ ᴅᴇʟɪᴠᴇʀᴇᴅ'
            : 'ɴᴏ ʀᴇᴄᴇɪᴘᴛ ᴡɪʟʟ ʙᴇ sᴇɴᴛ';

        await addReaction(sock, message, '✅');
        await sock.sendMessage(chatId, {
            text: box('✅ ɪɴᴅɪᴄᴀᴛᴏʀ ᴏɴ', [
                `🎨 ᴍᴏᴅᴇ : ${mode.toUpperCase()}`,
                `📝 ɪɴꜰᴏ : ${modeDesc}`
            ]),
            ...channelInfo
        }, { quoted: message });

    } catch (error) {
        console.error('Indicator set error:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: box('❌ ᴇʀʀᴏʀ', [`🔴 ${error.message || 'Something went wrong'}`]),
            ...channelInfo
        }, { quoted: message });
    }
}

// ===============================
// HANDLE INDICATOR
// ===============================
async function handleIndicator(sock, message) {
    try {
        const config = getConfig(sock);
        if (!config.enabled || message?.key?.fromMe) return false;
        if (!message?.key?.remoteJid || !message?.key?.id) return true;

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

        const receiptKey = {
            remoteJid: message.key.remoteJid,
            id: message.key.id,
            participant: message.key.participant
        };

        if (config.mode === 'blue' && typeof sock.readMessages === 'function') {
            await sock.readMessages([receiptKey]);
        } else if (config.mode === 'white' && typeof sock.sendReceipt === 'function') {
            await sock.sendReceipt(
                receiptKey.remoteJid,
                receiptKey.participant,
                [receiptKey.id],
                undefined
            );
        }
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