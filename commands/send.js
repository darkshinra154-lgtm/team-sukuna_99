export default async function(sock, chatId, msg, isOwner, q) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    if (!q) return await sock.sendMessage(chatId, { text: '⚠️ .send <number> <message>' }, { quoted: msg });
    
    const parts = q.split(' ');
    const number = parts[0].replace(/\D/g, '');
    const text = parts.slice(1).join(' ');
    
    if (!number || !text) return await sock.sendMessage(chatId, { text: '⚠️ .send <number> <message>' }, { quoted: msg });
    
    try {
        await sock.sendMessage(number + '@s.whatsapp.net', { text });
        await sock.sendMessage(chatId, { text: `✅ Message sent to +${number}` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + e.message }, { quoted: msg });
    }
}