import chalk from 'chalk';
import moment from 'moment';
import ora from 'ora';

let spinner;

// Configuration for the logger
const config = {
    useIcons: true, // Set to false to disable icons
    minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info', // Set minimum logging level (e.g., 'debug', 'trace')
};

const icons = {
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌ ',
    debug: '🐞 ',
    success: '✅ ',
    trace: '🔍 ',
};

export function goatbotTimestamp() {
    return moment().format('HH:mm:ss DD/MM/YYYY');
}

export function logEvent(type, ...fields) {
    // Example: 17:07:48 07/07/2025  EVENT MESSAGE: Text | senderId | text
    const line = `${goatbotTimestamp()}  ${type}: ${fields.join(' | ')}`;
    console.log(line);
}

const log = (level, message, data = undefined) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    let logPrefix = `[${timestamp}] [${level.toUpperCase().padEnd(7)}]`;
    if (config.useIcons && icons[level]) {
        logPrefix = `${icons[level]} ${logPrefix}`;
    }
    let logMessage = `${logPrefix} ${message}`;
    // Only print data for debug/error, and only as a single line
    if (data !== undefined && (level === 'debug' || level === 'error')) {
        logMessage += ` | ${typeof data === 'object' ? JSON.stringify(data) : data}`;
    }
    if (spinner) spinner.stop();
    switch (level) {
        case 'info':
            console.log(chalk.blue(logMessage));
            break;
        case 'warn':
            console.log(chalk.yellow(logMessage));
            break;
        case 'error':
            console.error(chalk.red(logMessage));
            break;
        case 'debug':
            console.log(chalk.gray(logMessage));
            break;
        case 'success':
            console.log(chalk.green(logMessage));
            break;
        case 'trace':
            console.log(chalk.magenta(logMessage));
            break;
        default:
            console.log(logMessage);
            break;
    }
};

function startLoading(text) {
    if (spinner) spinner.stop();
    spinner = ora(text).start();
}

function stopLoading(text, status = 'succeed') {
    if (spinner) {
        if (status === 'succeed') spinner.succeed(text);
        else if (status === 'fail') spinner.fail(text);
        else spinner.stop();
        spinner = null;
    }
}

const logger = {
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),
    debug: (message, data) => log('debug', message, data),
    success: (message, data) => log('success', message, data),
    trace: (message, data) => log('trace', message, data),
    startLoading,
    stopLoading,
    header: (title) => {
        console.log(chalk.cyan(`\n========================================\n ${title.toUpperCase()}\n========================================\n`));
    },
    divider: () => {
        console.log(chalk.gray('----------------------------------------'));
    },
    setConfig: (newConfig) => {
        Object.assign(config, newConfig);
    },
    logEvent,
};

export default logger; 