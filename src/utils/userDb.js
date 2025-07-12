import config from '../../config.js';

// --- JSON Backend ---
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data/users.json');

async function ensureDb() {
    try {
        await fs.access(DB_PATH);
    } catch {
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
        await fs.writeFile(DB_PATH, '{}');
    }
}

async function getUserJson(psid) {
    await ensureDb();
    const db = JSON.parse(await fs.readFile(DB_PATH));
    return db[psid] || null;
}

async function saveUserJson(psid, data) {
    await ensureDb();
    const db = JSON.parse(await fs.readFile(DB_PATH));
    const oldUser = db[psid] || {};
    let merged;
    if (oldUser.custom && data.custom) {
        merged = {
            ...oldUser,
            ...data,
            custom: { ...oldUser.custom, ...data.custom }
        };
    } else {
        merged = { ...oldUser, ...data };
    }
    db[psid] = merged;
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

async function getAllUsersJson() {
    await ensureDb();
    const db = JSON.parse(await fs.readFile(DB_PATH));
    return Object.values(db);
}

// --- MongoDB Backend ---
let mongoClient, mongoDb, mongoCol;
async function initMongo() {
    if (!mongoClient) {
        const { MongoClient } = await import('mongodb');
        mongoClient = new MongoClient(process.env.MONGODB_URI, { useUnifiedTopology: true });
        await mongoClient.connect();
        mongoDb = mongoClient.db(process.env.MONGODB_DB || 'veltrix');
        mongoCol = mongoDb.collection(process.env.MONGODB_COLLECTION || 'users');
    }
}
async function getUserMongo(psid) {
    await initMongo();
    return await mongoCol.findOne({ psid }) || null;
}
async function saveUserMongo(psid, data) {
    await initMongo();
    const oldUser = await mongoCol.findOne({ psid }) || {};
    let merged;
    if (oldUser.custom && data.custom) {
        merged = {
            ...oldUser,
            ...data,
            custom: { ...oldUser.custom, ...data.custom }
        };
    } else {
        merged = { ...oldUser, ...data };
    }
    await mongoCol.updateOne({ psid }, { $set: merged }, { upsert: true });
}

async function getAllUsersMongo() {
    await initMongo();
    return await mongoCol.find({}).toArray();
}

// --- SQLite Backend ---
let sqliteDb;
async function initSqlite() {
    if (!sqliteDb) {
        const sqlite3 = (await import('sqlite3')).default;
        const { open } = await import('sqlite');
        sqliteDb = await open({ filename: process.env.SQLITE_PATH || './data/users.sqlite', driver: sqlite3.Database });
        await sqliteDb.exec('CREATE TABLE IF NOT EXISTS users (psid TEXT PRIMARY KEY, data TEXT)');
    }
}
async function getUserSqlite(psid) {
    await initSqlite();
    const row = await sqliteDb.get('SELECT data FROM users WHERE psid = ?', psid);
    return row ? JSON.parse(row.data) : null;
}
async function saveUserSqlite(psid, data) {
    await initSqlite();
    const oldUser = await getUserSqlite(psid) || {};
    let merged;
    if (oldUser.custom && data.custom) {
        merged = {
            ...oldUser,
            ...data,
            custom: { ...oldUser.custom, ...data.custom }
        };
    } else {
        merged = { ...oldUser, ...data };
    }
    await sqliteDb.run('INSERT OR REPLACE INTO users (psid, data) VALUES (?, ?)', psid, JSON.stringify(merged));
}

async function getAllUsersSqlite() {
    await initSqlite();
    const rows = await sqliteDb.all('SELECT data FROM users');
    return rows.map(row => JSON.parse(row.data));
}

// --- Unified API ---
export async function getUser(psid) {
    switch (config.userDbType) {
        case 'json': return getUserJson(psid);
        case 'mongodb': return getUserMongo(psid);
        case 'sqlite': return getUserSqlite(psid);
        default: throw new Error('Unknown userDbType in config');
    }
}
export async function saveUser(psid, data) {
    switch (config.userDbType) {
        case 'json': return saveUserJson(psid, data);
        case 'mongodb': return saveUserMongo(psid, data);
        case 'sqlite': return saveUserSqlite(psid, data);
        default: throw new Error('Unknown userDbType in config');
    }
}
export async function getAllUsers() {
    switch (config.userDbType) {
        case 'json': return getAllUsersJson();
        case 'mongodb': return getAllUsersMongo();
        case 'sqlite': return getAllUsersSqlite();
        default: throw new Error('Unknown userDbType in config');
    }
}