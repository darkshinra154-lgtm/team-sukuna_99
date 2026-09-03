// BotSession.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage, jidNormalizedUser, Browsers, delay } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const settings = require('./settings');
const commands = require('./lib/commandLoader');
const { handleAutoread } = require('./commands/autoread');
const { handleStatusUpdate } = require('./commands/autostatus');
const { storeMessage, handleMessageRevocation, handleSnipe } = require('./commands/antidelete');

const state = require('./lib/state');
const { saveBotData, AUTH_DIR, DATA_FILE } = require('./dataManager');
const { generateMenuText } = require('./lib/menuGenerator');

class BotSession {
    constructor(userId) {
        this.userId = userId;
        this.sock = null;
        this.isConnected = false;
        this.aiEnabled = false; 
        const botData = state.getBotData();
        this.autoReact = botData.statusSettings[userId]?.autoReact || false;
        this.isPublic = botData.statusSettings[userId]?.isPublic !== undefined ? botData.statusSettings[userId].isPublic : true; 
        this.authPath = path.join(AUTH_DIR, userId);
        this.processedMessages = new Set();
        this.activeInterval = null;
        this.isInitializing = false;
        this.userChats = {}; 
        this.lastConnectMessageTime = null;
        this.phoneNumber = null;
        this.ghostMode = false;
    }

    sendLog(message, type = 'info') {
        const logEntry = { timestamp: new Date().toLocaleTimeString(), message, type };
        const socketId = state.userSockets[this.userId];
        const io = state.getIO();
        if (socketId && io) io.to(socketId).emit('console', logEntry);
        console.log(`[${this.userId}] ${message}`);
    }

    sendConnectionStatus() {
        const socketId = state.userSockets[this.userId];
        const io = state.getIO();
        if (socketId && io) io.to(socketId).emit('connection-status', { connected: this.isConnected, user: this.userId });
        if (io) io.emit('total-active', Object.values(state.sessions).filter(s => s.isConnected).length);
    }

    async getAIResponse(userJid, userMessage, systemPrompt = "Helpful assistant.") {
        try {
            const apiUrl = `https://api.siputzx.my.id/api/ai/chatgpt?prompt=${encodeURIComponent(systemPrompt)}&text=${encodeURIComponent(userMessage)}`;
            const response = await axios.get(apiUrl);
            if (response.data && response.data.status) return response.data.data;
            const fallbackUrl = `https://widipe.com/openai?text=${encodeURIComponent(userMessage)}`;
            const fallbackRes = await axios.get(fallbackUrl);
            if (fallbackRes.data && fallbackRes.data.result) return fallbackRes.data.result;
            throw new Error("Invalid API response from all sources");
        } catch (error) { return "\u{274C} AI Error: " + error.message; }
    }

    startActiveCheck() {
        if (this.activeInterval) clearInterval(this.activeInterval);
        this.activeInterval = setInterval(async () => {
            if (this.isConnected && this.sock?.user) {
                try {
                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    await this.sock.sendMessage(botNumber, { text: "ZESHOO \u{1D5D4}\u{1D5E5}\u{1D5D8}-\u{1D5D3}\u{1D5E6}\u{1D601} \u{1D5F1}\u{1D600} \u{1D603}\u{1D608}\u{1D5F1}\u{1D5F1}\u{1D5F2}\u{1D5F7}\u{1D5F2} \u{1F680}\n\n_24/7 Active System Working..._" });
                    this.sendLog("24/7 Keep-alive message sent to own DM. \u{2705}", "success");
                } catch (e) { this.sendLog("Keep-alive failed: " + e.message, "error"); }
            }
        }, 60 * 60 * 1000);
    }

    async initialize(pairingNumber = null) {
        if (this.isInitializing) return;
        this.isInitializing = true;
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state: authState, saveCreds } = await useMultiFileAuthState(this.authPath);

