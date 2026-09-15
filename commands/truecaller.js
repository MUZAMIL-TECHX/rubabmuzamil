const axios = require('axios');

async function truecallerCommand(sock, chatId, message, number) {
    // Check if number is provided
    if (!number) {
        await sock.sendMessage(
            chatId,
            {
                text: '📱 *Truecaller Lookup*\n\n' +
                      'Usage:\n' +
                      '.truecaller 92XXXXXXXXX\n\n' +
                      'Example:\n' +
                      '.truecaller 923001234567\n\n' +
                      '⚠️ Country code required (e.g., 92 for Pakistan)'
            },
            { quoted: message }
        );
        return;
    }

    // Clean the number - remove spaces, dashes, plus signs
    const cleanNumber = number.replace(/[\s\-+]/g, '');
    
    // Validate number (should start with country code and be at least 10 digits)
    if (!/^\d{10,15}$/.test(cleanNumber)) {
        await sock.sendMessage(
            chatId,
            {
                text: '❌ Invalid number format!\n\n' +
                      'Please use:\n' +
                      '.truecaller 92XXXXXXXXX\n\n' +
                      'Example: .truecaller 923001234567'
            },
            { quoted: message }
        );
        return;
    }

    try {
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        
        // Call the Truecaller API
        const apiUrl = `https://faisal-ali-truecaller.ftgmhacks.workers.dev/?key=ftgm7795caller&number=${cleanNumber}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        // Check if API returned error
        if (data.status === 'error' || !data.data) {
            throw new Error(data.message || 'No data found');
        }

        // Extract name from response
        const name = data.data.name || 'Unknown';
        const formattedNumber = cleanNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

        // Stylish response format
        const reply = 
`❖━━━━━━━━━━━━━━━━━━━❖
╔═══❖•ೋ° 📱 °ೋ•❖═══╗
   𝗧𝗿𝘂𝗲 𝗖𝗮𝗹𝗹𝗲𝗿 𝗦𝗲𝗮𝗿𝗰𝗵
╚═══❖•ೋ° 📱 °ೋ•❖═══╝
❖━━━━━━━━━━━━━━━━━━━❖

  📞 𝗡𝘂𝗺𝗯𝗲𝗿 : ${formattedNumber}
  👤 𝗡𝗮𝗺𝗲   : ${name}

❖━━━━━━━━━━━━━━━━━━━❖
       𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆
    𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗
❖━━━━━━━━━━━━━━━━━━━❖`;

        await sock.sendMessage(
            chatId,
            { text: reply },
            { quoted: message }
        );

    } catch (error) {
        console.error('Truecaller API Error:', error.message);
        
        let errorMessage = '❖━━━━━━━━━━━━━━━━━━━❖\n';
        errorMessage += '╔═══❖•ೋ° ❌ °ೋ•❖═══╗\n';
        errorMessage += '      𝗘𝗿𝗿𝗼𝗿 𝗢𝗰𝗰𝘂𝗿𝗿𝗲𝗱\n';
        errorMessage += '╚═══❖•ೋ° ❌ °ೋ•❖═══╝\n';
        errorMessage += '❖━━━━━━━━━━━━━━━━━━━❖\n\n';
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += '⏰ Request timed out.\nTry again.';
        } else if (error.response) {
            errorMessage += `⚠️ API Error ${error.response.status}\nTry again later.`;
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            errorMessage += '🌐 No internet connection.\nCheck your network.';
        } else {
            errorMessage += '🔴 ' + (error.message || 'Something went wrong.\nPlease try again.');
        }
        
        errorMessage += '\n\n💡 Check number format:\n.truecaller 923001234567';
        errorMessage += '\n\n❖━━━━━━━━━━━━━━━━━━━❖\n';
        errorMessage += '  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n';
        errorMessage += '❖━━━━━━━━━━━━━━━━━━━❖';
        
        await sock.sendMessage(
            chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = truecallerCommand;
