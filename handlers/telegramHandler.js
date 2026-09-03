const TelegramBot = require('node-telegram-bot-api');
const { botData, saveBotData } = require('../config/database');
const state = require('../config/state');
const settings = require('../settings');
const { isTgOwner, getAllActiveSockets } = require('../utils/helpers');
const BotSession = require('../classes/BotSession');

let tgBot = null;

function initializeTelegram(io) {
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!tgToken) {
        console.error('TELEGRAM_BOT_TOKEN not set!');
        return null;
    }

    tgBot = new TelegramBot(tgToken, {
        polling: { interval: 3000, autoStart: true, params: { timeout: 10 } }
    });

    tgBot.on('polling_error', (error) => {
        console.log('Telegram polling error:', error.message);
        if (error.message?.includes('409') || error.message?.includes('Conflict')) {
            tgBot.stopPolling();
        }
        if (error.message?.includes('401')) {
            tgBot.stopPolling();
        }
    });

    setupTelegramCommands(tgBot, io);
    return tgBot;
}

function setupTelegramCommands(tgBot, io) {
    // /start
    tgBot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const isOwner = isTgOwner(chatId, settings);

        const welcomeMessage =
            `◬━━━〈 *ZESHOO MINI BOT* 〉━━━◬\n\n` +
            `*🌑 LUXURY WHATSAPP AUTOMATION* 🌑\n\n` +
            `Welcome to the most premium WhatsApp bot experience.\n\n` +
            `*📱 AVAILABLE COMMANDS:*\n` +
            `• /start - Open this menu\n` +
            `• /clearsession - Reset your pairing\n` +
            `${isOwner ? `• /status - Bot overall status\n` : ''}` +
            `${isOwner ? `• /follow <link> - Force follow channel\n` : ''}` +
            `\n*🔐 TO CONNECT:*\nSimply send your WhatsApp number with country code.\nExample: \`923271054080\`\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;

        try {
            await tgBot.sendPhoto(chatId, settings.startimage, { caption: welcomeMessage, parse_mode: 'Markdown' });
        } catch (e) {
            await tgBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        }
    });

    // /clearsession
    tgBot.onText(/\/clearsession/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = `tg_${chatId}`;

        if (state.sessions[userId]) {
            try { await state.sessions[userId].sock.logout(); } catch (e) { }
            const authPath = state.sessions[userId].authPath;
            if (require('fs-extra').existsSync(authPath)) {
                require('fs-extra').removeSync(authPath);
            }
            delete state.sessions[userId];
            await tgBot.sendMessage(chatId, `🗑️ *Session cleared!* You can now pair a new number.`, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `⚠️ No active session found.`, { parse_mode: 'Markdown' });
        }
    });

    // /follow - OWNER ONLY
    tgBot.onText(/\/follow (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId, settings)) return;

        const channelLink = match[1].trim();
        const activeSocks = getAllActiveSockets(state.sessions);

        await tgBot.sendMessage(chatId, `🔄 *Initiating Mass Follow...*\nTarget: ${channelLink}\nBots: ${activeSocks.length}`, { parse_mode: 'Markdown' });

        let success = 0;
        for (const { sock } of activeSocks) {
            try {
                const channelKey = channelLink.split('/channel/')[1] || channelLink.split('/').pop();
                const metadata = await sock.newsletterMetadata('invite', channelKey, 'GUEST');
                if (metadata?.id) {
                    await sock.newsletterFollow(metadata.id);
                    success++;
                }
            } catch (e) { }
        }

        await tgBot.sendMessage(chatId, `✅ *Mass Follow Complete!*\nSuccessfully followed: ${success}/${activeSocks.length}`, { parse_mode: 'Markdown' });
    });

    // /status - OWNER ONLY
    tgBot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId, settings)) {
            return tgBot.sendMessage(chatId, "❌ *Owner only command!*", { parse_mode: 'Markdown' });
        }

        const connectedCount = Object.values(state.sessions).filter(s => s.isConnected).length;
        const helpers = require('../utils/helpers');
        const botNumbers = helpers.getConnectedBotNumbers(state.sessions);
        const numbersList = botNumbers.length > 0 ? botNumbers.join('\n') : 'None';

        const statusMsg =
            `◬━━━〈 *ZESHOO MINI STATUS* 〉━━━◬\n\n` +
            `📱 *Connected Bots:* ${connectedCount}\n` +
            `⚡ *Total Sessions:* ${Object.keys(state.sessions).length}\n\n` +
            `🔢 *Active Numbers:*\n\`${numbersList}\`\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;

        await tgBot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    });

    // Premium Management
    tgBot.onText(/\/addpremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId, settings)) return tgBot.sendMessage(chatId, "❌ *Owner only!*", { parse_mode: 'Markdown' });
        const targetId = match[1].trim();
        if (!settings.premiumUsers.includes(targetId)) {
            settings.premiumUsers.push(targetId);
            await tgBot.sendMessage(chatId, `✅ *Premium added:* \`${targetId}\``, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/removepremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId, settings)) return tgBot.sendMessage(chatId, "❌ *Owner only!*", { parse_mode: 'Markdown' });
        const targetId = match[1].trim();
        const idx = settings.premiumUsers.indexOf(targetId);
        if (idx > -1) {
            settings.premiumUsers.splice(idx, 1);
            await tgBot.sendMessage(chatId, `✅ *Premium removed:* \`${targetId}\``, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/listpremium/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId, settings)) return tgBot.sendMessage(chatId, "❌ *Owner only!*", { parse_mode: 'Markdown' });
        const list = settings.premiumUsers.length > 0 ? settings.premiumUsers.join('\n') : 'None';
        await tgBot.sendMessage(chatId, `👑 *Premium Users:*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    // Pairing Handler
    tgBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text || text.startsWith('/')) return;

        if (/^\d+$/.test(text)) {
            const userId = chatId.toString();
            if (!state.sessions[userId]) {
                state.sessions[userId] = new BotSession(userId, io, tgBot);
            }
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = {
                    autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: false
                };
                saveBotData();
            }

            const initMsg =
                `◬━━━〈 *ZESHOO MINI PAIRING* 〉━━━◬\n\n` +
                `*🔄 REQUESTING CODE...*\nTarget Number: \`${text}\`\n\n_Please wait..._`;

            await tgBot.sendMessage(chatId, initMsg, { parse_mode: 'Markdown' });
            state.sessions[userId].tgChatId = chatId;
            await state.sessions[userId].initialize(text);
        }
    });
}

module.exports = { initializeTelegram, tgBot };
