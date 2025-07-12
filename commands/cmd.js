import * as commandLoader from '../src/handlers/commandLoader.js';

export default {
    name: 'cmd',
    description: 'Manage bot commands (admin only).',
    usage: '{prefix}cmd install <name> <url> | reload <name> | unload <name>',
    adminOnly: true,
    category: 'admin',
    async execute({ args, reply }) {
        if (args[0] === 'install' && args[1] && args[2]) {
            const [ , name, url ] = args;
            try {
                await commandLoader.installCommand(name, url);
                reply(`✅ Command '${name}' installed from ${url}`);
            } catch (e) {
                reply(`❌ Failed to install command: ${e.message}`);
            }
        } else if (args[0] === 'reload' && args[1]) {
            const name = args[1];
            try {
                const ok = await commandLoader.reloadCommand(name);
                if (ok) reply(`♻️ Command '${name}' reloaded.`);
                else reply(`❌ Command '${name}' not found.`);
            } catch (e) {
                reply(`❌ Failed to reload command: ${e.message}`);
            }
        } else if (args[0] === 'unload' && args[1]) {
            const name = args[1];
            try {
                const ok = commandLoader.unloadCommand(name);
                if (ok) reply(`🗑️ Command '${name}' unloaded from memory.`);
                else reply(`❌ Command '${name}' not found.`);
            } catch (e) {
                reply(`❌ Failed to unload command: ${e.message}`);
            }
        } else {
            reply('Usage: !cmd install <name> <url> | reload <name> | unload <name>');
        }
    },
}; 