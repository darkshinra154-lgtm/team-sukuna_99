const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs-extra');

const state = require('../config/state');
const { botData, saveBotData } = require('../config/database');
const { getAllActiveSockets } = require('../utils/helpers');
const BotSession = require('../classes/BotSession');

function setupWebServer(tgBot) {
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server, {
        cors: { origin: "*" },
        transports: ['websocket', 'polling']
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '..')));

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
    app.get('/health', (req, res) => res.status(200).send('OK'));

    // Socket.io handlers
    io.on('connection', (socket) => {
        socket.on('admin-auth', (password) => {
            const adminPass = process.env.ADMIN_PASSWORD || 'zeshoo_techteaM';
            if (password === adminPass) {
                socket.authenticated = true;
                socket.emit('admin-auth-success');
            } else {
                socket.emit('admin-auth-fail');
            }
        });

        socket.on('set-user', (userId) => {
            state.userSockets[userId] = socket.id;
            if (!state.sessions[userId]) state.sessions[userId] = new BotSession(userId, io, tgBot);
            state.sessions[userId].sendConnectionStatus();
        });

        socket.on('pair-request', async ({ userId, number }) => {
            if (!state.sessions[userId]) {
                state.sessions[userId] = new BotSession(userId, io, tgBot);
            }
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: true
                };
                saveBotData();
            }
            state.sessions[userId].tgChatId = null;
            await state.sessions[userId].initialize(number);
        });

        socket.on('broadcast', async ({ message }) => {
            if (!socket.authenticated) return;

            const activeBots = getAllActiveSockets(state.sessions);
            let totalSent = 0, totalChats = 0;

            for (const bot of activeBots) {
                try {
                    const allChats = Object.keys(bot.sock.chats || {});
                    const personalChats = allChats.filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us'));

                    for (const jid of personalChats) {
                        try {
                            await bot.sock.sendMessage(jid, {
                                text: `📢 *BROADCAST MESSAGE* 📢\n\n${message}\n\n_From: ZESHOO MINI Bot Admin_`
                            });
                            totalSent++;
                        } catch (e) { }
                    }
                    totalChats += personalChats.length;
                } catch (e) { }
            }

            botData.broadcastHistory.unshift({
                message, timestamp: new Date().toISOString(), totalSent, totalBots: activeBots.length
            });
            if (botData.broadcastHistory.length > 50) botData.broadcastHistory.pop();
            saveBotData();

            socket.emit('broadcast-result', { totalSent, totalBots: activeBots.length, totalChats });
        });

        socket.on('stop-bot', async ({ sessionId }) => {
            if (!socket.authenticated) return;
            if (state.sessions[sessionId]?.sock) {
                try {
                    await state.sessions[sessionId].sock.logout();
                    state.sessions[sessionId].isConnected = false;
                    delete state.sessions[sessionId];
                    socket.emit('bot-stopped', { sessionId, success: true });
                } catch (e) {
                    socket.emit('bot-stopped', { sessionId, success: false, error: e.message });
                }
            }
        });

        socket.on('stop-all-bots', async () => {
            if (!socket.authenticated) return;
            let stopped = 0;
            for (const session of Object.values(state.sessions)) {
                try {
                    if (session.sock) {
                        await session.sock.logout();
                        session.isConnected = false;
                        stopped++;
                    }
                } catch (e) { }
            }
            socket.emit('all-bots-stopped', { stopped });
        });

        socket.on('get-bots-list', () => {
            if (!socket.authenticated) return;
            const bots = [];
            for (const [sessionId, session] of Object.entries(state.sessions)) {
                if (session.sock?.user) {
                    bots.push({
                        sessionId, phoneNumber: session.phoneNumber,
                        isConnected: session.isConnected,
                        userName: botData.userNames[sessionId] || 'Unknown'
                    });
                }
            }
            socket.emit('bots-list', bots);
        });

        socket.on('get-broadcast-history', () => {
            if (!socket.authenticated) return;
            socket.emit('broadcast-history', botData.broadcastHistory || []);
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of Object.entries(state.userSockets)) {
                if (socketId === socket.id) {
                    delete state.userSockets[userId];
                    break;
                }
            }
        });
    });

    return { app, server, io };
}

module.exports = { setupWebServer };