import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = new Map();
const commandsDir = path.join(__dirname, '../../commands');

export async function loadCommands(onLoad) {
    commands.clear();
    const files = await fs.readdir(commandsDir);
    for (const file of files) {
        if (file.endsWith('.js')) {
            const fileUrl = pathToFileURL(path.join(commandsDir, file)).href;
            const commandModule = await import(fileUrl);
            const command = commandModule.default || commandModule;
            commands.set(command.name, command);
            if (command.aliases) {
                for (const alias of command.aliases) {
                    commands.set(alias, command);
                }
            }
            if (onLoad) await onLoad(command.name);
        }
    }
}

export async function reloadCommand(name) {
    const files = await fs.readdir(commandsDir);
    const file = files.find(f => f.replace(/\.js$/, '') === name);
    if (!file) return false;
    const filePath = path.join(commandsDir, file);
    const fileUrl = pathToFileURL(filePath).href + `?update=${Date.now()}`;
    const commandModule = await import(fileUrl);
    const command = commandModule.default || commandModule;
    for (const [k, v] of commands.entries()) {
        if (v.name === name) commands.delete(k);
    }
    commands.set(command.name, command);
    if (command.aliases) {
        for (const alias of command.aliases) {
            commands.set(alias, command);
        }
    }
    return true;
}

export async function installCommand(name, url) {
    const filePath = path.join(commandsDir, `${name}.js`);
    const res = await axios.get(url);
    await fs.writeFile(filePath, res.data, 'utf8');
    await reloadCommand(name);
}

export function getCommands() {
    return commands;
}

export function unloadCommand(name) {
    const command = commands.get(name);
    if (!command) return false;
    commands.delete(command.name);
    if (command.aliases) {
        for (const alias of command.aliases) {
            commands.delete(alias);
        }
    }
    return true;
}
