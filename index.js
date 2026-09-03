import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';

import { botData } from './config/database.js';
import state from './config/state.js';
import { setupWebServer } from './handlers/webHandler.js';
import { initializeTelegram } from './handlers/telegramHandler.js';
import BotSession from './classes/BotSession.js';
import settings from './settings.js';

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

async function main() {
    const { server, io } = setupWebServer();
    const tgBot = initializeTelegram(io);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, async () => {
        console.log(`🌑 ZESHOO MINI BOT v${settings.version} running on port ${PORT}`);
        console.log(`📡 Commands loaded: 120+`);
        console.log(`🌐 Dashboard: http://localhost:${PORT}`);
        await loadExistingSessions(io, tgBot);
    });
}

main().catch(console.error);