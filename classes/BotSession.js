const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const P = require('pino');
const {
    default: makeWASocket, useMultiFileAuthState, DisconnectReason,
    fetchLatestBaileysVersion, makeCacheableSignalKeyStore,
    downloadContentFromMessage, jidNormalizedUser, Browsers, delay
} = require('@whiskeysockets/baileys');

const state = require('../config/state');
const { botData, saveBotData, AUTH_DIR } = require('../config/database');
const settings = require('../settings');
const { handleAutoread } = require('../commands/autoread');
const { handleStatusUpdate } = require('../commands/autostatus');
const { storeMessage, handleMessageRevocation, handleSnipe } = require('../commands/antidelete');
const { handleGroupParticipantsUpdate, handleStubGroupEvent } = require('../features/groupEvents');
const { checkAntiSticker, checkAntiMedia, checkAntiLink, checkAntiStatus } = require('../features/antiFunctions');
const { handleCommand, commands } = require('../handlers/commandHandler');

class BotSession {
    constructor(userId, io, tgBot) {
        this.userId = userId;
        this.io = io;
        this.tgBot = tgBot;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false;
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic !== undefined ? botData.statusSettings[userId].isPublic : true;
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.phoneNumber = null;
        this.ghostMode = false;
        this.tgChatId = null;
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = state.userSockets[this.userId];
        if (socketId) this.io.to(socketId).emit('console', logEntry);
        console.log(`[${this.userId}] ${message}`);
    }

    sendConnectionStatus() {
        const socketId = state.userSockets[this.userId];
        if (socketId) {
            this.io.to(socketId).emit('connection-status', { connected: this.isConnected, user: this.userId });
        }
        this.io.emit('total-active', Object.values(state.sessions).filter(s => s.isConnected).length);
    }

