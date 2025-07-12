import cron from 'node-cron';
import moment from 'moment-timezone';
import * as userDb from '../utils/userDb.js';
import { callSendAPI } from './messageHandler.js';
import config from '../../config.js';
import logger from '../../logger.js';

const messages = {
    morning: [
        "Good morning, sunshine! ☀️ Hope you have a day as amazing as you are!",
        "Rise and shine! The world is waiting for your awesomeness. ☕",
        "A brand new day is here! Make it count. Good morning! ✨",
        "Wakey, wakey, eggs and bakey! Just kidding, but seriously, have a great morning! 😄",
        "Sending you good vibes for a productive and joyful morning! 😊"
    ],
    night: [
        "Good night, sleep tight, don't let the bed bugs bite! 😴",
        "Time to recharge. May your dreams be sweet and peaceful. 🌙",
        "Wishing you a night filled with calm and restful sleep. 🛌",
        "The stars are out, and so should you be... sleeping! Good night! ✨",
        "May your evening be relaxing and your sleep be deep. Good night!"
    ],
    random: [
        "Just popping in to say hi and wish you a fantastic day! 😊",
        "Sending good vibes and positive energy your way! ✨",
        "Hope you're having an absolutely wonderful day! Keep shining!",
        "You're doing great! Keep up the amazing work. 👍",
        "Remember to take a moment for yourself today and relax. 🧘‍♀️",
        "A little message to brighten your day! You got this! 🌟",
        "Thinking of you and sending a smile! 😄",
        "Don't forget to stay hydrated! 💧",
        "You're awesome! Just a friendly reminder. 💪",
        "Hope your day is as sweet as you are! 🍬"
    ]
};

function getRandomMessage(type) {
    const msgs = messages[type];
    return msgs[Math.floor(Math.random() * msgs.length)];
}

async function sendMomentMessage(user) {
    if (!user || !(user.psid || user.id)) {
        logger.warn("Attempted to send moment message to invalid user object.", user);
        return;
    }
    try {
        const userTimezone = user.custom && user.custom.timezone ? user.custom.timezone : config.timezone || 'Asia/Dhaka';
        const now = moment().tz(userTimezone);
        const hour = now.hour();

        let messageType;
        if (hour >= 5 && hour < 12) {
            messageType = 'morning';
        } else if (hour >= 20 || hour < 5) {
            messageType = 'night';
        } else {
            messageType = 'random';
        }

        const messageText = getRandomMessage(messageType);
        await callSendAPI(user.psid, { text: messageText });
        logger.info(`Sent '${messageType}' moment message to user ${user.psid} in timezone ${userTimezone}`);
    } catch (error) {
        logger.error(`Failed to send moment message to user ${user.psid}:`, error);
    }
}

export async function initMomentSender() {
    logger.info("Initializing moment sender...");
    const defaultTimezone = config.timezone || 'Asia/Dhaka';

    // Schedule morning messages (e.g., every day at 8 AM)
    cron.schedule('0 8 * * *', async () => {
        logger.info("Sending morning moment messages...");
        const users = await userDb.getAllUsers();
        for (const user of users) {
            await sendMomentMessage(user);
        }
    }, {
        scheduled: true,
        timezone: defaultTimezone
    });

    // Schedule night messages (e.g., every day at 10 PM)
    cron.schedule('0 22 * * *', async () => {
        logger.info("Sending night moment messages...");
        const users = await userDb.getAllUsers();
        for (const user of users) {
            await sendMomentMessage(user);
        }
    }, {
        scheduled: true,
        timezone: defaultTimezone
    });

    // Schedule random messages (e.g., every 3 hours during the day)
    cron.schedule('0 */3 * * *', async () => {
        const users = await userDb.getAllUsers();
        for (const user of users) {
            const userTimezone = user.custom && user.custom.timezone ? user.custom.timezone : defaultTimezone;
            const currentHour = moment().tz(userTimezone).hour();

            // Only send random messages during active hours (e.g., 9 AM to 8 PM, excluding morning/night)
            if (currentHour >= 9 && currentHour < 20 && currentHour !== 8 && currentHour !== 22) {
                logger.info(`Sending random moment message to user ${user.psid} in timezone ${userTimezone}...`);
                await sendMomentMessage(user);
            }
        }
    }, {
        scheduled: true,
        timezone: defaultTimezone
    });

    logger.info("Moment sender initialized. Schedules set.");
} 