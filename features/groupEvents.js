const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { botData, saveBotData } = require('../config/database');
const settings = require('../settings');

async function handleGroupParticipantsUpdate(sock, update, userId) {
    const { id, participants, action, author } = update;
    console.log(`[DEBUG] Group event: ${action} in ${id}`);

    const currentData = JSON.parse(require('fs').readFileSync('./data/bot_data.json', 'utf8'));

    // Welcome/Goodbye
    if (currentData.groupEvents?.[id] === 'on') {
        for (const participant of participants) {
            try {
                const metadata = await sock.groupMetadata(id).catch(() => ({ subject: "Group" }));
                const user = participant.split('@')[0];
                
                if (action === 'add') {
                    const welcomeMsg = currentData.welcomeMessages[id] || `Welcome @${user} to ${metadata.subject}!`;
                    await sock.sendMessage(id, { text: welcomeMsg, mentions: [participant] });
                } else if (action === 'remove') {
                    const goodbyeMsg = currentData.goodbyeMessages[id] || `Goodbye @${user} from ${metadata.subject}!`;
                    await sock.sendMessage(id, { text: goodbyeMsg, mentions: [participant] });
                }
            } catch (e) {}
        }
    }

    // Anti-Promote / Anti-Demote
    if (author) {
        const botJid = jidNormalizedUser(sock.user.id);
        const authorClean = author.split('@')[0];
        const botClean = botJid.split('@')[0];
        const ownerNumbers = String(settings.ownerNumber).split(',').map(n => n.replace(/\D/g, ''));

        const isOwnerAction = ownerNumbers.includes(authorClean) || authorClean === botClean;
        if (isOwnerAction) return;

        try {
            const metadata = await sock.groupMetadata(id);
            const botIsAdmin = metadata.participants.find(p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin'));
            if (!botIsAdmin) return;

            if (action === 'promote' && currentData.antiPromote?.[id] === 'on') {
                for (const participant of participants) {
                    await sock.groupParticipantsUpdate(id, [participant], 'demote');
                }
                await sock.sendMessage(id, {
                    text: `🚫 *ANTI-PROMOTE*\n\n@${authorClean} tried to promote someone!\n_Action taker kicked._`,
                    mentions: [author]
                });
                await sock.groupParticipantsUpdate(id, [author], 'remove');
            } else if (action === 'demote' && currentData.antiDemote?.[id] === 'on') {
                for (const participant of participants) {
                    await sock.groupParticipantsUpdate(id, [participant], 'promote');
                }
                await sock.sendMessage(id, {
                    text: `🚫 *ANTI-DEMOTE*\n\n@${authorClean} tried to demote an admin!\n_Action taker kicked._`,
                    mentions: [author]
                });
                await sock.groupParticipantsUpdate(id, [author], 'remove');
            }
        } catch (e) {
            console.error(`[Anti-Security] Error: ${e.message}`);
        }
    }
}

async function handleStubGroupEvent(sock, msg, from) {
    const stubType = msg.messageStubType;
    const currentData = JSON.parse(require('fs').readFileSync('./data/bot_data.json', 'utf8'));
    
    if (currentData.groupEvents?.[from] !== 'on') return;

    const metadata = await sock.groupMetadata(from).catch(() => ({ subject: "Group" }));
    const participants = msg.messageStubParameters || [];

    for (const participant of participants) {
        const user = participant.split('@')[0];
        if (stubType === 27 || stubType === 31) {
            const welcomeMsg = currentData.welcomeMessages[from] || `Welcome @${user} to ${metadata.subject}!`;
            await sock.sendMessage(from, { text: welcomeMsg, mentions: [participant] });
        } else if (stubType === 28 || stubType === 32) {
            const goodbyeMsg = currentData.goodbyeMessages[from] || `Goodbye @${user} from ${metadata.subject}!`;
            await sock.sendMessage(from, { text: goodbyeMsg, mentions: [participant] });
        }
    }
}

module.exports = {
    handleGroupParticipantsUpdate,
    handleStubGroupEvent
};