const { bots } = require('./antilink');
const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

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

async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        await addReaction(sock, message, '🔗');

        if (!isSenderAdmin) {
            await addReaction(sock, message, '⛔');
            await sock.sendMessage(chatId, { 
                text: `
╭━━━〔 ⛔ *ACCESS DENIED* 〕━━━┈⊷
┃ ❍ For Group Admins Only!
┃ ❍ You don't have permission
┃ ❍ to use this command.
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
            }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🔗 *ANTILINK MENU* 〕━━━┈⊷
┃ ❍ .antilink on
┃ ❍ .antilink off
┃ ❍ .antilink set delete
┃ ❍ .antilink set kick
┃ ❍ .antilink set warn
┃ ❍ .antilink get
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
            }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on': {
                await addReaction(sock, message, '✅');
                const existingConfig = await getAntilink(chatId, 'on', sock);
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ⚠️ *ANTILINK STATUS* 〕━━━┈⊷
┃ ❍ Status : Already ON
┃ ❍ Action : ${existingConfig.action || 'delete'}
┃ ❍ Use    : .antilink off to disable
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete', sock);
                if (result) {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ✅ *ANTILINK ENABLED* 〕━━━┈⊷
┃ ❍ Status : ON
┃ ❍ Action : Delete
┃ ❍ Links  : Will be deleted
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ Failed to turn on Antilink
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                }
                break;
            }

            case 'off': {
                await addReaction(sock, message, '❌');
                await removeAntilink(chatId, 'on', sock);
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❌ *ANTILINK DISABLED* 〕━━━┈⊷
┃ ❍ Status : OFF
┃ ❍ Links  : Now allowed
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
                break;
            }

            case 'set': {
                await addReaction(sock, message, '⚙️');
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ⚙️ *SET ACTION* 〕━━━┈⊷
┃ ❍ .antilink set delete
┃ ❍ .antilink set kick
┃ ❍ .antilink set warn
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ❌ *INVALID ACTION* 〕━━━┈⊷
┃ ❍ Choose: delete, kick, warn
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction, sock);
                if (setResult) {
                    const actionEmoji = setAction === 'delete' ? '🗑️' : setAction === 'kick' ? '👢' : '⚠️';
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ✅ *ACTION UPDATED* 〕━━━┈⊷
┃ ❍ ${actionEmoji} Action : ${setAction.toUpperCase()}
┃ ❍ Antilink will now ${setAction}
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ Failed to set action
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                    }, { quoted: message });
                }
                break;
            }

            case 'get': {
                await addReaction(sock, message, '📊');
                const status = await getAntilink(chatId, 'on', sock);
                const actionConfig = await getAntilink(chatId, 'on', sock);
                
                const statusEmoji = status?.enabled ? '🟢' : '🔴';
                const actionEmoji = actionConfig?.action === 'delete' ? '🗑️' : 
                                   actionConfig?.action === 'kick' ? '👢' : '⚠️';
                
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 📊 *ANTILINK CONFIG* 〕━━━┈⊷
┃ ❍ Status : ${statusEmoji} ${status?.enabled ? 'ON' : 'OFF'}
┃ ❍ Action : ${actionEmoji} ${actionConfig?.action ? actionConfig.action.toUpperCase() : 'Not set'}
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
                break;
            }

            default: {
                await addReaction(sock, message, '❓');
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❓ *UNKNOWN COMMAND* 〕━━━┈⊷
┃ ❍ Use .antilink for help
┃ ❍ Available: on/off/set/get
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
            }
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        await addReaction(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ Something went wrong
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
        }, { quoted: message });
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkConfig = await getAntilink(chatId, 'on', sock);
    if (!antilinkConfig?.enabled) return;

    let shouldDelete = false;

    const linkPatterns = {
        whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
        whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
        telegram: /t\.me\/[A-Za-z0-9_]+/i,
        allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i,
    };

    if (linkPatterns.allLinks.test(userMessage)) {
        shouldDelete = true;
    }

    if (shouldDelete) {
        const quotedMessageId = message.key.id;
        const quotedParticipant = message.key.participant || senderId;

        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
        } catch (error) {
            console.error('Failed to delete message:', error);
        }

        const mentionedJidList = [senderId];
        
        const config = await getAntilink(chatId, 'on', sock);
        const action = config?.action || 'delete';

        let warningMessage = '';
        switch(action) {
            case 'delete':
                warningMessage = `⚠️ *Link Detected!*\n@${senderId.split('@')[0]} Links are not allowed!\n🔹 Message deleted.`;
                break;
            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    warningMessage = `👢 *User Kicked!*\n@${senderId.split('@')[0]} was kicked for sending links!`;
                } catch (e) {
                    warningMessage = `⚠️ *Link Detected!*\n@${senderId.split('@')[0]} Links are not allowed!`;
                }
                break;
            case 'warn':
                warningMessage = `⚠️ *Warning!*\n@${senderId.split('@')[0]} Links are not allowed!\n🔹 Please don't send links again.`;
                break;
            default:
                warningMessage = `⚠️ *Link Detected!*\n@${senderId.split('@')[0]} Links are not allowed!\n🔹 Message deleted.`;
        }

        const styledWarning = `
╭━━━〔 🛡️ *ANTILINK WARNING* 〕━━━┈⊷
┃ ❍ ${warningMessage}
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`;

        await sock.sendMessage(chatId, { 
            text: styledWarning, 
            mentions: mentionedJidList 
        });
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};
