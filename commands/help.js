import config from '../config.js';

export default {
    name: 'help',
    aliases: ['h'],
    description: 'Lists all commands or gets help for a specific command.',
    usage: '{prefix}help [command]',
    category: 'general',
    execute({ args, reply, senderId, commands, user }) {
        const isAdmin = config.adminIds.includes(senderId);
        const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : config.commandPrefix;
        const replacePrefix = val => typeof val === 'string' ? val.replace(/\{prefix\}/gi, userPrefix) : val;

        if (!args.length) {
            const categorized = {};
            const uniqueCommands = Array.from(commands.values())
                .filter((cmd, i, arr) => arr.findIndex(c => c.name === cmd.name) === i)
                .filter(cmd => !cmd.adminOnly || isAdmin);

            for (const cmd of uniqueCommands) {
                const category = cmd.category || 'other';
                if (!categorized[category]) categorized[category] = [];
                categorized[category].push(cmd);
            }

            let helpMessage = '╭─ Commands List ─╮\n';
            const sortedCategories = Object.keys(categorized).sort();

            sortedCategories.forEach((category, index) => {
                helpMessage += `│\n├─⯁ ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
                const sortedCommands = categorized[category].sort((a, b) => a.name.localeCompare(b.name));
                for (const cmd of sortedCommands) {
                    helpMessage += `│  ${cmd.name} ⮞ ${replacePrefix(cmd.description) || ''}\n`;
                }
            });

            helpMessage += `│\n╰─ Type \`${userPrefix}help <command>\` for more details.`;
            reply(helpMessage.trim());
        } else {
            const name = args[0].toLowerCase();
            const cmd = commands.get(name);
            if (!cmd || (cmd.adminOnly && !isAdmin)) {
                return reply(`❌ Unknown command: "${name}"`);
            }

            let helpMessage = `╭─ Command: ${cmd.name} ─╮\n│\n`;
            if (cmd.description) helpMessage += `├─⮞ Description: ${replacePrefix(cmd.description)}\n`;
            if (cmd.aliases && cmd.aliases.length) {
                helpMessage += `├─⮞ Aliases: ${cmd.aliases.join(', ')}\n`;
            }

            if (cmd.usage) helpMessage += `├─⮞ Usage: ${replacePrefix(cmd.usage)}\n`;

            if (cmd.examples && cmd.examples.length) {
                const examples = Array.isArray(cmd.examples)
                    ? cmd.examples.map(e => `│  • ${replacePrefix(e)}`).join('\n')
                    : `│  • ${replacePrefix(cmd.examples)}`;
                helpMessage += `│\n├─⮞ Examples:\n${examples}\n`;
            }
            
            if (cmd.adminOnly) helpMessage += '│\n├─🔒 This is an admin-only command.\n';

            helpMessage += '╰─';
            reply(helpMessage.trim());
        }
    },
}; 