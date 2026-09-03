// menuGenerator.js
const settings = require('../settings');
const state = require('./state');

function generateMenuText(userName, session) {
    const botData = state.getBotData();
    const mode = session.isPublic ? 'Public' : 'Private';

    return `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃   💀  *ZESHOO MINI BOT*  💀      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  🤖 *BOT NAME*  : ZESHOO MINI    ┃
┃  👤 *OWNER*     : ${settings.ownerName || 'ZESHOO'}
┃  📦 *VERSION*   : ${settings.version}
┃  ⚙️ *MODE*      : ${mode}
┃  🔑 *PREFIX*    : ${settings.prefix}
┃  👥 *USER*      : ${userName}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  📋 *CATEGORIES*                ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  ✨ .allmenu      (300+ Commands) ┃
┃  👑 .ownermenu              ┃
┃  👥 .groupmenu            ┃
┃  🤖 .aimenu                    ┃
┃  ⬇️ .downloadmenu     ┃
┃  🛠️ .toolsmenu           ┃
┃  🎉 .funmenu          ┃
┃  🎮 .gamemenu           ┃
┃  🎌 .animemenu                 ┃
┃  🏷️ .stickermenu             ┃
┃  🖼️ .imagemenu                ┃
┃  ✏️ .textmakermenu       ┃
┃  🏢 .logomenu         ┃
┃  🕌 .islamicmenu          ┃
┃  🎯 .miscmenu                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
☠️  *POWERED BY : ZESHOO MINI*  ☠️`;
}

module.exports = { generateMenuText };