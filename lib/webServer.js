// webServer.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { OpenAI } = require('openai');

const state = require('./state');
const { saveBotData } = require('../dataManager');
const { getAllActiveSockets } = require('./utils');
const settings = require('../settings');

function initWebServer(PORT) {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, { cors: { origin: "*" }, transports: ['websocket', 'polling'] });
    state.setIO(io);

    let openai = null;
    if (process.env.OPENAI_API_KEY) {
        try {
            openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1" });
        } catch (e) {}
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname)));

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get('/health', (req, res) => res.status(200).send('OK'));

    io.on('connection', (socket) => {
        socket.on('admin-auth', (password) => {
            const adminPass = process.env.ADMIN_PASSWORD || 'zeshoo_techteaM';
            if (password === adminPass) { socket.authenticated = true; socket.emit('admin-auth-success'); } 
            else socket.emit('admin-auth-fail');
        });

        socket.on('set-user', (userId) => {
            state.userSockets[userId] = socket.id;
            const BotSession = require('../BotSession');
            if (!state.sessions[userId]) state.sessions[userId] = new BotSession(userId);
            state.sessions[userId].sendConnectionStatus();
        });

        socket.on('pair-request', async ({ userId, number }) => {
            const BotSession = require('../BotSession');
            const botData = state.getBotData();
            if (!state.sessions[userId]) state.sessions[userId] = new BotSession(userId);
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: true };
                saveBotData();
            }
            state.sessions[userId].tgChatId = null;
            await state.sessions[userId].initialize(number);
        });

        socket.on('broadcast', async ({ message }) => {
            if (!socket.authenticated) return;
            const activeBots = getAllActiveSockets();
            let totalSent = 0, totalChats = 0;
            for (const bot of activeBots) {
                try {
                    const personalChats = Object.keys(bot.sock.chats || {}).filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us'));
                    for (const jid of personalChats) {
                        try { await bot.sock.sendMessage(jid, { text: `\u{1F4E2} *BROADCAST MESSAGE* \u{1F4E2}\n\n${message}\n\n_From: ZESHOO MINI Bot Admin_` }); totalSent++; } catch (e) {}
                    }
                    totalChats += personalChats.length;
                } catch (e) {}
            }
            const botData = state.getBotData();
            botData.broadcastHistory.unshift({ message, timestamp: new Date().toISOString(), totalSent, totalBots: activeBots.length });
            if (botData.broadcastHistory.length > 50) botData.broadcastHistory.pop();
            saveBotData();
            socket.emit('broadcast-result', { totalSent, totalBots: activeBots.length, totalChats });
        });

        socket.on('stop-bot', async ({ sessionId }) => {
            if (!socket.authenticated) return;
            if (state.sessions[sessionId] && state.sessions[sessionId].sock) {
                try { await state.sessions[sessionId].sock.logout(); delete state.sessions[sessionId]; socket.emit('bot-stopped', { sessionId, success: true }); } 
                catch (e) { socket.emit('bot-stopped', { sessionId, success: false, error: e.message }); }
            }
        });

        socket.on('stop-all-bots', async () => {
            if (!socket.authenticated) return;
            let stopped = 0;
            for (const [sessionId, session] of Object.entries(state.sessions)) {
                try { if (session.sock) { await session.sock.logout(); stopped++; } } catch (e) {}
            }
            socket.emit('all-bots-stopped', { stopped });
        });

        socket.on('get-bots-list', () => {
            if (!socket.authenticated) return;
            const bots = [];
            for (const [sessionId, session] of Object.entries(state.sessions)) {
                if (session.sock && session.sock.user) bots.push({ sessionId, phoneNumber: session.phoneNumber, isConnected: session.isConnected, userName: state.getBotData().userNames[sessionId] || 'Unknown' });
            }
            socket.emit('bots-list', bots);
        });

        socket.on('get-broadcast-history', () => {
            if (!socket.authenticated) return;
            socket.emit('broadcast-history', state.getBotData().broadcastHistory || []);
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of Object.entries(state.userSockets)) {
                if (socketId === socket.id) { delete state.userSockets[userId]; break; }
            }
        });
    });

    server.listen(PORT, async () => {
        console.log(`\u{1F311} ZESHOO MINI BOT v${settings.version} Server running on port ${PORT}`);
        console.log(`\u{1F4E1} Total commands loaded: 120+`);
        console.log(`\u{1F310} Web Dashboard: http://localhost:${PORT}`);
        const { loadExistingSessions } = require('../dataManager');
        const BotSession = require('../BotSession');
        await loadExistingSessions(BotSession);
    });

    return server;
}

module.exports = { initWebServer };