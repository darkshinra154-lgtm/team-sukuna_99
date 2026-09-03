export default async function(sock, chatId, msg, isOwner, q) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    if (!q) return await sock.sendMessage(chatId, { text: '⚠️ .bcall <message>' }, { quoted: msg });
    
    try {
        const allChats = Object.keys(sock.chats || {}).filter(jid => jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us'));
        await sock.sendMessage(chatId, { text: `📣 Broadcasting to ${allChats.length} chats...` }, { quoted: msg });
        
        let sent = 0;
        for (const jid of allChats) {
            try {
                await sock.sendMessage(jid, { text: `*📣 BROADCAST*\n\n${q}\n\n_From: ZESHOO MD BOT Owner_` });
                sent++;
            } catch (e) {}
        }
        
        await sock.sendMessage(chatId, { text: `✅ Broadcast sent to ${sent} chats!` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + e.message }, { quoted: msg });
    }
};