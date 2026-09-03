import state from '../config/state.js';

export default async function(sock, chatId, msg, isOwner) {
    if (!isOwner) return await sock.sendMessage(chatId, { text: '❌ Owner only!' }, { quoted: msg });
    
    await sock.sendMessage(chatId, { text: '💣 Shutting down all sessions...' }, { quoted: msg });
    
    // الوصول للـ sessions من خلال الـ state المستورد
    for (const [sessionId, session] of Object.entries(state.sessions)) {
        try {
            if (session.sock) {
                await session.sock.logout();
                session.isConnected = false;
            }
        } catch (e) {
            console.error(`Error shutting down ${sessionId}:`, e.message);
        }
    }
    
    await sock.sendMessage(chatId, { text: '✅ All sessions shut down!' });
}