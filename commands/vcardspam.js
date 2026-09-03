export default async function(sock, chatId, msg, isOwner, q) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    
    try {
        let target;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (q) target = q.replace(/\D/g, '') + '@s.whatsapp.net';
        else if (mentioned) target = mentioned;
        else if (quoted) target = quoted;
        else return await sock.sendMessage(chatId, { text: '⚠️ .vcardspam @user or reply' }, { quoted: msg });
        
        await sock.sendMessage(chatId, { text: `📧 Sending vCard spam...` }, { quoted: msg });
        
        for (let i = 0; i < 15; i++) {
            try {
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:Spam${i}\nTEL;TYPE=CELL:+123456789${i}\nEND:VCARD`;
                await sock.sendMessage(target, {
                    contacts: {
                        displayName: `Spam${i}`,
                        contacts: [{ vcard }]
                    }
                });
            } catch (e) {
                // Ignore individual send errors to ensure the loop continues
            }
        }
        
        await sock.sendMessage(chatId, { text: `✅ vCard spam sent!` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Error: ' + e.message }, { quoted: msg });
    }
}