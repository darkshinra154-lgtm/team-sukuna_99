import state from '../config/state.js';

export default async function(sock, chatId, msg, isOwner) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    
    await sock.sendMessage(chatId, { text: '🛠️ Force restarting all sessions...' }, { quoted: msg });
    
    // Disconnect and reconnect
    for (const [sessionId, session] of Object.entries(state.sessions)) {
        try {
            if (session.sock) {
                await session.sock.ws.close();
                session.isConnected = false;
                setTimeout(() => session.initialize(), 3000);
            }
        } catch (e) {
            console.error(`[Restart] Error restarting session ${sessionId}:`, e.message);
        }
    }
    
    await sock.sendMessage(chatId, { text: '✅ Restart command executed!' });
}