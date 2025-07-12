import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import config from './config.js';
import logger from './logger.js';
import messageHandler from './src/handlers/messageHandler.js';
import { initMomentSender } from './src/handlers/momentSender.js';
// Use environment variables from config
const PORT =config.PORT || process.env.PORT || 3000;
const VERIFY_TOKEN = config.VERIFY_TOKEN;

// Configure logger based on environment or settings
logger.setConfig({
    minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info', // Set to 'info', 'warn', 'error', 'debug', or 'trace'
    useIcons: true,    // Set to false to disable icons
});

logger.header('Bot Server Starting');
logger.info('Logger configured successfully.');
logger.debug('This is a debug message, only visible if minLevel is debug or trace.');
logger.trace('This is a trace message, very verbose and only visible if minLevel is trace.');

// Middleware
const app = express();
app.use(express.json()); // Use express.json() instead of body-parser for modern Express

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('WEBHOOK VERIFIED');
        res.status(200).send(challenge);
    } else {
        logger.warn('Failed to verify webhook: Token mismatch or incorrect mode.');
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    const { object } = req.body;
    if (object === 'page') {
        const { entry } = req.body;
        for (const event of entry) {
            const { messaging } = event;
            for (const message of messaging) {
                messageHandler.handleMessage(message);

            }
        }
    }
    res.status(200).send('EVENT_RECEIVED');
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled Error:', err);
    console.log(err)
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    initMomentSender(); // Initialize moment sender after server starts
});