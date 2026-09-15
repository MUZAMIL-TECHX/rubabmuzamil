const settings = require('../settings');
const { getSessionSettings } = require('../lib/session_data');

async function helpCommand(sock, chatId, message) {
    const sessionSettings = getSessionSettings(sock);
    // Add reaction to the message
    await sock.sendMessage(chatId, {
        react: {
            text: '📄',
            key: message.key
        }
    });

    const helpMessage = `
╭━━━〔 👤 *${sock.botname || 'MUZAMIL-XD'}* 〕━━━┈⊷
┃ ❍ Version  : ${settings.version || '3.0.7'}
┃ ❍ Owner    : ${sessionSettings.ownerName}
┃ ❍ YouTube  : ${global.ytch || 'TeamRedXhackers'}
┃ ❍ Commands : All available commands
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🌐 *GENERAL MENU* 〕━━━┈⊷
┃ ❍ .help / .menu
┃ ❍ .ping
┃ ❍ .alive
┃ ❍ .tts [text]
┃ ❍ .owner
┃ ❍ .joke
┃ ❍ .quote
┃ ❍ .fact
┃ ❍ .weather [city]
┃ ❍ .news
┃ ❍ .attp [text]
┃ ❍ .lyrics [song]
┃ ❍ .8ball [question]
┃ ❍ .groupinfo
┃ ❍ .staff / .admins
┃ ❍ .vv
┃ ❍ .trt [text] [lang]
┃ ❍ .ss [link]
┃ ❍ .jid
┃ ❍ .url
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🔍 *SEARCH MENU* 〕━━━┈⊷
┃ ❍ .truecaller [number]
┃ ❍ .simdata [number/cnic]
┃ ❍ .apk [app name]
┃ ❍ .github / .git / .repo
┃ ❍ .fetch <website>
┃ ❍ .fetchapi <website>
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 👮 *ADMIN MENU* 〕━━━┈⊷
┃ ❍ .ban @user
┃ ❍ .unban @user
┃ ❍ .promote @user
┃ ❍ .demote @user
┃ ❍ .mute [minutes]
┃ ❍ .unmute
┃ ❍ .delete / .del
┃ ❍ .kick @user
┃ ❍ .warnings @user
┃ ❍ .warn @user
┃ ❍ .antilink [on/off]
┃ ❍ .antitag [on/off]
┃ ❍ .antibadword [on/off]
┃ ❍ .chatbot [on/off]
┃ ❍ .welcome [on/off]
┃ ❍ .goodbye [on/off]
┃ ❍ .clear
┃ ❍ .tag [message]
┃ ❍ .tagall
┃ ❍ .tagnotadmin
┃ ❍ .hidetag [message]
┃ ❍ .resetlink
┃ ❍ .setgdesc [description]
┃ ❍ .setgname [name]
┃ ❍ .setgpp [reply image]
┃ ❍ .gcstatus [reply media/text]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🔒 *OWNER MENU* 〕━━━┈⊷
┃ ❍ .mode [public/private]
┃ ❍ .botname [name]
┃ ❍ .botdp [image URL]
┃ ❍ .ownernumber [number]
┃ ❍ .ownername [name]
┃ ❍ .description [text]
┃ ❍ .clearsession
┃ ❍ .antidelete [on/off]
┃ ❍ .cleartmp
┃ ❍ .update
┃ ❍ .settings
┃ ❍ .setpp [reply image]
┃ ❍ .autoreact [on/off]
┃ ❍ .autostatus [on/off]
┃ ❍ .autotyping [on/off]
┃ ❍ .autoread [on/off]
┃ ❍ .anticall [on/off]
┃ ❍ .pmblocker [on/off]
┃ ❍ .mention [on/off]
┃ ❍ .setmention [reply msg]
┃ ❍ .sudo [add/remove]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🎨 *STICKER MENU* 〕━━━┈⊷
┃ ❍ .sticker / .s
┃ ❍ .simage [reply sticker]
┃ ❍ .take [packname]
┃ ❍ .emojimix [emj1+emj2]
┃ ❍ .tgsticker [link]
┃ ❍ .crop [reply image]
┃ ❍ .blur [image]
┃ ❍ .removebg
┃ ❍ .remini
┃ ❍ .meme
┃ ❍ .igs [insta link]
┃ ❍ .igsc [insta link]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🖼️ *PIES MENU* 〕━━━┈⊷
┃ ❍ .pies [country]
┃ ❍ .china
┃ ❍ .indonesia
┃ ❍ .japan
┃ ❍ .korea
┃ ❍ .hijab
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🎮 *GAME MENU* 〕━━━┈⊷
┃ ❍ .tictactoe @user
┃ ❍ .hangman
┃ ❍ .guess [letter]
┃ ❍ .trivia
┃ ❍ .answer [answer]
┃ ❍ .truth
┃ ❍ .dare
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🤖 *AI MENU* 〕━━━┈⊷
┃ ❍ .gpt [question]
┃ ❍ .gemini [question]
┃ ❍ .imagine [prompt]
┃ ❍ .flux [prompt]
┃ ❍ .sora [prompt]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🎯 *FUN MENU* 〕━━━┈⊷
┃ ❍ .compliment @user
┃ ❍ .insult @user
┃ ❍ .flirt
┃ ❍ .shayari
┃ ❍ .goodnight
┃ ❍ .roseday
┃ ❍ .character @user
┃ ❍ .wasted @user
┃ ❍ .ship @user
┃ ❍ .simp @user
┃ ❍ .stupid @user [text]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🔤 *TEXTMAKER MENU* 〕━━━┈⊷
┃ ❍ .metallic [text]
┃ ❍ .ice [text]
┃ ❍ .snow [text]
┃ ❍ .impressive [text]
┃ ❍ .matrix [text]
┃ ❍ .light [text]
┃ ❍ .neon [text]
┃ ❍ .devil [text]
┃ ❍ .purple [text]
┃ ❍ .thunder [text]
┃ ❍ .leaves [text]
┃ ❍ .1917 [text]
┃ ❍ .arena [text]
┃ ❍ .hacker [text]
┃ ❍ .sand [text]
┃ ❍ .blackpink [text]
┃ ❍ .glitch [text]
┃ ❍ .fire [text]
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 📥 *DOWNLOADER MENU* 〕━━━┈⊷
┃ ❍ .play [song]
┃ ❍ .song [song]
┃ ❍ .spotify [query]
┃ ❍ .instagram [link]
┃ ❍ .facebook [link]
┃ ❍ .tiktok [link]
┃ ❍ .video [name]
┃ ❍ .ytmp4 [link]
┃ ❍ .yts <videoname>
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🧩 *MISC MENU* 〕━━━┈⊷
┃ ❍ .heart
┃ ❍ .horny
┃ ❍ .circle
┃ ❍ .lgbt
┃ ❍ .lolice
┃ ❍ .its-so-stupid
┃ ❍ .namecard
┃ ❍ .oogway
┃ ❍ .tweet
┃ ❍ .ytcomment
┃ ❍ .comrade
┃ ❍ .gay
┃ ❍ .glass
┃ ❍ .jail
┃ ❍ .passed
┃ ❍ .triggered
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 🖼️ *ANIME MENU* 〕━━━┈⊷
┃ ❍ .nom
┃ ❍ .poke
┃ ❍ .cry
┃ ❍ .kiss
┃ ❍ .pat
┃ ❍ .hug
┃ ❍ .wink
┃ ❍ .facepalm
╰━━━━━━━━━━━━━━━━┈⊷

╭━━━〔 💻 *GITHUB MENU* 〕━━━┈⊷
┃ ❍ .git
┃ ❍ .github
┃ ❍ .sc
┃ ❍ .script
┃ ❍ .repo
╰━━━━━━━━━━━━━━━━┈⊷

> 𝐂𝐑𝐄𝐀𝐓𝐄𝐑: ${sessionSettings.ownerName}
┃ ❍ About    : ${sessionSettings.description}`;

    try {
        const imageUrl = typeof sock.botImageUrl === 'string'
            ? sock.botImageUrl.trim()
            : (typeof global.botImageUrl === 'string' ? global.botImageUrl.trim() : '');

        if (imageUrl) {
            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363426106687970@newsletter',
                        newsletterName: 'MUZAMIL-XD',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { 
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363426106687970@newsletter',
                        newsletterName: 'MUZAMIL-XD',
                        serverMessageId: -1
                    } 
                }
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error sending help menu:', error);
        await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;
