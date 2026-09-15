const axios = require('axios');
const yts = require('yt-search');

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

// API Functions
async function getArslanVideo(youtubeUrl) {
    const api = `https://arslan-apis-v2.vercel.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(api, { timeout: 60000 });

    if (res?.data?.status && res?.data?.result?.download?.url) {
        return {
            download: res.data.result.download.url,
            title: res.data.result.metadata?.title || 'Video'
        };
    }
    throw new Error('Arslan API failed');
}

async function getEliteProTechVideo(youtubeUrl) {
    const api = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await axios.get(api, {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title || 'Video'
        };
    }
    throw new Error('EliteProTech API failed');
}

async function getYupraVideo(youtubeUrl) {
    const api = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(api, {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title || 'Video'
        };
    }
    throw new Error('Yupra API failed');
}

// Tries all 3 APIs in sequence for a single YouTube URL.
// Returns null instead of throwing if every API fails, so callers can move on to a fallback.
async function tryDownloadApis(youtubeUrl) {
    const apis = [
        { name: 'Arslan', fn: () => getArslanVideo(youtubeUrl) },
        { name: 'EliteProTech', fn: () => getEliteProTechVideo(youtubeUrl) },
        { name: 'Yupra', fn: () => getYupraVideo(youtubeUrl) }
    ];

    for (const api of apis) {
        try {
            const data = await api.fn();
            if (data && data.download) {
                console.log(`✅ ${api.name} API success`);
                return data;
            }
        } catch (err) {
            console.log(`❌ ${api.name} API failed:`, err.message);
        }
    }
    return null;
}

function isValidYoutubeUrl(url) {
    return /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/i.test(url);
}

async function videoCommand(sock, chatId, message) {
    try {
        await addReaction(sock, message, '🎬');

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 🎬 *VIDEO DOWNLOADER* 〕━━━┈⊷
┃ ❍ Usage : .video [name/link]
┃ ❍ Example 1 : .video Atif Aslam
┃ ❍ Example 2 : .video https://youtu.be/xxxxx
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
            }, { quoted: message });
            return;
        }

        const isDirectLink = searchQuery.startsWith('http://') || searchQuery.startsWith('https://');

        // Build a list of candidate videos to try (search mode gives multiple fallbacks,
        // direct-link mode gives just the one link the user provided).
        let candidates = [];

        if (isDirectLink) {
            if (!isValidYoutubeUrl(searchQuery)) {
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❌ *INVALID LINK* 〕━━━┈⊷
┃ ❍ Not a valid YouTube link
┃ ❍ Please check and try again
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
                return;
            }

            const ytId = (searchQuery.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            candidates.push({
                url: searchQuery,
                title: '',
                thumbnail: ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : '',
                duration: ''
            });
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❌ *NO VIDEOS FOUND* 〕━━━┈⊷
┃ ❍ No results for: ${searchQuery}
┃ ❍ Try different keywords
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
                return;
            }

            // Skip live streams/premieres (seconds === 0 usually means live) and
            // keep up to 4 candidates so we can fall back if the top result fails.
            candidates = videos
                .filter(v => !v.live)
                .slice(0, 4)
                .map(v => ({
                    url: v.url,
                    title: v.title,
                    thumbnail: v.thumbnail,
                    duration: v.timestamp || 'Unknown'
                }));

            if (candidates.length === 0) {
                await addReaction(sock, message, '❌');
                await sock.sendMessage(chatId, {
                    text: `
╭━━━〔 ❌ *NO VIDEOS FOUND* 〕━━━┈⊷
┃ ❍ Only live streams found for: ${searchQuery}
┃ ❍ Try different keywords
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
                return;
            }
        }

        // Send preview with the first candidate's thumbnail
        const first = candidates[0];
        if (first.thumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: first.thumbnail },
                    caption: `
╭━━━〔 🎬 *VIDEO FOUND* 〕━━━┈⊷
┃ ❍ Title : ${(first.title || searchQuery).substring(0, 30)}${(first.title || searchQuery).length > 30 ? '...' : ''}
┃ ❍ Duration : ${first.duration || 'Unknown'}
┃ ❍ Status : Downloading...
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
                }, { quoted: message });
            } catch (e) {
                console.error('Thumbnail error:', e);
            }
        }

        // Try each candidate in order until one actually downloads
        let videoData = null;
        let usedCandidate = null;

        for (const candidate of candidates) {
            videoData = await tryDownloadApis(candidate.url);
            if (videoData && videoData.download) {
                usedCandidate = candidate;
                break;
            }
            console.log(`❌ All APIs failed for candidate: ${candidate.title || candidate.url}, trying next...`);
        }

        if (!videoData || !videoData.download) {
            await addReaction(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `
╭━━━〔 ❌ *DOWNLOAD FAILED* 〕━━━┈⊷
┃ ❍ All sources failed${candidates.length > 1 ? ` for ${candidates.length} results` : ''}
┃ ❍ Try again later or use a direct link
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
            }, { quoted: message });
            return;
        }

        const finalTitle = videoData.title || usedCandidate?.title || searchQuery || 'Video';

        // Send the video
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${finalTitle.replace(/[^\w\s-]/g, '')}.mp4`,
            caption: `
╭━━━〔 ✅ *VIDEO READY* 〕━━━┈⊷
┃ ❍ Title : ${finalTitle.substring(0, 30)}${finalTitle.length > 30 ? '...' : ''}
┃ ❍ Status : Downloaded ✅
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
        }, { quoted: message });

        await addReaction(sock, message, '✅');

    } catch (error) {
        console.error('Video command error:', error);
        await addReaction(sock, message, '❌');

        let errorMsg = error.message || 'Unknown error';
        if (error.message?.includes('blocked')) errorMsg = 'Content blocked in your region.';
        else if (error.response?.status === 451) errorMsg = 'Content unavailable (451).';
        else if (error.message?.includes('All sources failed')) errorMsg = 'All sources failed. Try again.';

        await sock.sendMessage(chatId, {
            text: `
╭━━━〔 ❌ *ERROR* 〕━━━┈⊷
┃ ❍ ${errorMsg}
┃ ❍ Please try again later
╰━━━━━━━━━━━━━━━━┈⊷

> By; Muzamil-XD`
        }, { quoted: message });
    }
}

module.exports = videoCommand;
