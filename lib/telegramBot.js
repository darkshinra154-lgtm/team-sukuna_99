// telegramBot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const settings = require('../settings');
const state = require('./state');
const { isTgOwner, getAllActiveSockets, getConnectedBotNumbers } = require('./utils');
const { saveBotData } = require('../dataManager');

function initTelegramBot(BotSession) {
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!tgToken) {
        console.error('TELEGRAM_BOT_TOKEN not set in environment variables!');
        return null;
    }

    const tgBot = new TelegramBot(tgToken, { 
        polling: { interval: 3000, autoStart: true, params: { timeout: 10 } }
    });
    
    state.setTgBot(tgBot);

    tgBot.on('polling_error', (error) => {
        console.log('Telegram polling error:', error.message);
        if (error.message && (error.message.includes('409') || error.message.includes('Conflict'))) {
            console.log('Another instance detected. Stopping this instance...');
            tgBot.stopPolling();
        }
        if (error.message && error.message.includes('401')) {
            console.log('Telegram Token is invalid (401 Unauthorized).');
            tgBot.stopPolling();
        }
    });

    tgBot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const isOwner = isTgOwner(chatId);
        const welcomeMessage = 
`\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI BOT* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n` +
`*\u{1F311} LUXURY WHATSAPP AUTOMATION* \u{1F311}\n\n` +
`Welcome to the most premium WhatsApp bot experience.\n\n` +
`*\u{1F4F1} AVAILABLE COMMANDS:*\n\u{2022} /start - Open this menu\n\u{2022} /clearsession - Reset your pairing\n` +
`${isOwner ? `\u{2022} /status - Bot overall status\n` : ''}${isOwner ? `\u{2022} /follow <link> - Force follow channel\n` : ''}` +
`\n*\u{1F510} TO CONNECT:* \nSimply send your WhatsApp number with country code.\nExample: \`923271054080\`\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;
        try {
            await tgBot.sendPhoto(chatId, settings.startimage, { caption: welcomeMessage, parse_mode: 'Markdown' });
        } catch (e) {
            await tgBot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/clearsession/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = `tg_${chatId}`;
        if (state.sessions[userId]) {
            if (state.sessions[userId].sock) try { await state.sessions[userId].sock.logout(); } catch(e) {}
            const authPath = state.sessions[userId].authPath;
            if (fs.existsSync(authPath)) fs.removeSync(authPath);
            delete state.sessions[userId];
            await tgBot.sendMessage(chatId, `\u{1F5D1}\u{FE0F} *Session cleared!* You can now pair a new number.`, { parse_mode: 'Markdown' });
        } else {
            await tgBot.sendMessage(chatId, `\u{26A0}\u{FE0F} No active session found to clear.`, { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/follow (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return;
        const channelLink = match[1].trim();
        const activeSocks = getAllActiveSockets();
        await tgBot.sendMessage(chatId, `\u{1F504} *Initiating Mass Follow...*\nTarget: ${channelLink}\nBots: ${activeSocks.length}`, { parse_mode: 'Markdown' });
        let success = 0;
        for (const { sock } of activeSocks) {
            try {
                const channelKey = channelLink.split('/channel/')[1] || channelLink.split('/').pop();
                const metadata = await sock.newsletterMetadata('invite', channelKey, 'GUEST');
                if (metadata && metadata.id) { await sock.newsletterFollow(metadata.id); success++; }
            } catch (e) {}
        }
        await tgBot.sendMessage(chatId, `\u{2705} *Mass Follow Complete!*\nSuccessfully followed: ${success}/${activeSocks.length}`, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        const connectedCount = Object.values(state.sessions).filter(s => s.isConnected).length;
        const numbers = getConnectedBotNumbers();
        const numbersList = numbers.length > 0 ? numbers.join('\n') : 'None';
        const statusMsg = `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI STATUS* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n\u{1F4F1} *Connected Bots:* ${connectedCount}\n\u{26A1} *Total Sessions:* ${Object.keys(state.sessions).length}\n\n\u{1F522} *Active Numbers:*\n\`${numbersList}\`\n\n> © POWERED BY ZESHOO MINI BOT v3.0`;
        await tgBot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/addpremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        const targetId = match[1].trim();
        if (!settings.premiumUsers.includes(targetId)) {
            settings.premiumUsers.push(targetId);
            await tgBot.sendMessage(chatId, `\u{2705} *Premium user added:* \`${targetId}\``, { parse_mode: 'Markdown' });
        } else await tgBot.sendMessage(chatId, `\u{26A0}\u{FE0F} User already premium: \`${targetId}\``, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/removepremium (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        const targetId = match[1].trim();
        const idx = settings.premiumUsers.indexOf(targetId);
        if (idx > -1) {
            settings.premiumUsers.splice(idx, 1);
            await tgBot.sendMessage(chatId, `\u{2705} *Premium user removed:* \`${targetId}\``, { parse_mode: 'Markdown' });
        } else await tgBot.sendMessage(chatId, `\u{26A0}\u{FE0F} User not found in premium list: \`${targetId}\``, { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/listpremium/, async (msg) => {
        const chatId = msg.chat.id;
        if (!isTgOwner(chatId)) return tgBot.sendMessage(chatId, "\u{274C} *Owner only command!*", { parse_mode: 'Markdown' });
        const list = settings.premiumUsers.length > 0 ? settings.premiumUsers.join('\n') : 'None';
        await tgBot.sendMessage(chatId, `\u{1F451} *Premium Users:*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    tgBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text || text.startsWith('/')) return;
        if (/^\d+$/.test(text)) {
            const userId = chatId.toString();
            if (!state.sessions[userId]) state.sessions[userId] = new BotSession(userId);
            const botData = state.getBotData();
            if (!botData.statusSettings[userId]) {
                botData.statusSettings[userId] = { autoStatus: false, autoSeen: false, autoLike: false, autoDownload: false, isPublic: false };
                saveBotData();
            }
            const initMsg = `\u{25EC}\u{2501}\u{2501}\u{2501}\u{3008} *ZESHOO MINI PAIRING* \u{3009}\u{2501}\u{2501}\u{2501}\u{25EC}\n\n*\u{1F504} REQUESTING CODE...*\nTarget Number: \`${text}\`\n\n_Please wait a few seconds..._`;
            await tgBot.sendMessage(chatId, initMsg, { parse_mode: 'Markdown' });
            state.sessions[userId].tgChatId = chatId;
            await state.sessions[userId].initialize(text);
        }
    });

    return tgBot;
}

module.exports = { initTelegramBot };