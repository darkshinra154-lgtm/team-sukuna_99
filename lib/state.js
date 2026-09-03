// state.js
const sessions = {};
const userSockets = {};
const messageLogs = {};
let botData = null;
let io = null;
let tgBot = null;

module.exports = {
    sessions,
    userSockets,
    messageLogs,
    getBotData: () => botData,
    setBotData: (data) => { botData = data; },
    getIO: () => io,
    setIO: (socketIo) => { io = socketIo; },
    getTgBot: () => tgBot,
    setTgBot: (bot) => { tgBot = bot; }
};