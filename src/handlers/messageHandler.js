import logger from '../../logger.js';
import config from '../../config.js';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import * as userDb from '../utils/userDb.js';
import * as userApi from '../utils/userApi.js';
import * as commandLoader from './commandLoader.js';
import ora from 'ora';
import cmd from '../../commands/cmd.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE_ACCESS_TOKEN = config.PAGE_ACCESS_TOKEN;
const PAGE_ID = config.PAGE_ID;

// Command system
const COMMAND_PREFIX = config.commandPrefix;
const commands = commandLoader.getCommands();

// Animated command loader at startup
const commandsDir = path.join(__dirname, '../../commands');
const commandFiles = (await fs.readdir(commandsDir)).filter(f => f.endsWith('.js'));
const totalCommands = commandFiles.length;
let loadedCount = 0;
const spinner = ora({ text: 'Loading commands...', spinner: 'dots' }).start();
await commandLoader.loadCommands(async (cmdName) => {
    loadedCount++;
    spinner.text = `Loaded ${String(loadedCount).padStart(2, '0')}/${String(totalCommands).padEnd(2, ' ')} - ${cmdName}`;
});
spinner.succeed(`✅ All ${totalCommands} commands loaded!`);

// At the top, after imports
if (!global.commandOnReply) global.commandOnReply = new Map();

// Utility to split long messages
function splitMessage(text, maxLen = 2000) {
    const result = [];
    let remaining = text;
    while (remaining.length > maxLen) {
        // Try to split at a line break between 1800 and 2000
        let splitAt = -1;
        for (let i = Math.min(maxLen, remaining.length); i >= Math.max(1800, maxLen - 200); i--) {
            if (remaining[i] === '\n') {
                splitAt = i;
                break;
            }
        }
        // If no line break, try to split at a space
        if (splitAt === -1) {
            for (let i = Math.min(maxLen, remaining.length); i >= Math.max(1800, maxLen - 200); i--) {
                if (remaining[i] === ' ') {
                    splitAt = i;
                    break;
                }
            }
        }
        // If neither, hard split at maxLen
        if (splitAt === -1) splitAt = maxLen;
        result.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt);
    }
    if (remaining.length > 0) result.push(remaining);
    return result;
}

// Sends a typing indicator to the user
async function sendTypingIndicator(senderId, typingOn) {
    const request_body = {
        recipient: {
            id: senderId,
        },
        sender_action: typingOn ? 'typing_on' : 'typing_off',
    };
    try {
        const res = await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body);
        if (res.status === 200) {
            logger.debug(`Typing indicator ${typingOn ? 'on' : 'off'} sent to ${senderId}`);
        } else {
            logger.warn(`Failed to send typing indicator: ${res.status}`, res.data);
        }
    } catch (error) {
        logger.error('Error sending typing indicator:', error.response ? error.response.data : error.message);
    }
}

// Sends response messages via the Send API
export async function callSendAPI(senderId, response) {
    let request_body;
    if (response.sender_action) {
        // For sender_action like mark_seen or typing_on
        request_body = {
            recipient: { id: senderId },
            sender_action: response.sender_action
        };
    } else {
        // For normal messages
        request_body = {
            recipient: { id: senderId },
            message: response,
            messaging_type: 'RESPONSE',
        };
    }
    try {
        const res = await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, request_body);
        if (res.status === 200) {
            logger.success('Message sent successfully!', {
                recipient_id: res.data.recipient_id,
                message_id: res.data.message_id
            });
        } else {
            logger.warn(`Unexpected status code: ${res.status} from Messenger API.`, res.data);
        }
        return res; // Always return the response
    } catch (error) {
        if (error.response) {
            logger.error('Messenger API Error Response:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
                requestConfig: error.config,
            });
        } else if (error.request) {
            logger.error('Messenger API No Response:', {
                message: error.message,
                request: error.request,
                code: error.code,
            });
        } else {
            logger.error('Error setting up Messenger API request:', error.message);
        }
        logger.error('Full Error Object:', error);
        return undefined; // Explicitly return undefined on error
    }
}

