const { readSessionJson, writeSessionJson } = require('../lib/session_data');

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

function cleanJid(jid) {
    return String(jid || '').split(':')[0];
}

function getData(sock) {
    const data = readSessionJson(sock, 'sos.json', { groups: {} });
    if (!data.groups || typeof data.groups !== 'object') data.groups = {};
    return data;
}

function getMentionedJids(message) {
    return message.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        message.message?.contextInfo?.mentionedJid || [];
}

async function sosCommand(sock, chatId, message, mode) {
    try {
        await addReaction(sock, message, '🛡️');

        if (!chatId.endsWith('@g.us')) {
            await addReaction(sock, message, '❌');
            return sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *GROUP ONLY* 〕━━━┈⊷
┃ ❍ This command can only be used in a group
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const jids = getMentionedJids(message).map(cleanJid).filter(Boolean);
        if (!jids.length) {
            await addReaction(sock, message, '❌');
            return sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *NO MENTION* 〕━━━┈⊷
┃ ❍ Mention an admin to ${mode === 'add' ? 'add to' : 'remove from'} SOS list
┃ ❍ Example : .sos add @admin
┃ ❍ Example : .sos remove @admin
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
            }, { quoted: message });
        }

        const data = getData(sock);
        const current = new Set((data.groups[chatId] || []).map(cleanJid));
        jids.forEach(jid => mode === 'add' ? current.add(jid) : current.delete(jid));
        data.groups[chatId] = [...current];
        writeSessionJson(sock, 'sos.json', data);

        const names = jids.map(jid => `@${jid.split('@')[0]}`).join(', ');
        
        let resultText = '';
        let reactionEmoji = '';

        if (mode === 'add') {
            resultText = `
╭━━━〔 🛡️ *SOS LIST UPDATED* 〕━━━┈⊷
┃ ❍ ${names}
┃ ❍ Status : Added to SOS List 🔒
┃ ❍ Action : Cannot perform admin actions
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;
            reactionEmoji = '🔒';
        } else {
            resultText = `
╭━━━〔 🛡️ *SOS LIST UPDATED* 〕━━━┈⊷
┃ ❍ ${names}
┃ ❍ Status : Removed from SOS List ✅
┃ ❍ Action : Can now perform admin actions
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`;
            reactionEmoji = '✅';
        }

        await addReaction(sock, message, reactionEmoji);
        return sock.sendMessage(chatId, { 
            text: resultText, 
            mentions: jids 
        }, { quoted: message });

    } catch (error) {
        console.error('SOS command error:', error);
        await addReaction(sock, message, '❌');
        return sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ ${error.message || 'Something went wrong'}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`
        }, { quoted: message });
    }
}

function isListed(sock, groupId, author) {
    const data = getData(sock);
    const list = data.groups[groupId] || [];
    return list.some(jid => cleanJid(jid) === cleanJid(author));
}

async function handleSosAction(sock, update) {
    try {
        const { id, action, author, participants } = update || {};
        if (!id?.endsWith('@g.us') || !author || !['remove', 'demote'].includes(action)) return false;
        if (!isListed(sock, id, author)) return false;

        const botJid = cleanJid(sock.user?.id);
        if (cleanJid(author) === botJid) return false;
        const target = cleanJid(author);

        // Send warning to group
        await sock.sendMessage(id, {
            text: `
╭━━━〔 🛡️ *SOS ACTION BLOCKED* 〕━━━┈⊷
┃ ❍ @${target.split('@')[0]} You are on SOS List!
┃ ❍ Cannot perform admin actions
┃ ❍ You have been removed from the group
╰━━━━━━━━━━━━━━━━┈⊷

> By; MUZAMIL-XD`,
            mentions: [author]
        });

        try {
            await sock.groupParticipantsUpdate(id, [target], 'remove');
            console.log(`✅ SOS: Removed ${target} from ${id}`);
        } catch (error) {
            console.error('SOS removal failed:', error.message);
        }

        return true;
    } catch (error) {
        console.error('SOS action error:', error);
        return false;
    }
}

module.exports = { sosCommand, handleSosAction };
