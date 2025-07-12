export default {
    PORT: process.env.PORT,
    VERIFY_TOKEN: process.env.VERIFY_TOKEN,
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN,
    adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [], // Messenger user IDs of admins
    commandPrefix: process.env.COMMAND_PREFIX,
    userDbType: 'mongodb', // 'json', 'mongodb', or 'sqlite'
    MONGODB_URI: process.env.MONGODB_URI,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    PAGE_ID: process.env.PAGE_ID
    // Add other configurations here as needed
};