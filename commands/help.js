import config from '../config.js';

export default {
    name: 'help',
    aliases: ['h'],
    description: 'List all commands or get help for a specific command.',
    usage: '{prefix}help [command]',
    category: 'general',
    execute({ args, reply, senderId, commands, user }) {
        const isAdmin = config.adminIds.includes(senderId);
        const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : config.commandPrefix;
        // Helper to replace {prefix} in any string
        const replacePrefix = val => typeof val === 'string' ? val.replace(/\{prefix\}/gi, userPrefix) : val;
        if (!args.length) {
            const all = Array.from(commands.values())
                .filter((cmd, i, arr) => arr.findIndex(c => c.name === cmd.name) === i) // unique by name
                .filter(cmd => !cmd.adminOnly || isAdmin)
                .map(cmd => {
                    let usage = replacePrefix(cmd.usage);
                    if (usage && !usage.startsWith(userPrefix)) usage = userPrefix + usage;
                    let desc = replacePrefix(cmd.description);
                    return `• ${cmd.name}${cmd.adminOnly ? ' (admin)' : ''}${cmd.aliases && cmd.aliases.length ? ` (${cmd.aliases.join(', ')})` : ''} - ${desc}${usage ? `\n   Usage: ${usage}` : ''}`;
                })
                .join('\n');
            reply(`Available commands:\n${all}`);
        } else {
            const name = args[0].toLowerCase();
            const cmd = commands.get(name);
            if (!cmd || (cmd.adminOnly && !isAdmin)) return reply(`No such command: ${name}`);
            let usage = replacePrefix(cmd.usage);
            if (usage && !usage.startsWith(userPrefix)) usage = userPrefix + usage;
            let desc = replacePrefix(cmd.description);
            let examples = Array.isArray(cmd.examples) ? cmd.examples.map(replacePrefix).join('\n') : (cmd.examples ? replacePrefix(cmd.examples) : 'None');
            reply(`Command: ${cmd.name}\nAliases: ${cmd.aliases ? cmd.aliases.join(', ') : 'None'}\nDescription: ${desc}\nUsage: ${usage}${cmd.adminOnly ? '\n(Admin only)' : ''}\nExamples:\n${examples}`);
        }
    },
}; 