const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { botData, saveBotData } = require('../config/database');
const settings = require('../settings');

async function checkAntiSticker(sock, msg, from, sender, messageContent, type, isMe, isAdmin, isOwner, sendLog) {
    if (!isGroup(from) || !botData.antiStickerGroups?.[from] || botData.antiStickerGroups[from] === false) return false;

    const antiStickerMode = botData.antiStickerGroups[from];
    let isStickerMsg = false;

    // طرق اكتشاف الملصق
    if (msg.message && JSON.stringify(msg.message).includes('stickerMessage')) isStickerMsg = true;
    if (messageContent?.stickerMessage) isStickerMsg = true;
    if (type === 'stickerMessage') isStickerMsg = true;
    if (msg.message?.ephemeralMessage?.message?.stickerMessage) isStickerMsg = true;
    if (msg.message?.viewOnceMessage?.message?.stickerMessage) isStickerMsg = true;
    if (msg.message?.viewOnceMessageV2?.message?.stickerMessage) isStickerMsg = true;

    if (isStickerMsg && !isMe) {
        sendLog(`[AntiSticker] Sticker detected in ${from} from ${sender} | Mode: ${antiStickerMode}`, 'info');

        if (isAdmin && !isOwner) return true; // Admin exempt

        try {
            await sock.sendMessage(from, { delete: msg.key });
            
            if (antiStickerMode === 'warn') {
                await sock.sendMessage(from, {
                    text: `⚠️ *ANTI-STICKER ALERT*\n\n@${sender.split('@')[0]} Stickers NOT allowed!\n_Next time you will be kicked._`,
                    mentions: [sender]
                });
            } else if (antiStickerMode === 'kick') {
                const gMeta = await sock.groupMetadata(from);
                const botJid = jidNormalizedUser(sock.user.id);
                const botIsAdmin = gMeta.participants.find(p => p.id === botJid);
                
                if (botIsAdmin && (botIsAdmin.admin === 'admin' || botIsAdmin.admin === 'superadmin')) {
                    await sock.sendMessage(from, {
                        text: `🚫 *ANTI-STICKER - KICKED*\n\n@${sender.split('@')[0]} has been kicked!`,
                        mentions: [sender]
                    });
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                }
            }
        } catch (e) {
            sendLog(`[AntiSticker] Error: ${e.message}`, 'error');
        }
        return true;
    }
    return false;
}

async function checkAntiMedia(sock, msg, from, sender, type, isMe, isAdmin, isOwner, sendLog) {
    if (!isGroup(from) || isMe || (isAdmin && !isOwner)) return false;

    let mediaAction = null, mediaType = null, mediaLabel = "";

    if (botData.antiVoiceGroups?.[from] && type === 'audioMessage') {
        mediaAction = botData.antiVoiceGroups[from]; mediaType = 'voice note'; mediaLabel = 'AntiVoice';
    } else if (botData.antiImageGroups?.[from] && type === 'imageMessage') {
        mediaAction = botData.antiImageGroups[from]; mediaType = 'image'; mediaLabel = 'AntiImage';
    } else if (botData.antiVideoGroups?.[from] && type === 'videoMessage') {
        mediaAction = botData.antiVideoGroups[from]; mediaType = 'video'; mediaLabel = 'AntiVideo';
    }

    if (mediaAction && mediaAction !== 'false') {
        try {
            sendLog(`[${mediaLabel}] ${mediaType} detected | Mode: ${mediaAction}`, 'info');
            await sock.sendMessage(from, { delete: msg.key });

            if (mediaAction === 'warn') {
                await sock.sendMessage(from, {
                    text: `⚠️ *${mediaLabel.toUpperCase()} ALERT*\n\n@${sender.split('@')[0]} ${mediaType.toUpperCase()}S NOT allowed!\n_Next time kicked._`,
                    mentions: [sender]
                });
            } else if (mediaAction === 'kick') {
                const gMeta = await sock.groupMetadata(from);
                const botJid = jidNormalizedUser(sock.user.id);
                const botIsAdmin = gMeta.participants.find(p => p.id === botJid);

                if (botIsAdmin && (botIsAdmin.admin === 'admin' || botIsAdmin.admin === 'superadmin')) {
                    await sock.sendMessage(from, {
                        text: `🚫 *${mediaLabel.toUpperCase()} - KICKED*\n\n@${sender.split('@')[0]} has been kicked!`,
                        mentions: [sender]
                    });
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                } else {
                    await sock.sendMessage(from, {
                        text: `⚠️ @${sender.split('@')[0]} shared ${mediaType}! I need admin role.`,
                        mentions: [sender]
                    });
                }
            }
            return true;
        } catch (e) {
            sendLog(`[${mediaLabel}] Error: ${e.message}`, 'error');
        }
    }
    return false;
}

async function checkAntiLink(sock, msg, from, sender, text, isMe, isAdmin, sendLog) {
    if (!isGroup(from) || !botData.antilinkGroups?.[from] || isAdmin || isMe) return false;

    const linkPatterns = [/chat.whatsapp.com\//i, /http:\/\//i, /https:\/\//i, /www\./i, /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i];
    if (linkPatterns.some(pattern => pattern.test(text))) {
        try {
            const mode = botData.antilinkGroups[from];
            await sock.sendMessage(from, { delete: msg.key });
            if (mode === 'kick') await sock.groupParticipantsUpdate(from, [sender], "remove");
            sendLog(`[AntiLink] Link deleted from ${sender}`, 'info');
            return true;
        } catch (e) {
            sendLog(`[AntiLink] Error: ${e.message}`, 'error');
        }
    }
    return false;
}

async function checkAntiStatus(sock, msg, from, sender, messageContent, isMe, isAdmin, isOwner, sendLog) {
    if (!isGroup(from) || !botData.antiStatusGroups?.[from]) return false;

    const mode = botData.antiStatusGroups[from];
    const isForwarded = (msg.message?.forwardingScore > 0 || messageContent?.contextInfo?.forwardingScore > 0);
    const containsStatus = JSON.stringify(msg.message).includes('status@broadcast');
    const isViewOnce = !!(messageContent?.viewOnceMessage || messageContent?.viewOnceMessageV2);

    if ((isForwarded || containsStatus || isViewOnce) && !isMe) {
        if (isAdmin && !isOwner) return false;

        try {
            await sock.sendMessage(from, { delete: msg.key });
            if (mode === 'warn') {
                await sock.sendMessage(from, {
                    text: `⚠️ @${sender.split('@')[0]}, Status sharing NOT allowed!`,
                    mentions: [sender]
                });
            } else if (mode === 'kick') {
                const gMeta = await sock.groupMetadata(from);
                const botJid = jidNormalizedUser(sock.user.id);
                const botP = gMeta.participants.find(p => p.id === botJid);
                if (botP && (botP.admin === 'admin' || botP.admin === 'superadmin')) {
                    await sock.sendMessage(from, {
                        text: `🚫 @${sender.split('@')[0]} kicked for sharing status!`,
                        mentions: [sender]
                    });
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                }
            }
            return true;
        } catch (e) {
            sendLog(`[AntiStatus] Error: ${e.message}`, 'error');
        }
    }
    return false;
}

function isGroup(jid) {
    return jid?.endsWith('@g.us');
}

module.exports = {
    checkAntiSticker,
    checkAntiMedia,
    checkAntiLink,
    checkAntiStatus
};