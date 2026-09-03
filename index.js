// index.js
require('dotenv').config();

const { loadBotData } = require('./dataManager');
const { initTelegramBot } = require('./lib/telegramBot');
const { initWebServer } = require('./lib/webServer');
const BotSession = require('./BotSession');

// 1. Load Configuration Data
loadBotData();

// 2. Initialize Telegram Bot
initTelegramBot(BotSession);

// 3. Initialize Web Server & Socket.IO
const PORT = process.env.PORT || 3000;
initWebServer(PORT);