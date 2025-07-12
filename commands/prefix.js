import * as userDb from '../src/utils/userDb.js';

export default {
    name: 'prefix',
    description: 'Gets or sets your custom command prefix.',
    usage: '{prefix}prefix [newPrefix]',
    category: 'utility',
    async execute({ user, senderId, args, reply }) {
        let u = user || await userDb.getUser(senderId) || {};
        if (!u.custom) u.custom = {};
        if (!args[0]) {
            const current = u.custom.prefix || null;
            reply(current ? `Your current prefix is: ${current}` : 'You are using the default prefix.');
        } else {
            const newPrefix = args[0];
            if (typeof newPrefix !== 'string' || newPrefix.length > 5) {
                reply('Prefix must be a string of up to 5 characters.');
                return;
            }
            u.custom.prefix = newPrefix;
            await userDb.saveUser(senderId, u);
            reply(`Your custom prefix is now set to: ${newPrefix}`);
        }
    },
}; 