// Main event handler
export async function handleMessage(webhookEvent) {
    const eventReceivedAt = Date.now();
    const senderId = webhookEvent.sender ? webhookEvent.sender.id : 'UNKNOWN_SENDER';
    const threadId = webhookEvent.recipient ? webhookEvent.recipient.id : 'UNKNOWN_THREAD';
    if (senderId === PAGE_ID) return; // Ignore all messages from the bot/page itself
    if (webhookEvent.message && webhookEvent.message.is_echo) return;
    if (webhookEvent.read) return;
    if (webhookEvent.delivery) return;

    // Only process user-initiated messages (text, quick_reply, or reply_to)
    if (!(
        webhookEvent.message &&
        (
            webhookEvent.message.text ||
            webhookEvent.message.quick_reply ||
            webhookEvent.message.reply_to
        ) || webhookEvent.postback
    )) return;

    // Ignore any message sent by the page itself (bot), or empty messages (no text, no quick_reply, no reply_to)
    if (
        webhookEvent.sender && webhookEvent.sender.id === threadId
        || (
            webhookEvent.message &&
            !webhookEvent.message.text &&
            !webhookEvent.message.quick_reply &&
            !webhookEvent.message.reply_to
        )
    ) {
        return;
    }

    // Ignore bot-sent attachment-only messages (no text, no reply_to, and sender is the page)
    if (
        webhookEvent.message &&
        webhookEvent.message.attachments &&
        !webhookEvent.message.text &&
        !webhookEvent.message.reply_to &&
        webhookEvent.sender &&
        webhookEvent.sender.id === threadId
    ) {
        return;
    }

    // Mark every message as seen immediately
    await callSendAPI(senderId, { sender_action: 'mark_seen' });

    // Fetch user info from DB or Graph API
    let user = await userDb.getUser(senderId);
    if (!user) {
        user = await userApi.fetchUserInfo(senderId);
    }
    // Always update lastActive and cache user
    if (user) {
        user.lastActive = Date.now();
        await userDb.saveUser(senderId, user);
    }
    const userDisplay = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() + ` (${senderId})` : senderId;

    // Determine prefix for this user
    const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : COMMAND_PREFIX;

    const sendAttachment = async (type, data) => {
        if (typeof data === 'string' && data.startsWith('http')) {
            return callSendAPI(senderId, { attachment: { type, payload: { url: data, is_reusable: false } } });
        }
    
        if (Buffer.isBuffer(data)) {
            const form = new FormData();
            form.append('recipient', JSON.stringify({ id: senderId }));
            form.append('messaging_type', 'RESPONSE');
            form.append('message', JSON.stringify({ attachment: { type: type, payload: {} } }));
            form.append('filedata', data, {
                filename: 'upload.png',
                contentType: 'image/png'
            });
    
            try {
                const res = await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, form, {
                    headers: { ...form.getHeaders() }
                });
                logger.success('Attachment buffer sent successfully!');
                return res;
            } catch (error) {
                if (error.response) {
                    logger.error('Messenger API Error Response (Attachment):', {
                        status: error.response.status,
                        data: error.response.data
                    });
                } else {
                    logger.error('Error sending attachment to Messenger API:', error.message);
                }
                return undefined;
            }
        }
    
        if (typeof data === 'object' && !Array.isArray(data)) {
            return callSendAPI(senderId, { attachment: { type, payload: data } });
        }
    
        if (Array.isArray(data)) {
            for (const item of data) {
                await sendAttachment(type, item);
            }
            return;
        }
        
        logger.warn('Unsupported attachment data type:', typeof data);
    };

    if (webhookEvent.message) {
        const message = webhookEvent.message;
        const { text, attachments, quick_reply } = message;
        if (text) {
            if (text.startsWith(userPrefix)) {
                const [cmdName, ...args] = text.slice(userPrefix.length).trim().split(/\s+/);
                const command = commands.get(cmdName.toLowerCase());
                if (command) {
                    logger.logEvent('EVENT COMMAND', cmdName, userDisplay, args.join(' '));
                    if (command.adminOnly && !config.adminIds.includes(senderId)) {
                        await callSendAPI(senderId, { text: '🚫 This command is for admins only.' });
                        return;
                    }
                    await sendTypingIndicator(senderId, true); // Typing on
                    const ctx = {
                        args,
                        senderId,
                        threadId,
                        message,
                        webhookEvent,
                        user,
                        eventReceivedAt,
                        reply: async (msg, opts = {}) => {
                            const chunks = splitMessage(msg);
                            let lastRes;
                            for (const chunk of chunks) {
                                const beforeSend = Date.now();
                                const res = await callSendAPI(senderId, { text: chunk, ...opts });
                                const afterSend = Date.now();
                                const latency = afterSend - eventReceivedAt;
                                if (!global.commandLatencies) global.commandLatencies = {};
                                if (!global.commandLatencies[senderId]) global.commandLatencies[senderId] = [];
                                global.commandLatencies[senderId].push(latency);
                                if (global.commandLatencies[senderId].length > 50) global.commandLatencies[senderId].shift();
                                global.commandLatencies[senderId].last = latency;
                                lastRes = res;
                            }
                            // Only register onReply for the last message sent
                            if (command.onReply && lastRes && lastRes.data && lastRes.data.message_id) {
                                global.commandOnReply.set(lastRes.data.message_id, {
                                    handler: command.onReply,
                                    ctx: { ...ctx, command },
                                    command
                                });
                            }
                            return lastRes;
                        },
                        sendAttachment,
                        commands,
                    };
                    if (typeof command.onCall === 'function') {
                        await command.onCall(ctx);
                    } else if (typeof command.execute === 'function') {
                        await command.execute(ctx);
                    }
                    await sendTypingIndicator(senderId, false); // Typing off
                    return;
                }
                logger.logEvent('EVENT COMMAND', 'Unknown', userDisplay, cmdName);
                if (cmdName.length > 0) {
                    await callSendAPI(senderId, { text: `Command ${cmdName} not found, try ${userPrefix}help to see all available commands.` });
                } else {
                    await callSendAPI(senderId, { text: `Please enter a command. Use ${userPrefix}help to see all available commands.` });
                }
                return;
            }
            // If this is a reply to a bot command message, let onReply handle it
            if (webhookEvent.message && webhookEvent.message.reply_to && webhookEvent.message.reply_to.mid) {
                const replyToId = webhookEvent.message.reply_to.mid;
                const replyHandler = global.commandOnReply.get(replyToId);
                if (replyHandler) {
                    await sendTypingIndicator(senderId, true);
                    await replyHandler.handler({
                        ...replyHandler.ctx,
                        replyMessage: webhookEvent.message,
                        webhookEvent,
                        senderId,
                        user
                    });
                    await sendTypingIndicator(senderId, false);
                    global.commandOnReply.delete(replyToId); // Remove handler after processing
                    return;
                }
            }
            // Only send the prefix/help message, never call AI or any other command
            await sendTypingIndicator(senderId, true);
            await callSendAPI(senderId, { text: `👋 Hi! My current command prefix for you is "${userPrefix}". Use it before any command. For example: ${userPrefix}help` });
            await sendTypingIndicator(senderId, false);
            return;
        } else if (attachments) {
            logger.logEvent('EVENT MESSAGE', 'Attachment', userDisplay);
            await handleAttachmentMessage(senderId, attachments);
        } else if (quick_reply) {
            logger.logEvent('EVENT MESSAGE', 'QuickReply', userDisplay, quick_reply.payload);
            await handleQuickReply(senderId, quick_reply);
        }
    } else if (webhookEvent.postback) {
        logger.logEvent('EVENT POSTBACK', 'Payload', userDisplay, webhookEvent.postback.payload);
        // Parse postback payload as <cmd>:<action>
        const [cmdKey, ...rest] = (webhookEvent.postback.payload || '').split(':');
        const postbackPayload = rest.join(':');
        const command = commands.get(cmdKey);
        if (command && typeof command.onPostBack === 'function') {
            const ctx = {
                senderId,
                threadId,
                webhookEvent,
                user,
                eventReceivedAt,
                reply: async (msg) => {
                    const chunks = splitMessage(msg);
                    for (const chunk of chunks) {
                        await callSendAPI(senderId, { text: chunk });
                    }
                },
                sendAttachment,
                commands,
            };
            await command.onPostBack(ctx, postbackPayload);
            return;
        }
        await handlePostback(senderId, webhookEvent.postback);
    }
}

