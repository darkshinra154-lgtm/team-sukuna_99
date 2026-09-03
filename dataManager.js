// dataManager.js
const fs = require('fs-extra');
const path = require('path');
const state = require('./lib/state');

const AUTH_DIR = './auth_info';
const DATA_FILE = './data/bot_data.json';
const defaultBotData = { 
    antilinkGroups: {}, antiStickerGroups: {}, antiVoiceGroups: {}, 
    antiImageGroups: {}, antiVideoGroups: {}, antiStatusGroups: {}, 
    totalBots: 0, registeredBots: [], statusSettings: {}, antiDelete: {}, 
    userNames: {}, antiCall: {}, broadcastHistory: [], welcomeMessages: {}, 
    goodbyeMessages: {}, groupEvents: {}, antiPromote: {}, antiDemote: {} 
};

function loadBotData() {
    fs.ensureDirSync(AUTH_DIR);
    fs.ensureDirSync('./data');
    let botData;
    if (fs.existsSync(DATA_FILE)) {
        try { 
            const loadedData = fs.readJsonSync(DATA_FILE); 
            botData = { 
                ...defaultBotData, ...loadedData, 
                antilinkGroups: { ...defaultBotData.antilinkGroups, ...(loadedData.antilinkGroups || {}) },
                antiStickerGroups: { ...defaultBotData.antiStickerGroups, ...(loadedData.antiStickerGroups || {}) },
                antiVoiceGroups: { ...defaultBotData.antiVoiceGroups, ...(loadedData.antiVoiceGroups || {}) },
                antiImageGroups: { ...defaultBotData.antiImageGroups, ...(loadedData.antiImageGroups || {}) },
                antiVideoGroups: { ...defaultBotData.antiVideoGroups, ...(loadedData.antiVideoGroups || {}) },
                antiStatusGroups: { ...defaultBotData.antiStatusGroups, ...(loadedData.antiStatusGroups || {}) },
                statusSettings: { ...defaultBotData.statusSettings, ...(loadedData.statusSettings || {}) },
                welcomeMessages: { ...defaultBotData.welcomeMessages, ...(loadedData.welcomeMessages || {}) },
                goodbyeMessages: { ...defaultBotData.goodbyeMessages, ...(loadedData.goodbyeMessages || {}) },
                groupEvents: { ...defaultBotData.groupEvents, ...(loadedData.groupEvents || {}) },
                antiPromote: { ...defaultBotData.antiPromote, ...(loadedData.antiPromote || {}) },
                antiDemote: { ...defaultBotData.antiDemote, ...(loadedData.antiDemote || {}) }
            };
        } catch (e) { botData = { ...defaultBotData }; }
    } else { botData = { ...defaultBotData }; }
    state.setBotData(botData);
}

function saveBotData() {
    fs.writeJsonSync(DATA_FILE, state.getBotData());
}

async function loadExistingSessions(BotSession) {
    try {
        const authDirs = await fs.readdir(AUTH_DIR);
        for (const userId of authDirs) {
            const authPath = path.join(AUTH_DIR, userId);
            const stats = await fs.stat(authPath);
            if (stats.isDirectory()) {
                const credsFile = path.join(authPath, 'creds.json');
                if (fs.existsSync(credsFile)) {
                    console.log(`[System] Found existing session for: ${userId}. Initializing...`);
                    if (!state.sessions[userId]) {
                        state.sessions[userId] = new BotSession(userId);
                        state.sessions[userId].initialize().catch(err => {
                            console.error(`[System] Failed to auto-initialize session ${userId}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[System] Error loading existing sessions:', err.message);
    }
}

module.exports = { AUTH_DIR, DATA_FILE, loadBotData, saveBotData, loadExistingSessions };