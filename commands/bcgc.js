export default async function(sock, chatId, msg, isOwner, q) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    if (!q) return await sock.sendMessage(chatId, { text: '⚠️ .bcgc <message>' }, { quoted: msg });
    
    try {
        const groups = Object.keys(sock.chats).filter(jid => jid.endsWith('@g.us'));
        await sock.sendMessage(chatId, { text: `📢 Broadcasting to ${groups.length} groups...` }, { quoted: msg });
        
        let sent = 0;
        for (const group of groups) {
            try {
                await sock.sendMessage(group, { text: `*📢 BROADCAST*\n\n${q}\n\n_From: ZESHOO MD BOT Owner_` });
                sent++;
            } catch (e) {}
        }
        
        await sock.sendMessage(chatId, { text: `✅ Broadcast sent to ${sent} groups!` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + e.message }, { quoted: msg });
    }
}