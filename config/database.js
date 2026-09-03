import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = './auth_info';
const DATA_FILE = './data/bot_data.json';

fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync('./data');

const defaultBotData = {
antilinkGroups: {}, antiStickerGroups: {}, antiVoiceGroups: {},
antiImageGroups: {}, antiVideoGroups: {}, antiStatusGroups: {},
totalBots: 0, registeredBots: [], statusSettings: {},
antiDelete: {}, userNames: {}, antiCall: {}, broadcastHistory: [],
welcomeMessages: {}, goodbyeMessages: {}, groupEvents: {},
antiPromote: {}, antiDemote: {}
};

let botData;
if (fs.existsSync(DATA_FILE)) {
try {
const loadedData = fs.readJsonSync(DATA_FILE);
botData = {
...defaultBotData,
...loadedData,
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
} catch (e) {
botData = { ...defaultBotData };
}
} else {
botData = { ...defaultBotData };
}

export function saveBotData() {
fs.writeJsonSync(DATA_FILE, botData);
}

export { botData, AUTH_DIR, DATA_FILE };