            this.sock = makeWASocket({
                version, auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, P({ level: 'fatal' })) },
                printQRInTerminal: false, logger: P({ level: 'fatal' }), browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false, shouldSyncHistoryMessage: () => false, markOnlineOnConnect: true,
                keepAliveIntervalMs: 30000, connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000,
                emitOwnEvents: true, retryRequestDelayMs: 5000, maxMsgRetryCount: 5, linkPreviewImageThumbnailWidth: 192,
                transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
                getMessage: async (key) => state.messageLogs[key.id] ? { conversation: state.messageLogs[key.id].text } : { conversation: 'Bot is active' },
                patchMessageBeforeSending: (message) => {
                    const requiresPatch = !!(message.buttonsMessage || message.templateMessage || message.listMessage);
                    if (requiresPatch) return { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, ...message } } };
                    return message;
                },
                generateHighQualityLinkPreview: true,
            });

            if (pairingNumber && !authState.creds.registered) {
                if (!this.sock.authState.creds.registered) {
                    await delay(3000);
                    try {
                        let code = await this.sock.requestPairingCode(pairingNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        this.sendLog(`\u{1F511} Pairing Code: ${code}`, 'success');
                        const tgBot = state.getTgBot();
                        if (this.tgChatId && tgBot) await tgBot.sendMessage(this.tgChatId, `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI CODE* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n*\u{1F511} YOUR PAIRING CODE:* \`${code}\`\n\n_Enter this code in your WhatsApp Linked Devices section._\n\n> © POWERED BY ZESHOO MINI BOT v3.0`, { parse_mode: 'Markdown' });
                        const socketId = state.userSockets[this.userId];
                        const io = state.getIO();
                        if (socketId && io) io.to(socketId).emit('pairing-code', code);
                    } catch (err) {
                        this.sendLog(`\u{274C} Pairing error: ${err.message}`, 'error');
                        const tgBot = state.getTgBot();
                        if (this.tgChatId && tgBot) await tgBot.sendMessage(this.tgChatId, "\u{274C} Pairing Error: " + err.message);
                    }
                }
            }

            this.sock.ev.on('creds.update', saveCreds);

            this.sock.ev.on('group-participants.update', async (update) => {
                const { id, participants, action, author } = update;
                const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                if (currentData.groupEvents && currentData.groupEvents[id] === 'on') {
                    for (const participant of participants) {
                        try {
                            const metadata = await this.sock.groupMetadata(id).catch(() => ({ subject: "Group" }));
                            const user = participant.split('@')[0];
                            if (action === 'add') await this.sock.sendMessage(id, { text: currentData.welcomeMessages[id] || `Welcome @${user} to ${metadata.subject}!`, mentions: [participant] });
                            else if (action === 'remove') await this.sock.sendMessage(id, { text: currentData.goodbyeMessages[id] || `Goodbye @${user} from ${metadata.subject}!`, mentions: [participant] });
                        } catch (e) {}
                    }
                }
                if (author) {
                    const botJid = jidNormalizedUser(this.sock.user.id);
                    const authorClean = author.split('@')[0];
                    const botClean = botJid.split('@')[0];
                    const ownerNumbers = String(settings.ownerNumber).split(',').map(n => n.replace(/\D/g, ''));
                    const isOwnerAction = ownerNumbers.includes(authorClean) || authorClean === botClean;
                    if (!isOwnerAction) {
                        try {
                            const metadata = await this.sock.groupMetadata(id);
                            const botIsAdmin = metadata.participants.find(p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin'));
                            if (botIsAdmin) {
                                if (action === 'promote' && currentData.antiPromote && currentData.antiPromote[id] === 'on') {
                                    for (const p of participants) await this.sock.groupParticipantsUpdate(id, [p], 'demote');
                                    await this.sock.sendMessage(id, { text: `🚫 *ANTI-PROMOTE DETECTED*\n\n@${authorClean} tried to promote someone.`, mentions: [author] });
                                    await this.sock.groupParticipantsUpdate(id, [author], 'remove');
                                } else if (action === 'demote' && currentData.antiDemote && currentData.antiDemote[id] === 'on') {
                                    for (const p of participants) await this.sock.groupParticipantsUpdate(id, [p], 'promote');
                                    await this.sock.sendMessage(id, { text: `🚫 *ANTI-DEMOTE DETECTED*\n\n@${authorClean} tried to demote an admin.`, mentions: [author] });
                                    await this.sock.groupParticipantsUpdate(id, [author], 'remove');
                                }
                            }
                        } catch (e) {}
                    }
                }
            });

            this.sock.ev.on('call', async (calls) => {
                const botData = state.getBotData();
                if (botData.antiCall[this.userId]) {
                    for (const call of calls) {
                        if (call.status === 'offer') {
                            try {
                                await this.sock.rejectCall(call.id, call.from);
                                await this.sock.sendMessage(call.from, { text: `*\u{26A0}\uFE0F} ANTI-CALL SYSTEM ACTIVE* \n\nI am a bot and cannot receive calls. \n\n> © POWERED BY ZESHOO MINI BOT` });
                            } catch (e) {}
                        }
                    }
                }
            });

            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;
                await Promise.all(m.messages.map(async (msg) => {
                    if (msg.messageStubType === 1 || msg.messageStubType === 2) this.sendLog('Undecryptable message received.', 'warning');
                    try {
                        const from = msg.key.remoteJid;
                        const isMe = msg.key.fromMe;
                        const isGroup = from.endsWith('@g.us');
                        const isStatus = from === 'status@broadcast';
                        const messageContent = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message?.viewOnceMessageV2?.message || msg.message;
                        if (!messageContent) return;
                        let type = Object.keys(messageContent)[0];
                        const text = (messageContent.conversation || messageContent.extendedTextMessage?.text || messageContent.imageMessage?.caption || messageContent.videoMessage?.caption || '').trim();

                        if (!isMe && !isStatus) { await handleAutoread(this.sock, msg); await storeMessage(msg); handleSnipe(msg); }
                        if (msg.message?.protocolMessage?.type === 0) { await handleMessageRevocation(this.sock, msg); return; }

                        const botData = state.getBotData();
                        
                        if (isGroup && msg.messageStubType) {
                            const stubType = msg.messageStubType;
                            const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                            if (currentData.groupEvents && currentData.groupEvents[from] === 'on') {
                                const metadata = await this.sock.groupMetadata(from).catch(() => ({ subject: "Group" }));
                                const participants = msg.messageStubParameters || [];
                                for (const participant of participants) {
                                    const user = participant.split('@')[0];
                                    if (stubType === 27 || stubType === 31) await this.sock.sendMessage(from, { text: currentData.welcomeMessages[from] || `Welcome @${user} to ${metadata.subject}!`, mentions: [participant] });
                                    else if (stubType === 28 || stubType === 32) await this.sock.sendMessage(from, { text: currentData.goodbyeMessages[from] || `Goodbye @${user} from ${metadata.subject}!`, mentions: [participant] });
                                }
                            }
                        }

                        const msgId = msg.key.id;
                        if (this.processedMessages.has(msgId)) return;
                        this.processedMessages.add(msgId);
                        if (this.processedMessages.size > 1000) this.processedMessages.delete(this.processedMessages.values().next().value);

                        if (!isStatus) {
                            let logEntry = { text, type };
                            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                                try {
                                    const mContent = messageContent[type];
                                    if (mContent && (mContent.directPath || mContent.url)) {
                                        const stream = await downloadContentFromMessage(mContent, type.replace('Message', ''));
                                        let buffer = Buffer.from([]);
                                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                                        logEntry.buffer = buffer;
                                    }
                                } catch (e) {}
                            }
                            logEntry.pushName = msg.pushName || 'User';
                            state.messageLogs[msgId] = logEntry;
                            if (Object.keys(state.messageLogs).length > 2000) delete state.messageLogs[Object.keys(state.messageLogs)[0]];
                        }

                        if (this.autoReact && !isMe && !isStatus) {
                            const emojis = ['\u{2764}\u{FE0F}', '\u{1F44D}', '\u{1F525}', '\u{1F44F}', '\u{1F62E}', '\u{1F602}', '\u{1F64C}', '\u{2728}', '\u{2B50}', '\u{2705}', '\u{1F916}', '\u{26A1}', '\u{1F31F}', '\u{1F4AF}', '\u{1F308}', '\u{1F48E}', '\u{1F451}', '\u{1F389}', '\u{1F9FF}', '\u{1F340}'];
                            try { await this.sock.sendMessage(from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key } }); } catch (e) {}
                        }

                        if (this.aiEnabled && !isMe && !isGroup && text && !text.startsWith(settings.prefix)) {
                            try { await this.sock.sendMessage(from, { text: await this.getAIResponse(from, text) }, { quoted: msg }); } catch (e) {}
                        }

                        if (isStatus && !isMe) { await handleStatusUpdate(this.sock, msg, botData, this.userId); return; }

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
                            } catch (e) { isAdmin = false; }
                        }

                        const isAuthorized = this.isPublic || isOwner || isSessionUser || isMe || isAdmin;

                        // Anti-Status
                        if (isGroup && botData.antiStatusGroups && botData.antiStatusGroups[from]) {
                            const mode = botData.antiStatusGroups[from];
                            const isForwarded = (msg.message?.forwardingScore > 0 || messageContent?.contextInfo?.forwardingScore > 0);
                            const containsStatus = JSON.stringify(msg.message).includes('status@broadcast') || JSON.stringify(msg.message).includes('newsletter');
                            const isViewOnce = !!(messageContent?.viewOnceMessage || messageContent?.viewOnceMessageV2 || messageContent?.viewOnceMessageV2Extension);
                            if ((isForwarded || containsStatus || isViewOnce) && !isMe && !(isAdmin && !isOwner)) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (mode === 'warn') await this.sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, Status sharing is not allowed!`, mentions: [sender] });
                                    else if (mode === 'kick') {
                                        const gMeta = await this.sock.groupMetadata(from);
                                        const botP = gMeta.participants.find(p => p.id === botNumber);
                                        if (botP && (botP.admin === 'admin' || botP.admin === 'superadmin')) {
                                            await this.sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked for sharing status!`, mentions: [sender] });
                                            await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                        }
                                    }
                                    return;
                                } catch (e) {}
                            }
                        }

                        // Anti-Sticker
                        if (isGroup && botData.antiStickerGroups && botData.antiStickerGroups[from] && botData.antiStickerGroups[from] !== false) {
                            const antiStickerMode = botData.antiStickerGroups[from];
                            let isStickerMsg = false;
                            if (msg.message && JSON.stringify(msg.message).includes('stickerMessage')) isStickerMsg = true;
                            if (messageContent && messageContent.stickerMessage) isStickerMsg = true;
                            if (type === 'stickerMessage') isStickerMsg = true;
                            if (msg.message?.ephemeralMessage?.message?.stickerMessage) isStickerMsg = true;
                            if (msg.message?.viewOnceMessage?.message?.stickerMessage) isStickerMsg = true;
                            if (msg.message?.viewOnceMessageV2?.message?.stickerMessage) isStickerMsg = true;

                            if (isStickerMsg && !isMe && !(isAdmin && !isOwner)) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (antiStickerMode === 'warn') await this.sock.sendMessage(from, { text: `⚠️ *ANTI-STICKER ALERT*\n\n@${sender.split('@')[0]} Stickers are NOT allowed!`, mentions: [sender] });
                                    else if (antiStickerMode === 'kick') {
                                        const gMeta = await this.sock.groupMetadata(from);
                                        const botP = gMeta.participants.find(p => p.id === botNumber);
                                        if (botP && (botP.admin === 'admin' || botP.admin === 'superadmin')) {
                                            await this.sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked for sharing sticker!`, mentions: [sender] });
                                            await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                        }
                                    }
                                    return;
                                } catch (e) {}
                            }
                        }

                        // Anti-Media (Voice, Image, Video)
                        if (isGroup && !isMe && (!isAdmin || isOwner)) {
                            let mediaAction = null, mediaType = null, mediaLabel = "";
                            if (botData.antiVoiceGroups && botData.antiVoiceGroups[from] && type === 'audioMessage') { mediaAction = botData.antiVoiceGroups[from]; mediaType = 'voice note'; mediaLabel = 'AntiVoice'; }
                            if (!mediaAction && botData.antiImageGroups && botData.antiImageGroups[from] && type === 'imageMessage') { mediaAction = botData.antiImageGroups[from]; mediaType = 'image'; mediaLabel = 'AntiImage'; }
                            if (!mediaAction && botData.antiVideoGroups && botData.antiVideoGroups[from] && type === 'videoMessage') { mediaAction = botData.antiVideoGroups[from]; mediaType = 'video'; mediaLabel = 'AntiVideo'; }
                            if (mediaAction && mediaAction !== 'false' && !(isAdmin && !isOwner)) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (mediaAction === 'warn') await this.sock.sendMessage(from, { text: `⚠️ *${mediaLabel.toUpperCase()} ALERT*\n\n@${sender.split('@')[0]} ${mediaType.toUpperCase()}S are NOT allowed!`, mentions: [sender] });
                                    else if (mediaAction === 'kick') {
                                        const gMeta = await this.sock.groupMetadata(from);
                                        const botP = gMeta.participants.find(p => p.id === botNumber);
                                        if (botP && (botP.admin === 'admin' || botP.admin === 'superadmin')) {
                                            await this.sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} kicked for sharing ${mediaType}!`, mentions: [sender] });
                                            await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                        }
                                    }
                                    return;
                                } catch (e) {}
                            }
                        }

                        // Antilink
                        if (isGroup && botData.antilinkGroups[from] && !isAdmin) {
                            const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
                            if (linkPatterns.some(pattern => pattern.test(text))) {
                                try {
                                    await this.sock.sendMessage(from, { delete: msg.key });
                                    if (botData.antilinkGroups[from] === 'kick') await this.sock.groupParticipantsUpdate(from, [sender], "remove");
                                } catch (e) {}
                                return;
                            }
                        }

                        if (this.ghostMode && !isOwner && !isSessionUser) return;
                        if (text.toLowerCase().startsWith(settings.prefix)) {
                            if (!this.isPublic && !isAuthorized) return;
                            const args = text.split(' ').slice(1);
                            const q = args.join(' ');
                            const commandName = text.toLowerCase().slice(settings.prefix.length).split(' ')[0];

                            (async () => {
                                try {
                                    switch (commandName) {
                                        case 'menu': {
                                            const customName = botData.userNames[this.userId] || msg.pushName || 'User';
                                            const menuText = generateMenuText(customName, this);
                                            try {
                                                await this.sock.sendMessage(from, { image: { url: settings.startimage }, caption: menuText }, { quoted: msg });
                                                const songPath = path.join(__dirname, 'song.mp3');
                                                if (fs.existsSync(songPath)) await this.sock.sendMessage(from, { audio: fs.readFileSync(songPath), mimetype: 'audio/mpeg', fileName: 'song.mp3', ptt: false }, { quoted: msg });
                                            } catch (e) { await this.sock.sendMessage(from, { text: menuText }, { quoted: msg }); }
                                            break;
                                        }
                                        case 'allmenu': require('./commands/allmenu')(this.sock, from, msg, this, commands); break;
                                        case 'ownermenu': await this.sock.sendMessage(from, { text: `*\u{1F451} OWNER MENU*\n\n\u{25FB} .public\n\u{25FB} .private\n\u{25FB} .block\n\u{25FB} .unblock\n\u{25FB} .restart\n\u{25FB} .shutdown\n\u{25FB} .bcall\n\u{25FB} .bcgc` }, { quoted: msg }); break;
                                        case 'groupmenu': await this.sock.sendMessage(from, { text: `*\u{1F465} GROUP MENU*\n\n\u{25FB} ${settings.prefix}kick\n\u{25FB} ${settings.prefix}add\n\u{25FB} ${settings.prefix}promote\n\u{25FB} ${settings.prefix}demote\n\u{25FB} ${settings.prefix}mute\n\u{25FB} ${settings.prefix}unmute\n\u{25FB} ${settings.prefix}tagall\n\u{25FB} ${settings.prefix}hidetag\n\u{25FB} ${settings.prefix}welcome [on/off]\n\u{25FB} ${settings.prefix}setwelcome [text]\n\u{25FB} ${settings.prefix}goodbye [on/off]\n\u{25FB} ${settings.prefix}setgoodbye [text]\n\u{25FB} ${settings.prefix}antipromote [on/off]\n\u{25FB} ${settings.prefix}antidemote [on/off]\n\u{25FB} ${settings.prefix}grouplink\n\u{25FB} ${settings.prefix}groupinfo\n\u{25FB} ${settings.prefix}antistatus [on/off/warn/kick]\n\u{25FB} ${settings.prefix}antisticker [on/off/warn/kick]\n\u{25FB} ${settings.prefix}antivoice [on/off/warn/kick]\n\u{25FB} ${settings.prefix}antiimage [on/off/warn/kick]\n\u{25FB} ${settings.prefix}antivideo [on/off/warn/kick]` }, { quoted: msg }); break;
                                        case 'downloadmenu': await this.sock.sendMessage(from, { text: `*\u{1F4E5} DOWNLOAD MENU*\n\n\u{25FB} .song\n\u{25FB} .video\n\u{25FB} .insta\n\u{25FB} .tiktok\n\u{25FB} .facebook\n\u{25FB} .youtube\n\u{25FB} .spotify\n\u{25FB} .apk` }, { quoted: msg }); break;
                                        case 'aimenu': await this.sock.sendMessage(from, { text: `*\u{1F916} AI MENU*\n\n\u{25FB} .ai\n\u{25FB} .chatbot\n\u{25FB} .gali` }, { quoted: msg }); break;
                                        case 'bugmenu': await this.sock.sendMessage(from, { text: `*\u{1F41B} BUG MENU*\n\n\u{25FB} .crash\n\u{25FB} .freeze\n\u{25FB} .bug` }, { quoted: msg }); break;
                                        case 'debug': await this.sock.sendMessage(from, { text: `*\u{1F6E0} DEBUG INFO*\n\n*Prefix:* ${settings.prefix}\n*Group Events:* ${botData.groupEvents[from] || 'off'}\n*Welcome Msg:* ${botData.welcomeMessages[from] ? 'Set' : 'Default'}\n*Bot Version:* ${settings.version}` }, { quoted: msg }); break;
                                        case 'testwelcome': if (!isGroup) return this.sock.sendMessage(from, { text: "❌ Groups only." }); await this.sock.sendMessage(from, { text: `*Test Welcome:*\n\n${botData.welcomeMessages[from] || `Welcome @${sender.split('@')[0]}!`}`, mentions: [sender] }); break;
                                        case 'testgoodbye': if (!isGroup) return this.sock.sendMessage(from, { text: "❌ Groups only." }); await this.sock.sendMessage(from, { text: `*Test Goodbye:*\n\n${botData.goodbyeMessages[from] || `Goodbye @${sender.split('@')[0]}!`}`, mentions: [sender] }); break;
                                        
                                        // Media
                                        case 'song': await commands.song(this.sock, from, msg); break;
                                        case 'video': await commands.video(this.sock, from, msg); break;
                                        case 'insta': case 'ig': await commands.insta(this.sock, from, msg, q); break;
                                        case 'tiktok': case 'tt': await commands.tiktok(this.sock, from, msg, q); break;
                                        case 'facebook': case 'fb': await commands.facebook(this.sock, from, msg); break;
                                        case 'youtube': case 'yt': await commands.youtube(this.sock, from, msg, q); break;
                                        case 'pinterest': case 'pin': await commands.pinterest(this.sock, from, msg, q); break;
                                        case 'twitter': case 'x': case 'twit': await commands.twitter(this.sock, from, msg, q); break;
                                        case 'reddit': await commands.reddit(this.sock, from, msg, q); break;
                                        case 'spotify': case 'spot': await commands.spotify(this.sock, from, msg, q); break;
                                        case 'mediafire': case 'mf': await commands.mf(this.sock, from, msg, q); break;
                                        case 'gdrive': await commands.gdrive(this.sock, from, msg, q); break;
                                        case 'apk': await commands.apk(this.sock, from, msg); break;

                                        // Group
                                        case 'kick': await commands.kick(this.sock, from, msg, true); break;
                                        case 'add': await commands.add(this.sock, from, msg, true, q); break;
                                        case 'promote': await commands.promote(this.sock, from, msg, true); break;
                                        case 'demote': await commands.demote(this.sock, from, msg, true); break;
                                        case 'revoke': await commands.revoke(this.sock, from, msg, true); break;
                                        case 'invite': await commands.invite(this.sock, from, msg, true); break;
                                        case 'grouplink': case 'gclink': await commands.grouplink(this.sock, from, msg, true); break;
                                        case 'mute': await commands.mute(this.sock, from, msg, true); break;
                                        case 'unmute': await commands.unmute(this.sock, from, msg, true); break;
                                        case 'join': await commands.join(this.sock, from, msg, q); break;
                                        case 'leave': await commands.leave(this.sock, from, msg, true); break;
                                        case 'setdesc': await commands.setdesc(this.sock, from, msg, true, q); break;
                                        case 'setppgc': await commands.setppgc(this.sock, from, msg, true); break;
                                        case 'getbio': await commands.getbio(this.sock, from, msg, q); break;
                                        case 'getdp': await commands.getdp(this.sock, from, msg, q); break;
                                        case 'tagadmin': await commands.tagadmin(this.sock, from, msg, true); break;
                                        case 'kickoffline': await commands.kickoffline(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'hidetag': await commands.hidetag(this.sock, from, msg, true, q); break;
                                        case 'tagall': await commands.tagall(this.sock, from, msg, true, q); break;
                                        case 'groupinfo': case 'ginfo': await commands.groupinfo(this.sock, from, msg); break;
                                        case 'kickall': await commands.kickall(this.sock, from, msg, true); break;
                                        case 'accept': await commands.accept(this.sock, from, msg, true); break;
                                        case 'poll': await commands.poll(this.sock, from, msg, q); break;
                                        case 'welcome': if (!isGroup || !isAdmin) return; if (q === 'on') { botData.groupEvents[from] = 'on'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Welcome enabled!" }); } else if (q === 'off') { botData.groupEvents[from] = 'off'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Welcome disabled!" }); } break;
                                        case 'setwelcome': if (!isGroup || !isAdmin || !q) return; botData.welcomeMessages[from] = q; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Welcome message updated!" }); break;
                                        case 'goodbye': if (!isGroup || !isAdmin) return; if (q === 'on') { botData.groupEvents[from] = 'on'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Goodbye enabled!" }); } else if (q === 'off') { botData.groupEvents[from] = 'off'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Goodbye disabled!" }); } break;
                                        case 'setgoodbye': if (!isGroup || !isAdmin || !q) return; botData.goodbyeMessages[from] = q; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Goodbye message updated!" }); break;
                                        case 'antipromote': if (!isGroup || !isAdmin) return; if (q === 'on') { botData.antiPromote[from] = 'on'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Anti-Promote enabled!" }); } else if (q === 'off') { botData.antiPromote[from] = 'off'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Anti-Promote disabled!" }); } break;
                                        case 'antidemote': if (!isGroup || !isAdmin) return; if (q === 'on') { botData.antiDemote[from] = 'on'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Anti-Demote enabled!" }); } else if (q === 'off') { botData.antiDemote[from] = 'off'; saveBotData(); await this.sock.sendMessage(from, { text: "✅ Anti-Demote disabled!" }); } break;
                                        case 'everyonemsg': await commands.everyonemsg(this.sock, from, msg, true, q); break;
                                        case 'listonline': await commands.listonline(this.sock, from, msg); break;

                                        // Owner
                                        case 'private': await commands.private(this.sock, from, msg, true, this); botData.statusSettings[this.userId] = { ...(botData.statusSettings[this.userId] || {}), isPublic: false }; saveBotData(); break;
                                        case 'public': await commands.public(this.sock, from, msg, true, this); botData.statusSettings[this.userId] = { ...(botData.statusSettings[this.userId] || {}), isPublic: true }; saveBotData(); break;
                                        case 'owner': await commands.owner(this.sock, from, msg); break;
                                        case 'setname': await commands.setname(this.sock, from, msg, true, botData, saveBotData, this.userId, q); break;
                                        case 'block': await commands.block(this.sock, from, msg, true, q); break;
                                        case 'unblock': await commands.unblock(this.sock, from, msg, true, q); break;
                                        case 'bcgc': await commands.bcgc(this.sock, from, msg, true, q); break;
                                        case 'bcall': await commands.bcall(this.sock, from, msg, true, q); break;
                                        case 'restart': await commands.restart(this.sock, from, msg, true); break;
                                        case 'shutdown': await commands.shutdown(this.sock, from, msg, true); break;
                                        case 'mode': await commands.mode(this.sock, from, msg, true, this); break;
                                        case 'deleteall': await commands.deleteall(this.sock, from, msg, true, q); break;
                                        case 'clone': await commands.clone(this.sock, from, msg, true, q); break;

                                        // Protection
                                        case 'antilink': await commands.antilink(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'anticall': await commands.anticall(this.sock, from, msg, true, botData, saveBotData, this.userId, args); break;
                                        case 'antidelete': await commands.antidelete(this.sock, from, msg, true, botData, saveBotData, this.userId, args); break;
                                        case 'antistatus': await commands.antistatus(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'antisticker': await commands.antisticker(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'antivoice': await commands.antivoice(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'antiimage': await commands.antiimage(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'antivideo': await commands.antivideo(this.sock, from, msg, true, botData, saveBotData, args); break;
                                        case 'antibug': await commands.antibug(this.sock, from, msg, true, botData, saveBotData, args); break;

                                        // Status/Auto
                                        case 'status': case 'autostatus': await commands.autostatus(this.sock, from, msg, true, botData, saveBotData, this.userId, args); break;
                                        case 'autoreacts': await commands.autoreacts(this.sock, from, msg, true, this, args); break;
                                        case 'autoread': await commands.autoread(this.sock, from, msg); break;

                                        // AI
                                        case 'ai': await commands.ai(this.sock, from, msg, true, this, args); break;
                                        case 'chatbot': await commands.chatbot(this.sock, from, msg, this, args); break;
                                        case 'gali': await commands.gali(this.sock, from, msg, this, args); break;

                                        // Fun
                                        case 'joke': await commands.joke(this.sock, from, msg); break;
                                        case 'meme': await commands.meme(this.sock, from, msg); break;
                                        case 'dare': await commands.dare(this.sock, from, msg); break;
                                        case 'truth': await commands.truth(this.sock, from, msg); break;
                                        case 'ascii': await commands.ascii(this.sock, from, msg, q); break;
                                        case 'roast': await commands.roast(this.sock, from, msg); break;
                                        case 'compliment': await commands.compliment(this.sock, from, msg); break;
                                        case 'ship': await commands.ship(this.sock, from, msg); break;
                                        case 'emojimix': await commands.emojimix(this.sock, from, msg); break;
                                        case 'character': await commands.character(this.sock, from, msg); break;
                                        case 'quote': await commands.quote(this.sock, from, msg); break;
                                        case 'fact': await commands.fact(this.sock, from, msg); break;
                                        case 'trivia': await commands.trivia(this.sock, from, msg); break;
                                        case 'coinflip': case 'cf': await commands.coinflip(this.sock, from, msg); break;
                                        case 'roll': await commands.roll(this.sock, from, msg, q); break;
                                        case 'riddle': await commands.riddle(this.sock, from, msg); break;
                                        case 'wyr': case 'wouldyourather': await commands.wouldyourather(this.sock, from, msg); break;

                                        // Tools
                                        case 'ping': await commands.utils.ping(this.sock, from, msg); break;
                                        case 'dp': await commands.dp(this.sock, from, msg); break;
                                        case 'vv': await commands.vv(this.sock, from, msg); break;
                                        case 'translate': case 'trt': await commands.utils.trt(this.sock, from, msg, q); break;
                                        case 'base64': await commands.base64(this.sock, from, msg, q); break;
                                        case 'qr': await commands.qr(this.sock, from, msg, q); break;
                                        case 'shorturl': case 'tinyurl': await commands.utils.short(this.sock, from, msg, q); break;
                                        case 'calc': case 'math': await commands.utils.calc(this.sock, from, msg, q); break;
                                        case 'weather': await commands.utils.weather(this.sock, from, msg, q); break;
                                        case 'github': case 'gh': await commands.utils.github(this.sock, from, msg, q); break;
                                        case 'ipinfo': await commands.utils.ip(this.sock, from, msg, q); break;
                                        case 'tempmail': await commands.tempmail(this.sock, from, msg); break;
                                        case 'fakeinfo': await commands.fakeinfo(this.sock, from, msg); break;
                                        case 'binlookup': await commands.binlookup(this.sock, from, msg, q); break;
                                        case 'whois': await commands.whois(this.sock, from, msg, q); break;
                                        case 'dnslookup': case 'dns': await commands.dnslookup(this.sock, from, msg, q); break;
                                        case 'portscan': case 'scan': await commands.portscan(this.sock, from, msg, q); break;
                                        case 'screenshot': case 'ss': await commands.screenshot(this.sock, from, msg, q); break;
                                        case 'define': case 'dictionary': await commands.utils.dict(this.sock, from, msg, q); break;
                                        case 'google': case 'gsearch': await commands.google(this.sock, from, msg, q); break;
                                        case 'wiki': case 'wikipedia': await commands.utils.wiki(this.sock, from, msg, q); break;
                                        case 'yts': case 'ytsearch': await commands.yts(this.sock, from, msg, q); break;
                                        case 'playstore': case 'ps': await commands.playstore(this.sock, from, msg, q); break;
                                        case 'npm': await commands.npm(this.sock, from, msg, q); break;
                                        case 'sticker': case 's': await commands.sticker(this.sock, from, msg); break;
                                        case 'toimg': case 'img': await commands.toimg(this.sock, from, msg); break;
                                        case 'tomp3': case 'mp3': await commands.tomp3(this.sock, from, msg); break;
                                        case 'tts': await commands.tts(this.sock, from, msg, q); break;
                                        case 'blur': await commands.blur(this.sock, from, msg); break;
                                        case 'invert': await commands.invert(this.sock, from, msg); break;
                                        case 'crop': await commands.crop(this.sock, from, msg); break;
                                        case 'flip': await commands.flip(this.sock, from, msg); break;
                                        case 'grayscale': case 'grey': await commands.grayscale(this.sock, from, msg); break;
                                        case 'removebg': case 'nobg': await commands.removebg(this.sock, from, msg); break;
                                        case 'enlarge': case 'upscale': await commands.enlarge(this.sock, from, msg); break;

                                        // Dangerous
                                        case 'report': await commands.report(this.sock, from, msg, q); break;
                                        case 'spam': await commands.spam(this.sock, from, msg, q); break;
                                        case 'smsbomb': case 'sms': await commands.smsbomb(this.sock, from, msg, q); break;
                                        case 'callbomb': case 'cbomb': await commands.callbomb(this.sock, from, msg, q); break;
                                        case 'crash': await commands.crash(this.sock, from, msg, true, q); break;
                                        case 'freeze': await commands.freeze(this.sock, from, msg, true, q); break;
                                        case 'bug': case 'bugs': await commands.bug(this.sock, from, msg, true, q); break;
                                        case 'xrestart': await commands.xrestart(this.sock, from, msg, true); break;
                                        case 'xshutdown': await commands.xshutdown(this.sock, from, msg, true); break;
                                        case 'ghostmode': case 'ghost': await commands.ghostmode(this.sock, from, msg, true, this, args); break;
                                        case 'nuke': await commands.nuke(this.sock, from, msg, true); break;

                                        // Islamic
                                        case 'quran': await commands.quran(this.sock, from, msg, q); break;
                                        case 'hadith': await commands.hadith(this.sock, from, msg, q); break;
                                        case 'prayer': case 'salah': await commands.prayer(this.sock, from, msg, q); break;
                                        case 'qibla': await commands.qibla(this.sock, from, msg, q); break;
                                        case 'asmaulhusna': case 'asma': await commands.asmaulhusna(this.sock, from, msg, q); break;

                                        // System
                                        case 'uptime': await commands.uptime(this.sock, from, msg); break;
                                        case 'serverinfo': case 'si': await commands.serverinfo(this.sock, from, msg); break;
                                        case 'speedtest': case 'speed': await commands.speedtest(this.sock, from, msg); break;
                                        case 'device': case 'dev': await commands.device(this.sock, from, msg); break;
                                        case 'runtime': case 'rt': await commands.runtime(this.sock, from, msg); break;

                                        // Utilities
                                        case 'timer': await commands.timer(this.sock, from, msg, q); break;
                                        case 'password': case 'pass': await commands.password(this.sock, from, msg, q); break;
                                        case 'morse': await commands.morse(this.sock, from, msg, q); break;
                                        case 'binary': case 'bin': await commands.binary(this.sock, from, msg, q); break;
                                        case 'hex': await commands.hex(this.sock, from, msg, q); break;
                                        case 'pastebin': case 'paste': await commands.pastebin(this.sock, from, msg, q); break;
                                        case 'news': await commands.news(this.sock, from, msg, q); break;
                                        case 'crypto': case 'coin': await commands.crypto(this.sock, from, msg, q); break;
                                        case 'movie': case 'imdb': await commands.movie(this.sock, from, msg, q); break;
                                        case 'anime': await commands.anime(this.sock, from, msg, q); break;
                                        case 'manga': await commands.manga(this.sock, from, msg, q); break;
                                        case 'lyrics': await commands.lyrics(this.sock, from, msg, q); break;
                                        case 'remind': case 'reminder': await commands.remind(this.sock, from, msg, q); break;
                                        case 'tagme': await commands.tagme(this.sock, from, msg); break;
                                        case 'mention': await commands.mention(this.sock, from, msg, q); break;
                                        case 'snipe': await commands.snipe(this.sock, from, msg); break;
                                        case 'editmsg': await commands.editmsg(this.sock, from, msg, q); break;
                                        case 'react': await commands.react(this.sock, from, msg, q); break;
                                        case 'send': await commands.send(this.sock, from, msg, true, q); break;
                                        case 'forward': case 'fwd': await commands.forward(this.sock, from, msg, true, q); break;
                                        case 'clear': await commands.clear(this.sock, from, msg); break;
                                        case 'save': await commands.save(this.sock, from, msg); break;
                                        case 'backup': await commands.backup(this.sock, from, msg, true); break;
                                        case 'restore': await commands.restore(this.sock, from, msg, true); break;
                                        case 'mycmd': case 'mycommands': await commands.mycmd(this.sock, from, msg); break;
                                    }
                                } catch (e) { this.sendLog(`Command error (${commandName}): ` + e.message, 'error'); }
                            })();
                        }
                    } catch (e) { console.error('Message Processing Error:', e); }
                }));
            });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const socketId = state.userSockets[this.userId];
                    const io = state.getIO();
                    if (socketId && io) io.to(socketId).emit('qr', qr);
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    this.isConnected = false;
                    this.isInitializing = false;
                    this.sendLog(`Connection closed. Reconnecting: ${shouldReconnect}`, 'warning');
                    this.sendConnectionStatus();
                    const statusCode = (lastDisconnect.error)?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        this.sendLog('Session expired. Clearing auth...', 'error');
                        try { if (fs.existsSync(this.authPath)) { fs.moveSync(this.authPath, `${this.authPath}_backup_${Date.now()}`); } } catch (e) { if (fs.existsSync(this.authPath)) fs.removeSync(this.authPath); }
                        delete state.sessions[this.userId];
                        this.sendConnectionStatus();
                    } else if (statusCode === DisconnectReason.restartRequired || statusCode === DisconnectReason.connectionLost || statusCode === 428) {
                        setTimeout(() => this.initialize(), 3000);
                    } else if (statusCode === 515) {
                        this.initialize();
                    } else {
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === 'open') {
                    this.isConnected = true;
                    this.isInitializing = false;
                    this.sendLog('Connected successfully! \u{2705}', 'success');
                    this.sendConnectionStatus();
                    this.startActiveCheck();

                    const botNumber = jidNormalizedUser(this.sock.user.id);
                    const botNumberClean = botNumber.split('@')[0];
                    this.phoneNumber = botNumberClean;
                    if (!settings.connectedBots.includes(botNumberClean)) settings.connectedBots.push(botNumberClean);
                    const botName = state.getBotData().userNames[this.userId] || (this.sock.user && this.sock.user.name) || this.userId;

                    const tgBot = state.getTgBot();
                    if (this.tgChatId && tgBot) await tgBot.sendMessage(this.tgChatId, `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n*\u{2705} CONNECTION SUCCESSFUL!* \n\n> © POWERED BY ZESHOO MINI BOT v3.0`, { parse_mode: 'Markdown' });
                    this.sendLog(`Bot ${botName} is online.`, 'success');

                    setTimeout(async () => {
                        try {
                            await this.sock.query({
                                tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'set', xmlns: 'status' },
                                content: [{ tag: 'status', attrs: {}, content: Buffer.from("ZESHOO MINI BOT v3.0 - 120+ Commands | Powered by ZESHOO", 'utf-8') }]
                            });
                        } catch (e) {}
                    }, 5000);

                    if (!this.lastConnectMessageTime || (Date.now() - this.lastConnectMessageTime > 60 * 60 * 1000)) {
                        const welcomeText = `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI BOT* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n*\u{1F311} CONNECTED SUCCESSFULLY* \u{2705}\n\nType *.menu* to explore all features.\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;
                        await this.sock.sendMessage(botNumber, { image: { url: settings.startimage }, caption: welcomeText });
                        try {
                            const channelLink = settings.whatsappChannel;
                            if (channelLink) {
                                const channelKey = channelLink.split('/channel/')[1];
                                if (channelKey) {
                                    const metadata = await this.sock.newsletterMetadata('invite', channelKey, 'GUEST');
                                    if (metadata && metadata.id) await this.sock.newsletterFollow(metadata.id);
                                }
                            }
                        } catch (e) {}
                        this.lastConnectMessageTime = Date.now();
                    }
                }
            });

        } catch (err) {
            this.isInitializing = false;
            this.sendLog(`Initialization failed: ${err.message}. Retrying in 10s...`, 'error');
            setTimeout(() => this.initialize(), 10000);
        }
    }
}

module.exports = BotSession;