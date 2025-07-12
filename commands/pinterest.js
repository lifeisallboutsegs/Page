import axios from 'axios';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import pinterest from '../src/utils/pinterest.js';
import logger from '../logger.js';

const searchCache = new Map();

function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') radius = { tl: radius, tr: radius, br: radius, bl: radius };
    else {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (const side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

async function createCollage(results, query) {
    const columns = 4;
    const imageWidth = 236;
    const gap = 15;
    const headerHeight = 60;
    const footerHeight = 40;
    const cornerRadius = 12;

    const images = results;
    if (images.length === 0) throw new Error('No images to create a collage.');

    const columnHeights = new Array(columns).fill(headerHeight + gap);
    const imagePositions = [];

    for (const image of images) {
        const smallestColumn = columnHeights.indexOf(Math.min(...columnHeights));
        const imageUrl = image.images.orig?.url || image.images['736x']?.url || image.images['474x']?.url;
        if (!imageUrl) continue;

        const originalWidth = image.images.orig?.width || image.images['736x']?.width || imageWidth;
        const originalHeight = image.images.orig?.height || image.images['736x']?.height || imageWidth;
        const imgHeight = originalHeight * (imageWidth / originalWidth);

        imagePositions.push({
            url: imageUrl,
            x: gap + smallestColumn * (imageWidth + gap),
            y: columnHeights[smallestColumn],
            width: imageWidth,
            height: imgHeight,
        });
        columnHeights[smallestColumn] += imgHeight + gap;
    }

    const canvasWidth = (imageWidth * columns) + (gap * (columns + 1));
    const canvasHeight = Math.max(...columnHeights) + footerHeight;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    context.font = 'bold 20px Arial';
    context.fillStyle = '#111';
    context.textAlign = 'center';
    context.fillText(`Results for "${query}"`, canvasWidth / 2, headerHeight / 2 + 10);

    for (let i = 0; i < imagePositions.length; i++) {
        const pos = imagePositions[i];
        try {
            const loadedImage = await loadImage(pos.url);

            context.save();
            roundRect(context, pos.x, pos.y, pos.width, pos.height, cornerRadius);
            context.clip();
            context.drawImage(loadedImage, pos.x, pos.y, pos.width, pos.height);
            context.restore();

            context.fillStyle = 'white';
            context.beginPath();
            context.arc(pos.x + 22, pos.y + 22, 14, 0, Math.PI * 2, true);
            context.fill();

            context.fillStyle = 'black';
            context.font = 'bold 16px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(String(i + 1), pos.x + 22, pos.y + 22);
        } catch (err) {
            logger.error(`Failed to load image for collage: ${pos.url}`, err);
            context.fillStyle = '#EFEFEF';
            context.fillRect(pos.x, pos.y, pos.width, pos.height);
        }
    }

    context.font = '14px Arial';
    context.fillStyle = '#555';
    context.textAlign = 'center';
    context.fillText('Reply with an index to get the image (e.g., "1")', canvasWidth / 2, canvasHeight - (footerHeight / 2));

    return canvas.toBuffer('image/png');
}


export default {
    name: 'pinterest',
    aliases: ['pin'],
    description: 'Search for images on Pinterest.',
    usage: '{prefix}pinterest <query>',
    category: 'fun',
    async onCall(ctx) {
        const { args, reply, senderId, sendAttachment } = ctx;
        const query = args.join(' ');
        if (!query) {
            return reply('Please provide a search query. Usage: pinterest <topic>');
        }

        try {
            await reply('🔍 Searching Pinterest for you...');
            const response = await pinterest.search(query);
            const results = response?.resource_response?.data?.results;
            const bookmark = response?.resource_response?.bookmark;

            if (!results || results.length === 0) {
                return reply('No results found for that query.');
            }

            const imageList = results.map(r => r.images.orig?.url || r.images['736x']?.url).filter(Boolean);
            searchCache.set(senderId, { query, results, bookmark, imageList });

            const collageBuffer = await createCollage(results, query);
            const collageMessage = await sendAttachment('image', collageBuffer);

            if (collageMessage && collageMessage.data && collageMessage.data.message_id) {
                global.commandOnReply.set(collageMessage.data.message_id, {
                    handler: this.onReply,
                    ctx: { ...ctx, command: this }
                });
            }

            if (bookmark) {
                const payload = {
                    template_type: 'button',
                    text: 'Want to see more?',
                    buttons: [{
                        type: 'postback',
                        title: 'Next Page ⮞',
                        payload: `pinterest:next`
                    }]
                };
                await ctx.sendTemplate(payload);
            }
        } catch (error) {
            logger.error('Pinterest command failed:', error);
            reply('❌ Sorry, something went wrong while searching Pinterest.');
        }
    },
    async onReply(ctx) {
        const { replyMessage, user, senderId, webhookEvent, command } = ctx;
        await command._handleReply({
            ...ctx,
            message: replyMessage,
            webhookEvent,
            user,
            senderId
        });
    },
    async _handleReply(ctx) {
        const { senderId, reply, sendAttachment, message } = ctx;
        const cached = searchCache.get(senderId);
        if (!cached) return;

        const indexes = message.text.match(/\d+/g);
        if (!indexes) return;

        for (const indexStr of indexes) {
            const index = parseInt(indexStr, 10) - 1;
            if (index >= 0 && index < cached.imageList.length) {
                const imageUrl = cached.imageList[index];
                await reply(`Sending image #${index + 1}...`);
                await sendAttachment('image', imageUrl);
            } else {
                await reply(`Invalid index: ${index + 1}. Please choose from 1 to ${cached.imageList.length}.`);
            }
        }
    },
    async onPostBack(ctx, payload) {
        if (payload !== 'next') return;
        
        const { senderId, reply, sendAttachment } = ctx;
        const cachedData = searchCache.get(senderId);

        if (!cachedData || !cachedData.bookmark) {
            return reply('Your previous search has expired. Please start a new search.');
        }

        const { query, bookmark } = cachedData;

        try {
            await reply('Searching for more...');
            const response = await pinterest.getNextPage(query, bookmark);
            const newResults = response?.resource_response?.data?.results;
            const newBookmark = response?.resource_response?.bookmark;

            if (!newResults || newResults.length === 0) {
                return reply('No more results found.');
            }

            const imageList = newResults.map(r => r.images.orig?.url || r.images['736x']?.url).filter(Boolean);
            searchCache.set(senderId, { query, results: newResults, bookmark: newBookmark, imageList });

            const collageBuffer = await createCollage(newResults, query);
            const collageMessage = await sendAttachment('image', collageBuffer);

            if (collageMessage && collageMessage.data && collageMessage.data.message_id) {
                global.commandOnReply.set(collageMessage.data.message_id, {
                    handler: this.onReply,
                    ctx: { ...ctx, command: this }
                });
            }

            if (newBookmark) {
                 const newPayload = {
                    template_type: 'button',
                    text: 'Want to see more?',
                    buttons: [{
                        type: 'postback',
                        title: 'Next Page ⮞',
                        payload: `pinterest:next`
                    }]
                };
                await ctx.sendTemplate(newPayload);
            }
        } catch (error) {
            logger.error('Pinterest pagination failed:', error);
            reply('❌ Failed to load the next page.');
        }
    }
}; 