// Placeholder functions for different message types
async function handleTextMessage(senderId, messageText) {
    logger.startLoading(`Bot is processing message from ${senderId}...`);
    await sendTypingIndicator(senderId, true); // Turn typing indicator on
    // Simulate a delay for processing
    await new Promise(res => setTimeout(res, 2000));
    logger.stopLoading(`Finished processing message for ${senderId}.`, 'succeed');
    await sendTypingIndicator(senderId, false); // Turn typing indicator off
    logger.info(`Handling text message from ${senderId}: ${messageText}`);
    // Instead of echoing, send a generic template
    const response = {
        attachment: {
            type: 'template',
            payload: {
                template_type: 'generic',
                elements: [
                    {
                        title: 'Welcome to Veltrix AI!',
                        subtitle: `You said: "${messageText}". What would you like to do next?`,
                        image_url: 'https://placehold.co/600x400/EEE/31343C?text=Veltrix%20AI', // Placeholder image
                        buttons: [
                            {
                                type: 'postback',
                                title: 'Tell me a joke',
                                payload: 'TELL_JOKE',
                            },
                            {
                                type: 'postback',
                                title: 'Show me options',
                                payload: 'SHOW_OPTIONS',
                            },
                        ],
                    },
                ],
            },
        },
    };
    await callSendAPI(senderId, response);
}

