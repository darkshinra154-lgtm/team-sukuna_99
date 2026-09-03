import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { botData, saveBotData } from '../config/database.js';
import settings from '../settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic imports for commands (ESM style)
const commands = {
// Group Management
getdp: (await import('../commands/getdp.js')).default,

// Admin/Owner
private: (await import('../commands/private.js')).default,
public: (await import('../commands/public.js')).default,
bcgc: (await import('../commands/bcgc.js')).default,
bcall: (await import('../commands/bcall.js')).default,
mode: (await import('../commands/mode.js')).default,

// Protection
antidelete: (await import('../commands/antidelete.js')).default,

// Status/Auto
status: (await import('../commands/status.js')).default,
autoread: (await import('../commands/autoread.js')).autoreadCommand,

// AI
ai: (await import('../commands/ai.js')).default,

// Tools
dp: (await import('../commands/dp.js')).default,
tempmail: (await import('../commands/tempmail.js')).default,
npm: (await import('../commands/npm.js')).default,

// Dangerous
spam: (await import('../commands/spam.js')).default,
smsbomb: (await import('../commands/smsbomb.js')).default,
callbomb: (await import('../commands/callbomb.js')).default,
crash: (await import('../commands/crash.js')).default,
lag: (await import('../commands/lag.js')).default,
bug: (await import('../commands/bug.js')).default,
locspam: (await import('../commands/locspam.js')).default,
vcardspam: (await import('../commands/vcardspam.js')).default,
buttonspam: (await import('../commands/buttonspam.js')).default,
pollspam: (await import('../commands/pollspam.js')).default,
contactspam: (await import('../commands/contactspam.js')).default,
xrestart: (await import('../commands/xrestart.js')).default,
xshutdown: (await import('../commands/xshutdown.js')).default,
ghostmode: (await import('../commands/ghostmode.js')).default,
antibug: (await import('../commands/antibug.js')).default,

// System
report: (await import('../commands/report.js')).default,

// Other
chatbot: (await import('../commands/chatbot.js')).default,
snipe: (await import('../commands/snipe.js')).default,
editmsg: (await import('../commands/editmsg.js')).default,
send: (await import('../commands/send.js')).default,
get: (sock, from, msg) => sock.sendMessage(from, { text: "❌ 'get' not implemented." }, { quoted: msg }),
everyonemsg: (await import('../commands/everyonemsg.js')).default
};

export async function handleCommand(session, sock, from, msg, text, commandName, args, q, isAdmin, isOwner, isGroup, sender) {
try {
switch (commandName) {
// Group
case 'everyonemsg': await commands.everyonemsg(sock, from, msg, true, q); break;

// Admin/Owner
case 'private':
await commands.private(sock, from, msg, true, session);
botData.statusSettings[session.userId] = { ...botData.statusSettings[session.userId], isPublic: false };
saveBotData();
break;
case 'public':
await commands.public(sock, from, msg, true, session);
botData.statusSettings[session.userId] = { ...botData.statusSettings[session.userId], isPublic: true };
saveBotData();
break;
case 'bcgc': await commands.bcgc(sock, from, msg, true, q); break;
case 'bcall': await commands.bcall(sock, from, msg, true, q); break;
case 'mode': await commands.mode(sock, from, msg, true, session); break;

// Protection
case 'antidelete': await commands.antidelete(sock, from, msg, true, botData, saveBotData, session.userId, args); break;
case 'antistatus': await commands.antistatus(sock, from, msg, true, botData, saveBotData, args); break;
case 'antibug': await commands.antibug(sock, from, msg, true, botData, saveBotData, args); break;

// Status
case 'status':
case 'autostatus': await commands.status(sock, from, msg, true, botData, saveBotData, session.userId, args); break;
case 'autoread': await commands.autoread(sock, from, msg); break;

// AI
case 'ai': await commands.ai(sock, from, msg, true, session, args); break;
case 'chatbot': await commands.chatbot(sock, from, msg, session, args); break;

// Tools
case 'dp': await commands.dp(sock, from, msg); break;
case 'tempmail': await commands.tempmail(sock, from, msg); break;
case 'npm': await commands.npm(sock, from, msg, q); break;

// Dangerous
case 'report': await commands.report(sock, from, msg, q); break;
case 'spam': await commands.spam(sock, from, msg, q); break;
case 'smsbomb': case 'sms': await commands.smsbomb(sock, from, msg, q); break;
case 'callbomb': case 'cbomb': await commands.callbomb(sock, from, msg, q); break;
case 'crash': await commands.crash(sock, from, msg, true, q); break;
case 'bug': case 'bugs': await commands.bug(sock, from, msg, true, q); break;
case 'xrestart': await commands.xrestart(sock, from, msg, true); break;
case 'xshutdown': await commands.xshutdown(sock, from, msg, true); break;
case 'ghostmode': case 'ghost': await commands.ghostmode(sock, from, msg, true, session, args); break;

// System
case 'serverinfo': case 'si': await commands.serverinfo(sock, from, msg); break;
// Utilities
case 'snipe': await commands.snipe(sock, from, msg); break;
case 'editmsg': await commands.editmsg(sock, from, msg, q); break;
case 'send': await commands.send(sock, from, msg, true, q); break;

default:
console.log(`Unknown command: ${commandName}`);
}
} catch (e) {
session.sendLog(`Command error (${commandName}): ` + e.message, 'error');
}
}

export { commands };