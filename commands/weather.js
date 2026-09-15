const axios = require('axios');

async function weatherCommand(sock, chatId, message, city) {
    // Check if city is provided
    if (!city) {
        await sock.sendMessage(
            chatId,
            {
                text: '🌤️ *Weather Information*\n\n' +
                      'Usage:\n' +
                      '.weather <city name>\n\n' +
                      'Example:\n' +
                      '.weather Lahore\n' +
                      '.weather Karachi\n' +
                      '.weather Islamabad\n\n' +
                      '⚠️ Enter a city name to get weather info'
            },
            { quoted: message }
        );
        return;
    }

    try {
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', chatId);

        const apiKey = '4902c0f2550f58298ad4146a92b65e10';
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`,
            {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }
        );

        const weather = response.data;

        // Extract weather data
        const cityName = weather.name || city;
        const country = weather.sys?.country || 'Unknown';
        const temp = weather.main?.temp || 'N/A';
        const feelsLike = weather.main?.feels_like || 'N/A';
        const tempMin = weather.main?.temp_min || 'N/A';
        const tempMax = weather.main?.temp_max || 'N/A';
        const humidity = weather.main?.humidity || 'N/A';
        const pressure = weather.main?.pressure || 'N/A';
        const windSpeed = weather.wind?.speed || 'N/A';
        const windDeg = weather.wind?.deg || 'N/A';
        const description = weather.weather?.[0]?.description || 'Unknown';
        const icon = weather.weather?.[0]?.icon || '01d';
        const visibility = weather.visibility ? (weather.visibility / 1000).toFixed(1) : 'N/A';
        const sunrise = weather.sys?.sunrise ? new Date(weather.sys.sunrise * 1000).toLocaleTimeString() : 'N/A';
        const sunset = weather.sys?.sunset ? new Date(weather.sys.sunset * 1000).toLocaleTimeString() : 'N/A';

        // Weather emoji based on description
        let weatherEmoji = '🌤️';
        const descLower = description.toLowerCase();
        if (descLower.includes('clear') || descLower.includes('sunny')) weatherEmoji = '☀️';
        else if (descLower.includes('cloud')) weatherEmoji = '☁️';
        else if (descLower.includes('rain') || descLower.includes('drizzle')) weatherEmoji = '🌧️';
        else if (descLower.includes('thunder') || descLower.includes('storm')) weatherEmoji = '⛈️';
        else if (descLower.includes('snow') || descLower.includes('ice')) weatherEmoji = '❄️';
        else if (descLower.includes('fog') || descLower.includes('mist') || descLower.includes('haze')) weatherEmoji = '🌫️';
        else if (descLower.includes('wind')) weatherEmoji = '💨';
        else if (descLower.includes('hot')) weatherEmoji = '🔥';
        else if (descLower.includes('cold')) weatherEmoji = '🥶';

        // Temperature emoji
        let tempEmoji = '🌡️';
        if (temp > 35) tempEmoji = '🔥';
        else if (temp > 25) tempEmoji = '☀️';
        else if (temp > 15) tempEmoji = '🌤️';
        else if (temp > 5) tempEmoji = '🌥️';
        else if (temp > -5) tempEmoji = '❄️';
        else tempEmoji = '🥶';

        // Build stylish response
        let reply = `❖━━━━━━━━━━━━━━━━━━━❖\n`;
        reply += `╔═══❖•ೋ° ${weatherEmoji} °ೋ•❖═══╗\n`;
        reply += `      𝗪𝗲𝗮𝘁𝗵𝗲𝗿 𝗜𝗻𝗳𝗼𝗿𝗺𝗮𝘁𝗶𝗼𝗻\n`;
        reply += `╚═══❖•ೋ° ${weatherEmoji} °ೋ•❖═══╝\n`;
        reply += `❖━━━━━━━━━━━━━━━━━━━❖\n\n`;

        reply += `┌─────────────────────┐\n`;
        reply += `│ 📍 𝗖𝗶𝘁𝘆    : ${cityName.toUpperCase()}\n`;
        reply += `│ 🌍 𝗖𝗼𝘂𝗻𝘁𝗿𝘆 : ${country}\n`;
        reply += `├─────────────────────┤\n`;
        reply += `│ ${tempEmoji} 𝗧𝗲𝗺𝗽    : ${temp}°C\n`;
        reply += `│ 🌡️ 𝗙𝗲𝗲𝗹𝘀    : ${feelsLike}°C\n`;
        reply += `│ 📈 𝗠𝗶𝗻      : ${tempMin}°C\n`;
        reply += `│ 📉 𝗠𝗮𝘅      : ${tempMax}°C\n`;
        reply += `├─────────────────────┤\n`;
        reply += `│ ☁️ 𝗖𝗼𝗻𝗱𝗶𝘁𝗶𝗼𝗻 : ${description.toUpperCase()}\n`;
        reply += `│ 💧 𝗛𝘂𝗺𝗶𝗱𝗶𝘁𝘆  : ${humidity}%\n`;
        reply += `│ 🔹 𝗣𝗿𝗲𝘀𝘀𝘂𝗿𝗲 : ${pressure} hPa\n`;
        reply += `│ 👁️ 𝗩𝗶𝘀𝗶𝗯𝗶𝗹𝗶𝘁𝘆 : ${visibility} km\n`;
        reply += `├─────────────────────┤\n`;
        reply += `│ 💨 𝗪𝗶𝗻𝗱     : ${windSpeed} m/s\n`;
        reply += `│ 🧭 𝗗𝗶𝗿𝗲𝗰𝘁𝗶𝗼𝗻 : ${windDeg}°\n`;
        reply += `├─────────────────────┤\n`;
        reply += `│ 🌅 𝗦𝘂𝗻𝗿𝗶𝘀𝗲  : ${sunrise}\n`;
        reply += `│ 🌇 𝗦𝘂𝗻𝘀𝗲𝘁   : ${sunset}\n`;
        reply += `└─────────────────────┘\n\n`;

        reply += `❖━━━━━━━━━━━━━━━━━━━❖\n`;
        reply += `  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n`;
        reply += `❖━━━━━━━━━━━━━━━━━━━❖`;

        await sock.sendMessage(
            chatId,
            { text: reply },
            { quoted: message }
        );

        console.log(`[Weather] Fetched weather for: ${cityName}`);

    } catch (error) {
        console.error('Weather API Error:', error.message);
        if (error.response) {
            console.error('Weather API Status:', error.response.status);
        }

        let errorMessage = `❖━━━━━━━━━━━━━━━━━━━❖\n`;
        errorMessage += `╔═══❖•ೋ° ❌ °ೋ•❖═══╗\n`;
        errorMessage += `      𝗘𝗿𝗿𝗼𝗿 𝗢𝗰𝗰𝘂𝗿𝗿𝗲𝗱\n`;
        errorMessage += `╚═══❖•ೋ° ❌ °ೋ•❖═══╝\n`;
        errorMessage += `❖━━━━━━━━━━━━━━━━━━━❖\n\n`;

        if (error.response?.status === 404) {
            errorMessage += `🌍 City not found!\n\n`;
            errorMessage += `"${city}" is not a valid city name.\n\n`;
            errorMessage += `💡 Try:\n`;
            errorMessage += `• Check spelling\n`;
            errorMessage += `• Use city name (Lahore)\n`;
            errorMessage += `• Use city,country (Lahore,PK)`;
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            errorMessage += `⏰ Request timed out.\nTry again.`;
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            errorMessage += `🌐 No internet connection.\nCheck your network.`;
        } else {
            errorMessage += `🔴 ${error.message || 'Something went wrong.\nPlease try again.'}`;
        }

        errorMessage += `\n\n❖━━━━━━━━━━━━━━━━━━━❖\n`;
        errorMessage += `  𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗕𝘆 𝗠𝘂𝘇𝗮𝗺𝗶𝗹-𝗫𝗗\n`;
        errorMessage += `❖━━━━━━━━━━━━━━━━━━━❖`;

        await sock.sendMessage(
            chatId,
            { text: errorMessage },
            { quoted: message }
        );
    }
}

module.exports = weatherCommand;
