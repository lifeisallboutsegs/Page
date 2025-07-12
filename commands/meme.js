import axios from 'axios';

const MEME_API = 'https://meme-api.com/gimme';

async function fetchMeme() {
    const res = await axios.get(MEME_API);
    const meme = res.data;
    return {
        title: meme.title,
        url: meme.url,
        postLink: meme.postLink,
        subreddit: meme.subreddit,
        author: meme.author,
    };
}

async function sendMeme(ctx) {
    const meme = await fetchMeme();
    const template = {
        attachment: {
            type: 'template',
            payload: {
                template_type: 'generic',
                elements: [
                    {
                        title: meme.title.length > 80 ? meme.title.slice(0, 77) + '...' : meme.title,
                        image_url: meme.url,
                        subtitle: `r/${meme.subreddit} • by u/${meme.author}`,
                        default_action: {
                            type: 'web_url',
                            url: meme.postLink,
                            webview_height_ratio: 'tall',
                        },
                        buttons: [
                            {
                                type: 'postback',
                                title: 'Next Meme',
                                payload: 'meme:next',
                            },
                            {
                                type: 'web_url',
                                title: 'Source',
                                url: meme.postLink,
                            },
                            {
                                type: 'postback',
                                title: 'Send Image Only',
                                payload: `meme:image|${encodeURIComponent(meme.title)}|${encodeURIComponent(meme.url)}`,
                            }
                        ],
                    },
                ],
            },
        },
    };
    await ctx.sendAttachment('template', template.attachment.payload);
}

export default {
    name: 'meme',
    description: 'Get a random meme with interactive buttons.',
    usage: '{prefix}meme [next]',
    category: 'fun',
    async onCall(ctx) {
        try {
            await sendMeme(ctx);
        } catch (e) {
            ctx.reply('❌ Failed to fetch a meme. Please try again later.');
        }
    },
    async onPostBack(ctx, payload) {
        if (payload === 'next') {
            try {
                await sendMeme(ctx);
            } catch (e) {
                ctx.reply('❌ Failed to fetch a meme. Please try again later.');
            }
        } else if (payload.startsWith('image|')) {
            try {
                const [, title, url] = payload.split('|');
                await ctx.reply(decodeURIComponent(title));
                await ctx.sendAttachment('image', decodeURIComponent(url));
            } catch (e) {
                ctx.reply('❌ Failed to send the meme image. Please try again later.');
            }
        }
    },
}; 