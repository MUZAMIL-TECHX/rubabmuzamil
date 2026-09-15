const axios = require('axios');

async function simdataCommand(sock, chatId, message, input) {
    // Check if input is provided
    if (!input) {
        await sock.sendMessage(
            chatId,
            {
                text: '📱 *SIM Data Lookup*\n\n' +
                      'Usage:\n' +
                      '.simdata 31XXXXXXXXX\n' +
                      '.simdata 4120XXXXXXXXX\n\n' +
                      'Example:\n' +
                      '.simdata 3101234567\n' +
                      '.simdata 4120112345678\n\n' +
                      '⚠️ Enter mobile number OR CNIC number'
            },
            { quoted: message }
        );
        return;
    }

    // Clean the input - remove spaces, dashes, plus signs
    const cleanInput = input.replace(/[\s\-+]/g, '');
    
    // Validate input (mobile: 10-12 digits, CNIC: 13 digits)
    if (!/^\d{10,13}$/.test(cleanInput)) {
        await sock.sendMessage(
            chatId,
            {
                text: '❌ Invalid format!\n\n' +
                      'Please use:\n' +
                      '.simdata 31XXXXXXXXX (Mobile)\n' +
                      '.simdata 4120XXXXXXXXX (CNIC)\n\n' +
                      'Example:\n' +
                      '.simdata 3101234567\n' +
                      '.simdata 4120112345678'
            },
            { quoted: message }
        );
        return;
    }

    try {
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);
        
        // Call the SIM Data API with proper headers
        const apiUrl = `https://wasifali.biz.id/public_apis/sim-info-api.php?search=${cleanInput}`;
        
        console.log(`[SIM DATA] Requesting: ${apiUrl}`); // Debug log
        
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });

        console.log(`[SIM DATA] Response Status: ${response.status}`); // Debug log
        console.log(`[SIM DATA] Response Data:`, JSON.stringify(response.data, null, 2)); // Debug log

        const data = response.data;

        // Check if API returned success
        if (!data || !data.success) {
            // Try to check if data exists even if success flag is missing
            if (data && data.records && data.records.length > 0) {
                // Success flag missing but records exist - proceed
            } else {
                throw new Error(data?.message || 'No data found from API');
            }
        }

        // Check if records exist
        if (!data.records || data.records.length === 0) {
            throw new Error('No SIM data found for this number/CNIC');
        }

        // Get all records
        const records = data.records;
        const totalCount = data.count || records.length;

        // Build response with boxes
        let reply = '';
        
        // Header
        reply += '❖━━━━━━━━━━━━━━━━━━━❖\n';
        reply += '╔═══❖•ೋ° 📱 °ೋ•❖═══╗\n';
        reply += '   𝗦𝗜𝗠 𝗗𝗮𝘁𝗮 𝗟𝗼𝗼𝗸𝘂𝗽\n';
        reply += `   📊 𝗧𝗼𝘁𝗮𝗹: ${totalCount}\n`;
        reply += '╚═══❖•ೋ° 📱 °ೋ•❖═══╝\n';
        reply += '❖━━━━━━━━━━━━━━━━━━━❖\n\n';

        // Loop through each record and create a box
        records.forEach((record, index) => {
            const name = record.name || 'Unknown';
            const mobile = record.mobile || 'N/A';
            const cnic = record.cnic || 'N/A';
            const address = record.address || 'N/A';
            const network = record.network || 'Unknown';

            // Format CNIC with dashes
            const formattedCnic = cnic !== 'N/A' && cnic !== 'NO' && cnic.length === 13 
                ? cnic.replace(/(\d{5})(\d{7})(\d{1})/, '$1-$2-$3')
                : cnic;

            // Format mobile with dashes
            const formattedMobile = mobile !== 'N/A' && mobile.length === 11
                ? mobile.replace(/(\d{4})(\d{4})(\d{3})/, '$1-$2-$3')
                : mobile;

            // Box for each record
            if (index > 0) {
                reply += '❖━━━━━━━━━━━━━━━━━━━❖\n\n';
            }

            reply += '┌─────────────────────┐\n';
            reply += `│ 📌 𝗥𝗲𝗰𝗼𝗿𝗱 #${index + 1}\n`;
            reply += '├─────────────────────┤\n';
            
            // Name
            const isNotFound = name === 'NOT FOUND' || 
                              name === 'DATA NOT RECIEVED FROM NADRA' || 
                              name === 'NO DATA';
            
            if (!isNotFound && name !== 'Unknown' && name !== 'N/A') {
                reply += `│ 👤 𝗡𝗮𝗺𝗲    : ${name}\n`;
            } else {
                reply += `│ 👤 𝗡𝗮𝗺𝗲    : ❌ Not Found\n`;
            }
            
            // Mobile
            reply += `│ 📞 𝗠𝗼𝗯𝗶𝗹𝗲  : ${formattedMobile}\n`;
            
            // CNIC
            if (cnic !== 'N/A' && cnic !== 'NO' && cnic !== 'NO DATA' && cnic !== '') {
                reply += `│ 🆔 𝗖𝗡𝗜𝗖    : ${formattedCnic}\n`;
            } else {
                reply += `│ 🆔 𝗖𝗡𝗜𝗖    : ❌ N/A\n`;
            }
            
            // Address
            if (address !== 'N/A' && address !== 'NO' && address !== 'NO DATA' && address !== '' && address !== 'NO ADDRESS') {
                // Truncate address if too long
                const shortAddress = address.length > 30 ? address.substring(0, 28) + '..' : address;
                reply += `│ 📍 𝗔𝗱𝗱𝗿𝗲𝘀𝘀 : ${shortAddress}\n`;
            } else {
                reply += `│ 📍 𝗔𝗱𝗱𝗿𝗲𝘀𝘀 : ❌ N/A\n`;
            }
            
            // Network
            if (network !== 'Unknown' && network !== 'N/A' && network !== '') {
                // Network emoji mapping
                let networkEmoji = '📶';
                const netLower = network.toLowerCase();
                if (netLower.includes('jazz')) networkEmoji = '🟠';
                else if (netLower.includes('zong')) networkEmoji = '🔴';
                else if (netLower.includes('ufone')) networkEmoji = '🟢';
                else if (netLower.includes('telenor')) networkEmoji = '🔵';
                else if (netLower.includes('warid')) networkEmoji = '🟣';
                else if (netLower.includes('ptcl')) networkEmoji = '🟡';
                
                reply += `│ ${networkEmoji} 𝗡𝗲𝘁𝘄𝗼𝗿𝗸 : ${network}\n`;
            } else {
                reply += `│ 📶 𝗡𝗲𝘁𝘄𝗼𝗿𝗸 : ❌ N/A\n`;
            }
            
            reply += '└─────────────────────┘';
        });

        // Footer
        reply += '\n\n❖━━━━━━━━━━━━━━━━━━━❖\n';
        reply += '       𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆\n';
        reply += '    𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n';
        reply += '❖━━━━━━━━━━━━━━━━━━━❖';

        await sock.sendMessage(
            chatId,
            { text: reply },
            { quoted: message }
        );

    } catch (error) {
        console.error('[SIM DATA] Full Error:', error);
        console.error('[SIM DATA] Error Message:', error.message);
        console.error('[SIM DATA] Error Code:', error.code);
        if (error.response) {
            console.error('[SIM DATA] Response Data:', error.response.data);
            console.error('[SIM DATA] Response Status:', error.response.status);
        }
        
        let errorMessage = '❖━━━━━━━━━━━━━━━━━━━❖\n';
        errorMessage += '╔═══❖•ೋ° ❌ °ೋ•❖═══╗\n';
        errorMessage += '      𝗘𝗿𝗿𝗼𝗿 𝗢𝗰𝗰𝘂𝗿𝗿𝗲𝗱\n';
        errorMessage += '╚═══❖•ೋ° ❌ °ೋ•❖═══╝\n';
        errorMessage += '❖━━━━━━━━━━━━━━━━━━━❖\n\n';
        
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += '⏰ Request timed out.\nTry again.';
        } else if (error.response) {
            errorMessage += `⚠️ API Error ${error.response.status}\n`;
            if (error.response.data && error.response.data.message) {
                errorMessage += error.response.data.message;
            } else {
                errorMessage += 'Try again later.';
            }
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            errorMessage += '🌐 No internet connection.\nCheck your network.';
        } else if (error.message.includes('No data found')) {
            errorMessage += '📭 No SIM data found for this number/CNIC.\nCheck and try again.';
        } else if (error.message.includes('No SIM data found')) {
            errorMessage += '📭 No SIM data found.\nCheck number/CNIC.';
        } else {
            errorMessage += '🔴 ' + (error.message || 'Something went wrong.\nPlease try again.');
        }
        
        errorMessage += '\n\n💡 Check format:\n.simdata 3101234567\n.simdata 4120112345678';
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

module.exports = simdataCommand;
