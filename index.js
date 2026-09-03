require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

const { botData, saveBotData } = require('./config/database');
const state = require('./config/state');
const { setupWebServer } = require('./handlers/webHandler');
const { initializeTelegram } = require('./handlers/telegramHandler');
const BotSession = require('./classes/BotSession');
const settings = require('./settings');

// Load existing sessions on startup
async function loadExistingSessions(io, tgBot) {
    try {
        const authDirs = await fs.readdir('./auth_info');
        for (const userId of authDirs) {
            const authPath = path.join('./auth_info', userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log(`[System] Found existing session: ${userId}`);
                    if (!state.sessions[userId]) {
                        state.sessions[userId] = new BotSession(userId, io, tgBot);
                        state.sessions[userId].initialize().catch(err => {
                            console.error(`[System] Failed to init ${userId}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[System] Error loading sessions:', err.message);
    }
}

// Initialize everything
async function main() {
    // Setup Telegram first (need tgBot for BotSession)
    const { server, io } = setupWebServer();
    const tgBot = initializeTelegram(io);

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, async () => {
        console.log(`🌑 ZESHOO MINI BOT v${settings.version} running on port ${PORT}`);
        console.log(`📡 Commands loaded: 120+`);
        console.log(`🌐 Dashboard: http://localhost:${PORT}`);
        await loadExistingSessions(io, tgBot);
    });
}

main().catch(console.error);