    async getAIResponse(userJid, userMessage, systemPrompt = "Helpful assistant.") {
        try {
            const apiUrl = `https://api.siputzx.my.id/api/ai/chatgpt?prompt=${encodeURIComponent(systemPrompt)}&text=${encodeURIComponent(userMessage)}`;
            const response = await axios.get(apiUrl);
            if (response.data?.status) return response.data.data;

            const fallbackRes = await axios.get(`https://widipe.com/openai?text=${encodeURIComponent(userMessage)}`);
            if (fallbackRes.data?.result) return fallbackRes.data.result;
            throw new Error("Invalid API response");
        } catch (error) {
            return "❌ AI Error: " + error.message;
        }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, {
                        text: "ZESHOO 𝐀𝐫𝐞-𝐁𝐨𝐭 𝐬𝐲𝐬𝐭𝐞𝐦 𝐚𝐜𝐭𝐢𝐯𝐞 🚀\n\n_24/7 Active System Working..._"
                    });
                    this.sendLog("24/7 Keep-alive sent ✅", "success");
                } catch (e) {
                    this.sendLog("Keep-alive failed: " + e.message, "error");
                }
            }
        }, 60 * 60 * 1000);
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) {
            this.sendLog("Initialization already in progress...", "info");
            return;
        }
        this.isInitializing = true;

        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state: authState, saveCreds } = await useMultiFileAuthState(this.authPath);

            this.sock = makeWASocket({
                version,
                auth: {
                    creds: authState.creds,
                    keys: makeCacheableSignalKeyStore(authState.keys, P({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: P({ level: 'fatal' }),
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true,
                retryRequestDelayMs: 5000,
                maxMsgRetryCount: 5,
                linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => {
                    if (state.messageLogs[key.id]) return { conversation: state.messageLogs[key.id].text };
                    return { conversation: 'Bot is active' };
                },
                patchMessageBeforeSending: (message) => {
                    const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
                    if (requiresPatch) {
                        return {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                                    ...message
                                }
                            }
                        };
                    }
                    return message;
                },
                generateHighQualityLinkPreview: true,
            });

            // Pairing
            if (pairingNumber && !authState.creds.registered) {
                await delay(3000);
                try {
                    let code = await this.sock.requestPairingCode(pairingNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    this.sendLog(`🔑 Pairing Code: ${code}`, 'success');

                    if (this.tgChatId && this.tgBot) {
                        const codeMsg =
                            `◬━━━〈 *ZESHOO MINI CODE* 〉━━━◬\n\n` +
                            `*🔑 YOUR PAIRING CODE:* \`${code}\`\n\n_Enter this code in WhatsApp Linked Devices._\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;
                        await this.tgBot.sendMessage(this.tgChatId, codeMsg, { parse_mode: 'Markdown' });
                    }

                    const socketId = state.userSockets[this.userId];
                    if (socketId) this.io.to(socketId).emit('pairing-code', code);
                } catch (err) {
                    this.sendLog(`❌ Pairing error: ${err.message}`, 'error');
                }
            }

            this.sock.ev.on('creds.update', saveCreds);
            this.setupEventHandlers();
        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Initialization failed: ${err.message}. Retrying in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }

    setupEventHandlers() {
        // Group Participants (Welcome/Goodbye/Anti-Promote)
        this.sock.ev.on('group-participants.update', (update) =>
            handleGroupParticipantsUpdate(this.sock, update, this.userId));

        // Calls
        this.sock.ev.on('call', async (calls) => {
            if (botData.antiCall[this.userId]) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        try {
                            await this.sock.rejectCall(call.id, call.from);
                            await this.sock.sendMessage(call.from, {
                                text: `*⚠️ ANTI-CALL SYSTEM ACTIVE*\n\nI cannot receive calls.\nPlease send text.\n\n> © ZESHOO MINI BOT`
                            });
                        } catch (e) { }
                    }
                }
            }
        });

        // Messages
        this.sock.ev.on('messages.upsert', (m) => this.handleMessages(m));

        // Connection
        this.sock.ev.on('connection.update', (update) => this.handleConnection(update));
    }

    async handleMessages(m) {
        if (m.type !== 'notify') return;

        await Promise.all(m.messages.map(async (msg) => {
            if (msg.messageStubType === 1 || msg.messageStubType === 2) {
                this.sendLog('Undecryptable message received.', 'warning');
            }

            try {
                const from = msg.key.remoteJid;
                const isMe = msg.key.fromMe;
                const isGroup = from.endsWith('@g.us');
                const isStatus = from === 'status@broadcast';

                const messageContent = msg.message?.ephemeralMessage?.message ||
                    msg.message?.viewOnceMessage?.message ||
                    msg.message?.viewOnceMessageV2?.message ||
                    msg.message;
                if (!messageContent) return;

                let type = Object.keys(messageContent)[0];
                const text = (messageContent.conversation || messageContent.extendedTextMessage?.text ||
                    messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();

                // Snipe & AutoRead
                if (!isMe && !isStatus) {
                    await handleAutoread(this.sock, msg);
                    await storeMessage(msg);
                    handleSnipe(msg);
                }

                if (msg.message?.protocolMessage?.type === 0) {
                    await handleMessageRevocation(this.sock, msg);
                    return;
                }

                // Stub Group Events
                if (isGroup && msg.messageStubType) {
                    await handleStubGroupEvent(this.sock, msg, from);
                }

                const msgId = msg.key.id;
                if (this.processedMessages.has(msgId)) return;
                this.processedMessages.add(msgId);
                if (this.processedMessages.size > 1000) this.processedMessages.delete(this.processedMessages.values().next().value);

                // Log message
                if (!isStatus) {
                    let logEntry = { text, type, pushName: msg.pushName || 'User' };
                    state.messageLogs[msgId] = logEntry;
                    if (Object.keys(state.messageLogs).length > 2000) {
                        delete state.messageLogs[Object.keys(state.messageLogs)[0]];
                    }
                }

                // Auto-react
                if (this.autoReact && !isMe && !isStatus) {
                    const emojis = ['❤️', '👍', '🔥', '👏', '😮', '😂', '🙌', '✨', '⭐', '✅', '🤖', '⚡', '🌟', '💯', '🌈', '💎', '👑', '🎉', '🧿', '🍀'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    try {
                        await this.sock.sendMessage(from, { react: { text: randomEmoji, key: msg.key } });
                    } catch (e) { }
                }

                // AI auto-reply
                if (this.aiEnabled && !isMe && !isGroup && text && !text.startsWith(settings.prefix)) {
                    try {
                        const aiResponse = await this.getAIResponse(from, text);
                        await this.sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
                    } catch (e) { }
                }

                // Status
                if (isStatus && !isMe) {
                    await handleStatusUpdate(this.sock, msg, botData, this.userId);
                    return;
                }

                // Authorization
                const botNumber = jidNormalizedUser(this.sock.user.id);
                const botNumberClean = botNumber.split('@')[0];
                const sender = msg.key.participant || from;
                const senderClean = sender.split('@')[0];

                const ownerNumbers = String(settings.ownerNumber).split(',').map(n => n.replace(/\D/g, ''));
                const isOwner = isMe || ownerNumbers.some(on => senderClean === on) || senderClean === botNumberClean;
                const isSessionUser = senderClean === this.phoneNumber || senderClean === this.userId || senderClean === botNumberClean;

                let isAdmin = isOwner;
                if (!isAdmin && isGroup) {
                    try {
                        const groupMetadata = await this.sock.groupMetadata(from);
                        const participant = groupMetadata.participants.find(p => p.id === sender);
                        isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
                    } catch (e) {
                        isAdmin = false;
                    }
                }

                const isAuthorized = this.isPublic || isOwner || isSessionUser || isMe || isAdmin;

                // === ANTI FUNCTIONS ===
                if (await checkAntiStatus(this.sock, msg, from, sender, messageContent, isMe, isAdmin, isOwner, this.sendLog.bind(this))) return;
                if (await checkAntiSticker(this.sock, msg, from, sender, messageContent, type, isMe, isAdmin, isOwner, this.sendLog.bind(this))) return;
                if (await checkAntiMedia(this.sock, msg, from, sender, type, isMe, isAdmin, isOwner, this.sendLog.bind(this))) return;
                if (await checkAntiLink(this.sock, msg, from, sender, text, isMe, isAdmin, this.sendLog.bind(this))) return;

                // Ghost Mode
                if (this.ghostMode && !isOwner && !isSessionUser) return;

                // Process Commands
                if (text.toLowerCase().startsWith(settings.prefix)) {
                    if (!this.isPublic && !isAuthorized) return;
                    const cmd = text.toLowerCase();
                    const args = text.split(' ').slice(1);
                    const q = args.join(' ');
                    const commandName = cmd.slice(settings.prefix.length).split(' ')[0];

                    await handleCommand(this, this.sock, from, msg, text, commandName, args, q, isAdmin, isOwner, isGroup, sender);
                }
            } catch (e) {
                console.error('Message Processing Error:', e);
            }
        }));
    }

    async handleConnection(update) {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            const socketId = state.userSockets[this.userId];
            if (socketId) this.io.to(socketId).emit('qr', qr);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            this.isConnected = false;
            this.isInitializing = false;
            this.sendLog(`Connection closed. Reconnecting: ${shouldReconnect}`, 'warning');
            this.sendConnectionStatus();

            const statusCode = lastDisconnect.error?.output?.statusCode;

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                this.sendLog('Session expired. Clearing auth data...', 'error');
                try {
                    if (fs.existsSync(this.authPath)) {
                        const backupPath = `${this.authPath}_backup_${Date.now()}`;
                        fs.moveSync(this.authPath, backupPath);
                    }
                } catch (e) {
                    if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath);
                }
                delete state.sessions[this.userId];
                this.sendConnectionStatus();
            } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                this.sendLog(`Connection issue (${statusCode}). Restarting in 3s...`, 'warning');
                setTimeout(() => this.initialize(), 3000);
            } else if (statusCode === 515) {
                this.sendLog('Stream error. Reconnecting...', 'warning');
                this.initialize();
            } else {
                this.sendLog(`Connection closed (${statusCode}). Reconnecting in 5s...`, 'info');
                setTimeout(() => this.initialize(), 5000);
            }
        } else if (connection === 'open') {
            this.isConnected = true;
            this.isInitializing = false;
            this.sendLog('Connected successfully! ✅', 'success');
            this.sendConnectionStatus();
            this.startActiveCheck();

            const botNumber = jidNormalizedUser(this.sock.user.id);
            const botNumberClean = botNumber.split('@')[0];
            this.phoneNumber = botNumberClean;

            if (!settings.connectedBots.includes(botNumberClean)) {
                settings.connectedBots.push(botNumberClean);
            }

            const botName = botData.userNames[this.userId] || this.sock.user?.name || this.userId;

            if (this.tgChatId && this.tgBot) {
                const successMsg =
                    `◬━━━〈 *ZESHOO MINI* 〉━━━◬\n\n` +
                    `*✅ CONNECTION SUCCESSFUL!*\n\nYour WhatsApp has been linked.\n\n> © ZESHOO MINI BOT v3.0`;
                await this.tgBot.sendMessage(this.tgChatId, successMsg, { parse_mode: 'Markdown' });
            }

            this.sendLog(`Bot ${botName} is online.`, 'success');

            // Update Bio
            setTimeout(async () => {
                try {
                    await this.sock.query({
                        tag: 'iq',
                        attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                        content: [{ tag: 'status', attrs: {}, content: Buffer.from("ZESHOO MINI BOT v3.0 - 120+ Commands", 'utf-8') }]
                    });
                    this.sendLog("Bio updated! ✅", "success");
                } catch (e) {
                    this.sendLog("Bio update failed: " + e.message, "error");
                }
            }, 5000);

            // Welcome Message
            if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                const welcomeText =
                    `◬━━━〈 *ZESHOO MINI BOT* 〉━━━◬\n\n` +
                    `*🌑 CONNECTED SUCCESSFULLY* ✅\n\n` +
                    `Your WhatsApp linked to automation system.\n\n` +
                    `*📱 BOT INFO:*\n` +
                    `• *User:* ${botName}\n` +
                    `• *Status:* 24/7 Active\n` +
                    `• *Commands:* 150+ Advanced Tools\n\n` +
                    `Type *.menu* to explore.\n\n> © ZESHOO MINI BOT v3.0`;

                await this.sock.sendMessage(botNumber, {
                    image: { url: settings.startimage },
                    caption: welcomeText
                });

                // Auto follow channel
                try {
                    const channelLink = settings.whatsappChannel;
                    if (channelLink) {
                        const channelKey = channelLink.split('/channel/')[1];
                        if (channelKey) {
                            const metadata = await this.sock.newsletterMetadata('invite', channelKey, 'GUEST');
                            if (metadata?.id) {
                                await this.sock.newsletterFollow(metadata.id);
                            }
                        }
                    }
                } catch (e) { }
                this.lastConnectMessageTime = Date.now();
            }
        }
    }
}

module.exports = BotSession;