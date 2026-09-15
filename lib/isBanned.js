const { readSessionJson } = require('./session_data');

function isBanned(userId, sock = null) {
    try {
        const bannedUsers = readSessionJson(sock, 'banned.json', []);
        return bannedUsers.includes(userId);
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned }; 