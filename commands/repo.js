const settings = require('../settings'); // اگر settings نہیں تو اس لائن کو ہٹا دو

module.exports = async function(sock, chatId, msg, args) {
    // ── Helper: Branded send (newsletter forward) ──
    const sendMsg = async (text) => {
        return await sock.sendMessage(chatId, {
            text: text,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "0029Vb8vvB1Fcow4AY0NeC1p@newsletter",
                    newsletterName: "𝐙𝐄𝐒𝐇𝐎𝐎 𝐓𝐄𝐂𝐇",
                    serverMessageId: 200
                }
            }
        }, { quoted: msg });
    };

    try {
        // ── Reaction ──
        await sock.sendMessage(chatId, { react: { text: "🔗", key: msg.key } });

        // ── Heavy Box Response ──
        const response = `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💀  *𝙕𝙀𝙎𝙃𝙊𝙊 𝙈𝘿  —  𝙍𝙀𝙋𝙊𝙎𝙄𝙏𝙊𝙍𝙔*  💀  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🔗 *Official Website*                   ┃
┃  ➤ https://zeshoo-md-production.up.railway.app/ ┃
┃  ➤ https://zeshoo-md-production.up.railway.app/ ┃
┃  ➤ https://zeshoo-md-production.up.railway.app/ ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  📱 *Pairing Guide*                      ┃
┃  ➤ Type .pair 91XXXXXXXXXX              ┃
┃  ➤ Scan QR or enter code in WhatsApp    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🚀 *Quick Connect*                      ┃
┃  ✨ .pair 913XXXXXXXXX                   ┃
┃  ⚡ Scan • Pair • Enjoy        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  👑 *Version*   : ${settings?.version || '3.0'}  ┃
┃  🔐 *Security*  : Premium Encrypted      ┃
┃  ☠️ *Powered by* : ZESHOO MD TEAM          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
        `;

        await sendMsg(response);

    } catch (error) {
        console.error("❌ Repo command error:", error);
        await sendMsg("⚠️ کچھ غلط ہو گیا، براہِ کرم دوبارہ کوشش کریں۔");
    }
};
