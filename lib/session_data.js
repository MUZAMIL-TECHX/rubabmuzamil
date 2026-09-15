const fs = require('fs');
const path = require('path');
const appSettings = require('../settings');

const BASE_DATA_DIR = path.join(__dirname, '../data');

const DEFAULT_SESSION_SETTINGS = {
    botName: '𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗',
    ownerName: appSettings.botOwner || 'Muzamil Khan',
    ownerNumber: appSettings.ownerNumber || '923433740855',
    description: appSettings.description || 'This is a bot for managing group commands and automating tasks.',
    botDp: 'https://i.ibb.co/yz79pyg/1000040527.png'
};

function ensureSessionDataDir(sock) {
    const dir = sock?.dataDir || BASE_DATA_DIR;
    fs.mkdirSync(dir, { recursive: true });

    // Seed a new account with the shipped defaults, without sharing the
    // files afterwards. Existing accounts keep their own settings.
    if (dir !== BASE_DATA_DIR) {
        for (const file of fs.readdirSync(BASE_DATA_DIR)) {
            const source = path.join(BASE_DATA_DIR, file);
            const target = path.join(dir, file);
            if (fs.statSync(source).isFile() && !fs.existsSync(target)) {
                fs.copyFileSync(source, target);
            }
        }
    }
    return dir;
}

function dataPath(sock, fileName) {
    return path.join(ensureSessionDataDir(sock), fileName);
}

function readSessionJson(sock, fileName, fallback = {}) {
    try {
        return JSON.parse(fs.readFileSync(dataPath(sock, fileName), 'utf8'));
    } catch (_) {
        return fallback;
    }
}

function writeSessionJson(sock, fileName, value) {
    const target = dataPath(sock, fileName);
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
    fs.renameSync(temporary, target);
}

function getSessionSettings(sock) {
    const settings = readSessionJson(sock, 'sessionSettings.json', {});
    return {
        ...DEFAULT_SESSION_SETTINGS,
        ...settings,
        // Never let malformed persisted values break command handling.
        ownerName: typeof settings.ownerName === 'string' && settings.ownerName.trim()
            ? settings.ownerName.trim()
            : DEFAULT_SESSION_SETTINGS.ownerName,
        ownerNumber: typeof settings.ownerNumber === 'string' && settings.ownerNumber.trim()
            ? settings.ownerNumber.replace(/[^\d]/g, '')
            : DEFAULT_SESSION_SETTINGS.ownerNumber,
        description: typeof settings.description === 'string' && settings.description.trim()
            ? settings.description.trim()
            : DEFAULT_SESSION_SETTINGS.description
    };
}

function updateSessionSettings(sock, patch) {
    const current = getSessionSettings(sock);
    const next = { ...current, ...patch };
    writeSessionJson(sock, 'sessionSettings.json', next);
    return next;
}

module.exports = {
    BASE_DATA_DIR,
    ensureSessionDataDir,
    dataPath,
    readSessionJson,
    writeSessionJson,
    DEFAULT_SESSION_SETTINGS,
    getSessionSettings,
    updateSessionSettings
};