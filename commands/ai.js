import axios from 'axios';
import * as userDb from '../src/utils/userDb.js';

const META_AI_BASE = 'http://193.149.164.168:2040';

export default {
    name: 'ai',
    description: 'Chat with Meta AI.',
    usage: '{prefix}ai <prompt> [--img <image_url>] [--reset] [attach image]',
    category: 'ai',
    async onCall(ctx) {
        const { args, reply, user, message, senderId } = ctx;
        const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : '!';
        if (!args.length && !(message && message.attachments && message.attachments.length)) {
            await reply(`Usage: ${userPrefix}ai <prompt> [--img <image_url>] [--reset] [attach image]`);
            return;
        }
        // Parse args for --img and --reset
        let prompt = [];
        let image = null;
        let reset = false;
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--img' && args[i + 1]) {
                image = args[i + 1];
                i++;
            } else if (args[i] === '--reset') {
                reset = true;
            } else {
                prompt.push(args[i]);
            }
        }
        prompt = prompt.join(' ');
        if (!image && message && message.attachments && message.attachments.length) {
            const img = message.attachments.find(a => a.type === 'image');
            if (img && img.payload && img.payload.url) {
                image = img.payload.url;
            }
        }
        if (!prompt && !image && !reset) {
            await reply(`Please provide a prompt or attach an image. Example: ${userPrefix}ai Tell me a joke!`);
            return;
        }
        // Health check first
        try {
            const health = await axios.get(`${META_AI_BASE}/health`, { timeout: 3000 });
            if (!health.data || health.data.status !== 'ready') {
                await reply('MetaAI is not ready. Please try again later.');
                return;
            }
        } catch {
            await reply('MetaAI API is not reachable. Please try again later.');
            return;
        }
        // Conversation ID logic
        let thread = user && user.custom && user.custom.metaAI_conversation_id ? user.custom.metaAI_conversation_id : null;
        let url, method, body;
        if (reset && thread) {
            // Reset conversation
            url = `${META_AI_BASE}/chat/${thread}/reset`;
            method = 'post';
            body = { prompt: prompt || "Let's start over.", image: image || null };
        } else if (thread) {
            url = `${META_AI_BASE}/chat/${thread}`;
            method = 'post';
            body = { prompt, image };
        } else {
            url = `${META_AI_BASE}/chat`;
            method = 'post';
            body = { prompt, image };
        }
        try {
            const { data } = await axios({ url, method, data: body, timeout: 10000 });
            if (data.error) {
                await reply(`MetaAI error: ${data.error}`);
                return;
            }
            // Save conversation_id in userDb only if not already set or if reset
            if (user) {
                user.custom = user.custom || {};
                if (reset && user.custom.metaAI_conversation_id) {
                    delete user.custom.metaAI_conversation_id;
                }
                if (data.conversation_id && !user.custom.metaAI_conversation_id) {
                    user.custom.metaAI_conversation_id = data.conversation_id;
                }
                await userDb.saveUser(senderId, user);
            }
            let msg = `${data.message}`;
            if (data.sources && data.sources.length) {
                msg += '\n\nSources:\n' + data.sources.map(s => `- ${s}`).join('\n');
            }
            if (data.media && data.media.length) {
                for (const m of data.media) {
                    if (m.url && m.type === 'IMAGE') {
                        await ctx.sendAttachment('image', m.url);
                    }
                }
                msg += '\n\n[AI sent image(s) above]';
            }

            await reply(msg.trim());
        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                await reply(`MetaAI error: ${err.response.data.error}`);
            } else {
                await reply('Failed to contact MetaAI. Please try again later.');
            }
        }
    },
    async onReply(ctx) {
        // When user replies to a bot AI message, continue the thread
        const { replyMessage, user, senderId, reply, command, webhookEvent } = ctx;
        let thread = user && user.custom && user.custom.metaAI_conversation_id;
        let prompt = replyMessage && replyMessage.text ? replyMessage.text : '';
        if (!prompt) {
            await reply('Please reply with a text prompt.');
            return;
        }
        // Build a fresh context for onCall
        await command.onCall({
            ...ctx,
            args: [prompt],
            message: replyMessage, 
            webhookEvent,
            user,
            senderId
        });
    }
}; 