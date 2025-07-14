import * as userApi from '../src/utils/userApi.js';
import * as userDb from '../src/utils/userDb.js';
import moment from 'moment';

export default {
    name: 'userinfo',
    aliases: ['me', 'profile'],
    description: 'Shows your Messenger profile info.',
    usage: '{prefix}userinfo [refresh]',
    category: 'general',
    async execute({ user, senderId, args, reply, sendAttachment }) {
        let u = user;
        if (!u) {
            u = await userDb.createUserIfNotExists(senderId);
        }
        if (args[0] && args[0].toLowerCase() === 'refresh') {
            u = await userApi.fetchUserInfo(senderId);
            if (u) await userDb.saveUser(senderId, u);
        }
        if (!u) return reply('User info not found.');
        let msg = `👤 Name: ${u.first_name ? u.first_name : ''} ${u.last_name ? u.last_name : ''}\n`;
        if (u.psid) msg += `🆔 ID: ${u.psid}\n`;
        if (u.locale) msg += `🌐 Locale: ${u.locale}\n`;
        if (u.custom.timezone) {
            const tz = u.custom.timezone;
            const now = moment().tz(tz);
            const offset = now.format('Z'); // e.g., "+06:00"
            msg += `🕒 Timezone: ${tz} (GMT${offset})\n`;
        }
        if (u.gender) msg += `⚧ Gender: ${u.gender}\n`;
        if (u.lastActive) msg += `🕓 Last Active: ${moment(u.lastActive).fromNow()}\n`;
        if (u.profile_pic) sendAttachment('image', u.profile_pic);
        reply(msg.trim());
    },
};
