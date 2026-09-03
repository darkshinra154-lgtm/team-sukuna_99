import { jidNormalizedUser } from '@whiskeysockets/baileys';

export function getConnectedBotNumbers(sessions) {
const numbers = [];
for (const session of Object.values(sessions)) {
if (session.sock?.user) {
numbers.push(jidNormalizedUser(session.sock.user.id).split('@')[0]);
}
}
return numbers;
}

export function getAllActiveSockets(sessions) {
const socks = [];
for (const [sessionId, session] of Object.entries(sessions)) {
if (session.sock && session.isConnected) {
socks.push({ sock: session.sock, sessionId, phoneNumber: session.phoneNumber });
}
}
return socks;
}

export function isPremiumUser(chatId, settings) {
const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
return chatId.toString() === ownerChatId ||
(settings.premiumUsers && settings.premiumUsers.includes(chatId.toString()));
}

export function isTgOwner(chatId, settings) {
const ownerChatId = process.env.OWNER_TELEGRAM_ID || settings.tgOwnerId;
return chatId.toString() === ownerChatId;
}