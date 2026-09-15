/**
 * MUZAMIL-XD - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const express = require('express')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

const APP_ROOT = __dirname
const SESSION_DIR = path.resolve(process.env.SESSION_DIR || join(APP_ROOT, 'session'))
const DATA_DIR = join(APP_ROOT, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(SESSION_DIR, { recursive: true })

// Import lightweight store
const store = require('./lib/lightweight_store')
const { ensureSessionDataDir, readSessionJson, getSessionSettings } = require('./lib/session_data')
const { followSavedChannels } = require('./commands/autofollow')

const settings = require('./settings')

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1) // Panel will auto-restart
    }
}, 30_000) // check every 30 seconds

let phoneNumber = process.env.PHONE_NUMBER || ""
let owner = JSON.parse(fs.readFileSync(join(DATA_DIR, 'owner.json')))

global.botname = "MUZAMIL-XD"
global.themeemoji = "•"
// Menu DP: paste any public image URL here. No local assets folder is required.
global.botImageUrl = "https://i.ibb.co/yz79pyg/1000040527.png"
const useMobile = process.argv.includes("--mobile")
// Every WhatsApp account gets its own auth directory and socket.  The old
// implementation kept these as singletons, which made the second pairing
// request reuse the first account and return "Session already found".
const sockets = new Map()
const pairingLocks = new Map()
let reconnectTimer = null
let pairingServer = null
let baileysVersionPromise = null

function sessionKey(value = 'default') {
    const clean = String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '')
    return clean || 'default'
}

function sessionPath(key = 'default') {
    const normalized = sessionKey(key)
    // Preserve the original root session for backwards compatibility.
    return normalized === 'default' ? SESSION_DIR : join(SESSION_DIR, normalized)
}

function getSocket(key = 'default') {
    return sockets.get(sessionKey(key)) || null
}

function hasCredentials(dir) {
    return existsSync(join(dir, 'creds.json'))
}

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}


async function startXeonBotInc(requestedPhoneNumber = '', requestedSessionKey = 'default') {
    const key = sessionKey(requestedSessionKey || requestedPhoneNumber || 'default')
    const authDir = sessionPath(key)
    try {
        const requestedNumber = String(requestedPhoneNumber || '').replace(/[^0-9]/g, '')
        const shouldPair = Boolean(
            requestedNumber ||
            phoneNumber ||
            process.env.PHONE_NUMBER ||
            process.argv.includes("--pairing-code")
        )
        // Fetch the Baileys version once; doing this for every account makes
        // pairing and reconnects unnecessarily slow.
        if (!baileysVersionPromise) baileysVersionPromise = fetchLatestBaileysVersion()
        let { version, isLatest } = await baileysVersionPromise
        fs.mkdirSync(authDir, { recursive: true })
        const { state, saveCreds } = await useMultiFileAuthState(authDir)
        const msgRetryCounterCache = new NodeCache()
        const sessionStore = store.createStore(join(authDir, 'baileys_store.json'))
        sessionStore.readFromFile()
        const storeWriter = setInterval(() => sessionStore.writeToFile(), settings.storeWriteInterval || 10000)

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !shouldPair,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await sessionStore.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
        })

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)
        sockets.set(key, XeonBotInc)
        XeonBotInc.sessionKey = key
        XeonBotInc.sessionDir = authDir
        XeonBotInc.sessionStore = sessionStore
        XeonBotInc.dataDir = join(authDir, 'data')
        ensureSessionDataDir(XeonBotInc)
        const legacyBranding = readSessionJson(XeonBotInc, 'branding.json', {})
        const sessionSettings = {
            ...getSessionSettings(XeonBotInc),
            ...(legacyBranding.name ? { botName: legacyBranding.name } : {}),
            ...(legacyBranding.imageUrl ? { botDp: legacyBranding.imageUrl } : {})
        }
        XeonBotInc.botname = sessionSettings.botName
        XeonBotInc.botImageUrl = sessionSettings.botDp
        XeonBotInc.ownerNumber = sessionSettings.ownerNumber
        XeonBotInc.ownerName = sessionSettings.ownerName
        XeonBotInc.description = sessionSettings.description
        // Keep this small compatibility surface for the pairing web server.
        XeonBotInc.authState = { creds: state.creds }

    sessionStore.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: XeonBotInc.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            // Clear message retry cache to prevent memory bloat
            if (XeonBotInc?.msgRetryCounterCache) {
                XeonBotInc.msgRetryCounterCache.clear()
            }

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363426106687970@newsletter',
                                newsletterName: 'MUZAMIL-XD',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

        const mode = readSessionJson(XeonBotInc, 'messageCount.json', { isPublic: true })
        XeonBotInc.public = mode.isPublic !== false
        XeonBotInc.public = mode.isPublic !== false

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, sessionStore)

    // Handle pairing code
    if (shouldPair && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let pairingPhone
        if (requestedNumber) {
            pairingPhone = requestedNumber
        } else if (!!global.phoneNumber) {
            pairingPhone = global.phoneNumber
        } else {
            pairingPhone = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number\nFormat: 6281376552730 (without + or spaces) : `)))
        }

        // Clean the phone number - remove any non-digit characters
        pairingPhone = String(pairingPhone).replace(/[^0-9]/g, '')

        // Validate the phone number using awesome-phonenumber
        const pn = require('awesome-phonenumber');
        if (!pn('+' + pairingPhone).isValid()) {
            console.log(chalk.red('Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, etc.) without + or spaces.'));
            process.exit(1);
        }

        try {
            // WhatsApp needs a short moment after socket creation before pairing.
            await delay(2500)
            let code = await XeonBotInc.requestPairingCode(pairingPhone)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            XeonBotInc.__pairingCode = code
            console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
            console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
        } catch (error) {
            console.error('Error requesting pairing code:', error)
            if (requestedNumber) throw error
            console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
        }
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        
        if (qr) {
            console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }
        
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        
        if (connection == "open") {
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

            // Apply the channels saved through .addautofollow to every
            // Muzamil-XD session as soon as it connects.
            await followSavedChannels(XeonBotInc)

            try {
                const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                await XeonBotInc.sendMessage(botNumber, {
                    text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!\n\n✅Make sure to join below channel`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363426106687970@newsletter',
                            newsletterName: 'MUZAMIL-XD',
                            serverMessageId: -1
                        }
                    }
                });
            } catch (error) {
                console.error('Error sending connection message:', error.message)
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${XeonBotInc.botname || global.botname || 'MUZAMIL-XD'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: @TeamRedXhackers`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: MUZAMIL-TECHX`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: MUZAMIL KHAN`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
            const statusCode = lastDisconnect?.error?.output?.statusCode
            clearInterval(storeWriter)
            if (getSocket(key) === XeonBotInc) sockets.delete(key)
            
            console.log(chalk.red(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try {
                    rmSync(authDir, { recursive: true, force: true })
                    fs.mkdirSync(authDir, { recursive: true })
                    console.log(chalk.yellow(`Session folder deleted (${key}). Please re-authenticate.`))
                } catch (error) {
                    console.error('Error deleting session:', error)
                }
                console.log(chalk.red('Session logged out. Please re-authenticate.'))
            }
            
            if (shouldReconnect) {
                console.log(chalk.yellow('Reconnecting...'))
                setTimeout(() => {
                        if (getSocket(key)) return
                        startXeonBotInc('', key).catch((error) => {
                            console.error('Reconnect attempt failed:', error)
                        })
                    }, 5000)
            }
        }
    })

    // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

    // Anticall handler: block callers when enabled
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    // First: attempt to reject the call if supported
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                            await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                        }
                    } catch {}

                    // Notify the caller only once within a short window
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                    }
                } catch {}
                // Then: block after a short delay to ensure rejection and message are processed
                setTimeout(async () => {
                    try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                }, 800);
            }
        } catch (e) {
            // ignore
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('messages.upsert', async (m) => {
        if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
            await handleStatus(XeonBotInc, m);
        }
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        if (!getSocket(key)) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null
                startXeonBotInc(requestedPhoneNumber, key).catch((retryError) => {
                    console.error('Retry attempt failed:', retryError)
                })
            }, 5000)
        }
        return null
    }
}

function cleanPairingNumber(value) {
    return String(value || '').replace(/[^0-9]/g, '')
}

async function requestPairingCodeForNumber(value) {
    const number = cleanPairingNumber(value)
    const key = sessionKey(number)
    const pn = require('awesome-phonenumber')
    if (!pn('+' + number).isValid()) {
        throw new Error('Enter a valid international WhatsApp number without + or spaces.')
    }

    if (pairingLocks.has(key)) return pairingLocks.get(key)
    pairingLocks.set(key, (async () => {
        const existing = getSocket(key)
        if (existing?.authState?.creds?.registered || hasCredentials(sessionPath(key))) {
            throw new Error(`Session already found for ${number}. Use a different WhatsApp number or clear session ${key}.`)
        }

        if (existing && !existing.authState?.creds?.registered) {
            try {
                await delay(1500)
                let code = await existing.requestPairingCode(number)
                return code?.match(/.{1,4}/g)?.join("-") || code
            } catch (_) {
                try { await existing.ws?.close() } catch {}
                sockets.delete(key)
            }
        }

        const socket = await startXeonBotInc(number, key)
        if (!socket?.__pairingCode) throw new Error('Pairing code was not generated. Please try again.')
        return socket.__pairingCode
    })())

    try {
        return await pairingLocks.get(key)
    } finally {
        pairingLocks.delete(key)
    }
}

function startPairingServer() {
    const app = express()
    const port = Number(process.env.PORT || 8000)

    app.disable('x-powered-by')
    app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'pair.html')))
    app.get('/health', (_req, res) => res.json({
        status: 'ok',
        bot: global.botname || 'MUZAMIL-XD',
        connected: [...sockets.values()].some(socket => socket.authState?.creds?.registered),
        sessions: sockets.size
    }))
    app.get('/status', (req, res) => {
        const key = sessionKey(req.query.session || req.query.number || 'default')
        const socket = getSocket(key)
        res.json({
            connected: Boolean(socket?.authState?.creds?.registered),
            number: socket?.user?.id?.split(':')[0] || (key === 'default' ? null : key),
            session: key,
            hasSession: hasCredentials(sessionPath(key))
        })
    })
    app.get('/sessions', (_req, res) => res.json({
        sessions: [...sockets.entries()].map(([session, socket]) => ({
            session,
            connected: Boolean(socket.authState?.creds?.registered),
            number: socket.user?.id?.split(':')[0] || null
        }))
    }))
    app.get('/code', async (req, res) => {
        try {
            const code = await requestPairingCodeForNumber(req.query.number)
            res.json({ status: 'success', code })
        } catch (error) {
            res.status(400).json({ status: 'error', message: error.message })
        }
    })

    pairingServer = app.listen(port, '0.0.0.0', () => {
        console.log(chalk.green(`Pairing site running on port ${port}`))
    })
}

startPairingServer()

// Restore every saved account after a restart.  Keep the legacy root session
// compatible, then use one subdirectory per phone number for new pairings.
const savedSessionKeys = fs.readdirSync(SESSION_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && hasCredentials(join(SESSION_DIR, entry.name)))
    .map(entry => entry.name)
if (hasCredentials(SESSION_DIR)) savedSessionKeys.unshift('default')
if (!savedSessionKeys.length) savedSessionKeys.push('default')
Promise.all(savedSessionKeys.map(key => startXeonBotInc('', key).catch(error => {
    console.error(`Failed to restore session ${key}:`, error)
}))).catch(error => console.error('Session restore error:', error))
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

async function shutdown(signal) {
    console.log(`${signal} received; shutting down cleanly`)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pairingServer) pairingServer.close()
    try {
        await Promise.all([...sockets.values()].map(socket => socket.ws?.close()))
    } catch (error) {
        console.error('Error while closing WhatsApp connection:', error.message)
    }
    process.exit(0)
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})