async function handleAttachmentMessage(senderId, attachments) {
    logger.info(`Handling attachment message from ${senderId}:`, attachments);
    await sendTypingIndicator(senderId, true);
    const response = {
        text: "Thanks for the attachment! I can't process it yet, but I'll learn soon."
    };
    await callSendAPI(senderId, response);
    await sendTypingIndicator(senderId, false);
}

async function handleQuickReply(senderId, quickReply) {
    logger.info(`Handling quick reply from ${senderId}:`, quickReply);
    await sendTypingIndicator(senderId, true);
    const response = {
        text: `You chose: "${quickReply.payload}".`
    };
    await callSendAPI(senderId, response);
    await sendTypingIndicator(senderId, true);
}

async function handlePostback(senderId, postback) {
    logger.info(`Handling postback from ${senderId}:`, postback);
    const payload = postback.payload;
    if (payload === 'GET_STARTED') {
        logger.info(`Received GET_STARTED postback from ${senderId}.`);
        const response = {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [
                        {
                            title: 'Welcome to Veltrix AI!',
                            subtitle: 'I am a bot designed to help you. What can I do for you?',
                            image_url: 'https://placehold.co/600x400/EEE/31343C?text=Veltrix%20AI',
                            buttons: [
                                {
                                    type: 'postback',
                                    title: 'Tell me a joke',
                                    payload: 'TELL_JOKE',
                                },
                                {
                                    type: 'postback',
                                    title: 'Show me options',
                                    payload: 'SHOW_OPTIONS',
                                },
                            ],
                        },
                    ],
                },
            },
        };
        await callSendAPI(senderId, response);
    } else if (payload === 'TELL_JOKE') {
        logger.info(`Received TELL_JOKE postback from ${senderId}.`);
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything!",
            "Why did the scarecrow win an award? Because he was outstanding in his field!",
            "Why did the math book look sad? Because it had too many problems.",
            "Parallel lines have so much in common. It's a shame they'll never meet.",
            "Why did the bicycle fall over? Because it was two-tired!",
            "I told my computer I needed a break, and it said 'No problem, I'll go to sleep.'"
        ];
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        const response = { text: joke };
        await callSendAPI(senderId, response);
    } else if (payload === 'SHOW_OPTIONS') {
        logger.info(`Received SHOW_OPTIONS postback from ${senderId}.`);

        const options = [
            { title: 'Tell me a joke', payload: 'TELL_JOKE' },
            { title: 'Show me memes', payload: 'meme' },
            { title: 'Show my profile', payload: 'userinfo' },
            { title: 'Help', payload: 'help' }
        ];
        const response = {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'Here are some options:',
                    buttons: options.map(opt => ({ type: 'postback', title: opt.title, payload: opt.payload }))
                }
            }
        };
        await callSendAPI(senderId, response);
    } else {
        logger.warn(`Received unhandled postback payload from ${senderId}: ${payload}`, postback);
        const response = { text: `Unhandled postback: ${payload}` };
        await callSendAPI(senderId, response);
    }
}

export default { handleMessage };