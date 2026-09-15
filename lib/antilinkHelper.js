const { readSessionJson, writeSessionJson } = require('./session_data');

function loadAntilinkSettings(sock) {
    return readSessionJson(sock, 'antilinkSettings.json', {});
}

function saveAntilinkSettings(settings, sock) {
    writeSessionJson(sock, 'antilinkSettings.json', settings);
}

function setAntilinkSetting(groupId, type, sock) {
    const settings = loadAntilinkSettings(sock);
    settings[groupId] = type;
    saveAntilinkSettings(settings, sock);
}

function getAntilinkSetting(groupId, sock) {
    const settings = loadAntilinkSettings(sock);
    return settings[groupId] || 'off';
}

module.exports = {
    setAntilinkSetting,
    getAntilinkSetting
};
