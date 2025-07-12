export default {
    name: 'ping',
    aliases: ['p'],
    description: 'Replies with Pong!',
    usage: '{prefix}ping',
    category: 'utility',
    async execute({ senderId, reply }) {
        const latencies = global.commandLatencies && global.commandLatencies[senderId];
        if (!latencies || latencies.length === 0) {
            reply('Not available. Try running another command first.');
            return;
        }
        const last = latencies.last || latencies[latencies.length - 1];
        const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
        reply(`🏓 Pong! Last latency: ${last}ms | Average: ${avg}ms`);
    },
}; 