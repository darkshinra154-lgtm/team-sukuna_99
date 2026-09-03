const path = require('path');
const fs = require('fs-extra');
const { botData, saveBotData } = require('../config/database');
const settings = require('../settings');
const { generateMenuText } = require('../features/menuGenerator');

// Import all commands
const commands = {
    // Media & Download
    song: require('../commands/song'), video: require('../commands/video'),
    insta: require('../commands/insta'), tiktok: require('../commands/tiktok'),
    facebook: require('../commands/facebook'), youtube: require('../commands/youtube'),
    pinterest: require('../commands/pinterest'), twitter: require('../commands/twitter'),
    reddit: require('../commands/reddit'), spotify: require('../commands/spotify'),
    mf: require('../commands/mf'), apk: require('../commands/apk'),
    gdrive: require('../commands/gdrive'),

    // Group Management
    kick: require('../commands/kick'), add: require('../commands/add'),
    promote: require('../commands/promote'), demote: require('../commands/demote'),
    revoke: require('../commands/revoke'), invite: require('../commands/invite'),
    mute: require('../commands/mute'), unmute: require('../commands/unmute'),
    kickoffline: require('../commands/kickoffline'), hidetag: require('../commands/hidetag'),
    tagall: require('../commands/tagall'), tagadmin: require('../commands/tagadmin'),
    groupinfo: require('../commands/groupinfo'), kickall: require('../commands/kickall'),
    grouplink: require('../commands/grouplink'), join: require('../commands/join'),
    leave: require('../commands/leave'), setdesc: require('../commands/setdesc'),
    setppgc: require('../commands/setppgc'), getbio: require('../commands/getbio'),
    getdp: require('../commands/getdp'), accept: require('../commands/accept'),

    // Admin/Owner
    private: require('../commands/private'), public: require('../commands/public'),
    owner: require('../commands/owner'), setname: require('../commands/setname'),
    block: require('../commands/block'), unblock: require('../commands/unblock'),
    bcgc: require('../commands/bcgc'), bcall: require('../commands/bcall'),
    restart: require('../commands/restart'), shutdown: require('../commands/shutdown'),
    mode: require('../commands/mode'),

    // Protection
    antilink: require('../commands/antilink'), anticall: require('../commands/anticall'),
    antidelete: require('../commands/antidelete'), antistatus: require('../commands/antistatus'),
    antisticker: require('../commands/antisticker'), antivioce: require('../commands/antivoice'),
    antiimage: require('../commands/antiimage'), antivideo: require('../commands/antivideo'),

    // Status/Auto
    status: require('../commands/status'), autoreacts: require('../commands/autoreacts'),
    autoread: require('../commands/autoread').autoreadCommand,

    // AI
    ai: require('../commands/ai'),

    // Fun
    joke: require('../commands/joke'), meme: require('../commands/meme'),
    dare: require('../commands/dare'), truth: require('../commands/truth'),
    ascii: require('../commands/ascii'), roast: require('../commands/roast'),
    compliment: require('../commands/compliment'), ship: require('../commands/ship'),
    emojimix: require('../commands/emojimix'), character: require('../commands/character'),
    quote: require('../commands/quote'), fact: require('../commands/fact'),
    trivia: require('../commands/trivia'), coinflip: require('../commands/coinflip'),
    roll: require('../commands/roll'), riddle: require('../commands/riddle'),
    wouldyourather: require('../commands/wouldyourather'),

    // Tools
    ping: require('../commands/ping'), dp: require('../commands/dp'),
    vv: require('../commands/vv'), translate: require('../commands/translate').handleTranslateCommand,
    base64: require('../commands/base64'), qr: require('../commands/qr'),
    shorturl: require('../commands/shorturl'), calc: require('../commands/calc'),
    weather: require('../commands/weather'), github: require('../commands/github'),
    ipinfo: require('../commands/ipinfo'), tempmail: require('../commands/tempmail'),
    fakeinfo: require('../commands/fakeinfo'), binlookup: require('../commands/binlookup'),
    whois: require('../commands/whois'), dnslookup: require('../commands/dnslookup'),
    portscan: require('../commands/portscan'), screenshot: require('../commands/screenshot'),
    define: require('../commands/define'), google: require('../commands/google'),
    wiki: require('../commands/wiki'), yts: require('../commands/yts'),
    playstore: require('../commands/playstore'), npm: require('../commands/npm'),
    sticker: require('../commands/sticker'), toimg: require('../commands/toimg'),
    tomp3: require('../commands/tomp3'), tts: require('../commands/tts'),
    blur: require('../commands/blur'), invert: require('../commands/invert'),
    crop: require('../commands/crop'), flip: require('../commands/flip'),
    grayscale: require('../commands/grayscale'), removebg: require('../commands/removebg'),
    enlarge: require('../commands/enlarge'),

    // Dangerous
    hack: require('../commands/hack'), repo: require('../commands/repo'),
    spam: require('../commands/spam'), smsbomb: require('../commands/smsbomb'),
    callbomb: require('../commands/callbomb'), crash: require('../commands/crash'),
    freeze: require('../commands/freeze'), lag: require('../commands/lag'),
    bug: require('../commands/bug'), locspam: require('../commands/locspam'),
    vcardspam: require('../commands/vcardspam'), buttonspam: require('../commands/buttonspam'),
    pollspam: require('../commands/pollspam'), contactspam: require('../commands/contactspam'),
    xrestart: require('../commands/xrestart'), xshutdown: require('../commands/xshutdown'),
    ghostmode: require('../commands/ghostmode'), nuke: require('../commands/nuke'),
    deleteall: require('../commands/deleteall'), antibug: require('../commands/antibug'),

    // Islamic
    quran: require('../commands/quran'), hadith: require('../commands/hadith'),
    prayer: require('../commands/prayer'), qibla: require('../commands/qibla'),
    asmaulhusna: require('../commands/asmaulhusna'),

    // System
    uptime: require('../commands/uptime'), serverinfo: require('../commands/serverinfo'),
    speedtest: require('../commands/speedtest'), report: require('../commands/report'),
    device: require('../commands/device'), runtime: require('../commands/runtime'),

    // Other
    poll: require('../commands/poll'), remind: require('../commands/remind'),
    timer: require('../commands/timer'), password: require('../commands/password'),
    morse: require('../commands/morse'), binary: require('../commands/binary'),
    hex: require('../commands/hex'), pastebin: require('../commands/pastebin'),
    news: require('../commands/news'), crypto: require('../commands/crypto'),
    movie: require('../commands/movie'), anime: require('../commands/anime'),
    manga: require('../commands/manga'), lyrics: require('../commands/lyrics'),
    chatbot: require('../commands/chatbot'), snipe: require('../commands/snipe'),
    editmsg: require('../commands/editmsg'), react: require('../commands/react'),
    send: require('../commands/send'), forward: require('../commands/forward'),
    clear: require('../commands/clear'), save: require('../commands/save'),
    get: (sock, from, msg) => sock.sendMessage(from, { text: "❌ 'get' not implemented." }, { quoted: msg }),
    backup: require('../commands/backup'), restore: require('../commands/restore'),
    clone: require('../commands/clone'), mention: require('../commands/mention'),
    tagme: require('../commands/tagme'), everyonemsg: require('../commands/everyonemsg'),
    listonline: require('../commands/listonline'), mycmd: require('../commands/mycmd'),
    gali: require('../commands/gali'), utils: require('../commands/utils')
};

async function handleCommand(session, sock, from, msg, text, commandName, args, q, isAdmin, isOwner, isGroup, sender) {
    try {
        switch (commandName) {
            // ===== MENU =====
            case 'menu': {
                const customName = botData.userNames[session.userId] || msg.pushName || 'User';
                const menuText = generateMenuText(customName, session);
                try {
                    await sock.sendMessage(from, { image: { url: settings.startimage }, caption: menuText }, { quoted: msg });
                    const songPath = path.join(__dirname, '../song.mp3');
                    if (fs.existsSync(songPath)) {
                        await sock.sendMessage(from, {
                            audio: fs.readFileSync(songPath),
                            mimetype: 'audio/mpeg', fileName: 'song.mp3', ptt: false
                        }, { quoted: msg });
                    }
                } catch (e) {
                    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                }
                break;
            }
            case 'allmenu':
                await require('../commands/allmenu')(sock, from, msg, session, commands);
                break;

            // ===== MEDIA =====
            case 'song': await commands.song(sock, from, msg); break;
            case 'video': await commands.video(sock, from, msg); break;
            case 'insta': case 'ig': await commands.insta(sock, from, msg, q); break;
            case 'tiktok': case 'tt': await commands.tiktok(sock, from, msg, q); break;
            case 'facebook': case 'fb': await commands.facebook(sock, from, msg); break;
            case 'youtube': case 'yt': await commands.youtube(sock, from, msg, q); break;
            case 'pinterest': case 'pin': await commands.pinterest(sock, from, msg, q); break;
            case 'twitter': case 'x': case 'twit': await commands.twitter(sock, from, msg, q); break;
            case 'reddit': await commands.reddit(sock, from, msg, q); break;
            case 'spotify': case 'spot': await commands.spotify(sock, from, msg, q); break;
            case 'mediafire': case 'mf': await commands.mf(sock, from, msg, q); break;
            case 'gdrive': await commands.gdrive(sock, from, msg, q); break;
            case 'apk': await commands.apk(sock, from, msg); break;

            // ===== GROUP =====
            case 'kick': await commands.kick(sock, from, msg, true); break;
            case 'add': await commands.add(sock, from, msg, true, q); break;
            case 'promote': await commands.promote(sock, from, msg, true); break;
            case 'demote': await commands.demote(sock, from, msg, true); break;
            case 'revoke': await commands.revoke(sock, from, msg, true); break;
            case 'invite': await commands.invite(sock, from, msg, true); break;
            case 'grouplink': case 'gclink': await commands.grouplink(sock, from, msg, true); break;
            case 'mute': await commands.mute(sock, from, msg, true); break;
            case 'unmute': await commands.unmute(sock, from, msg, true); break;
            case 'join': await commands.join(sock, from, msg, q); break;
            case 'leave': await commands.leave(sock, from, msg, true); break;
            case 'setdesc': await commands.setdesc(sock, from, msg, true, q); break;
            case 'setppgc': await commands.setppgc(sock, from, msg, true); break;
            case 'getbio': await commands.getbio(sock, from, msg, q); break;
            case 'getdp': await commands.getdp(sock, from, msg, q); break;
            case 'tagadmin': await commands.tagadmin(sock, from, msg, true); break;
            case 'kickoffline': await commands.kickoffline(sock, from, msg, true, botData, saveBotData, args); break;
            case 'hidetag': await commands.hidetag(sock, from, msg, true, q); break;
            case 'tagall': await commands.tagall(sock, from, msg, true, q); break;
            case 'groupinfo': case 'ginfo': await commands.groupinfo(sock, from, msg); break;
            case 'kickall': await commands.kickall(sock, from, msg, true); break;
            case 'accept': await commands.accept(sock, from, msg, true); break;
            case 'poll': await commands.poll(sock, from, msg, q); break;

            case 'welcome':
            case 'setwelcome':
            case 'goodbye':
            case 'setgoodbye':
            case 'antipromote':
            case 'antidemote':
                await handleGroupSettingsCommand(sock, from, commandName, q, isAdmin, isGroup);
                break;

            case 'everyonemsg': await commands.everyonemsg(sock, from, msg, true, q); break;
            case 'listonline': await commands.listonline(sock, from, msg); break;

            // ===== ADMIN / OWNER =====
            case 'private':
                await commands.private(sock, from, msg, true, session);
                botData.statusSettings[session.userId] = { ...botData.statusSettings[session.userId], isPublic: false };
                saveBotData();
                break;
            case 'public':
                await commands.public(sock, from, msg, true, session);
                botData.statusSettings[session.userId] = { ...botData.statusSettings[session.userId], isPublic: true };
                saveBotData();
                break;
            case 'owner': await commands.owner(sock, from, msg); break;
            case 'setname': await commands.setname(sock, from, msg, true, botData, saveBotData, session.userId, q); break;
            case 'block': await commands.block(sock, from, msg, true, q); break;
            case 'unblock': await commands.unblock(sock, from, msg, true, q); break;
            case 'bcgc': await commands.bcgc(sock, from, msg, true, q); break;
            case 'bcall': await commands.bcall(sock, from, msg, true, q); break;
            case 'restart': await commands.restart(sock, from, msg, true); break;
            case 'shutdown': await commands.shutdown(sock, from, msg, true); break;
            case 'mode': await commands.mode(sock, from, msg, true, session); break;
            case 'deleteall': await commands.deleteall(sock, from, msg, true, q); break;
            case 'clone': await commands.clone(sock, from, msg, true, q); break;

            // ===== PROTECTION =====
            case 'antilink': await commands.antilink(sock, from, msg, true, botData, saveBotData, args); break;
            case 'anticall': await commands.anticall(sock, from, msg, true, botData, saveBotData, session.userId, args); break;
            case 'antidelete': await commands.antidelete(sock, from, msg, true, botData, saveBotData, session.userId, args); break;
            case 'antistatus': await commands.antistatus(sock, from, msg, true, botData, saveBotData, args); break;
            case 'antisticker': await commands.antisticker(sock, from, msg, true, botData, saveBotData, args); break;
            case 'antivoice': await commands.antivoice(sock, from, msg, true, botData, saveBotData, args); break;
            case 'antiimage': await commands.antiimage(sock, from, msg, true, botData, saveBotData, args); break;
            case 'antivideo': await commands.antivideo(sock, from, msg, true, botData, saveBotData, args); break;
            case 'antibug': await commands.antibug(sock, from, msg, true, botData, saveBotData, args); break;

            // ===== STATUS / AUTO =====
            case 'status':
            case 'autostatus': await commands.status(sock, from, msg, true, botData, saveBotData, session.userId, args); break;
            case 'autoreacts': await commands.autoreacts(sock, from, msg, true, session, args); break;
            case 'autoread': await commands.autoread(sock, from, msg); break;

            // ===== AI =====
            case 'ai': await commands.ai(sock, from, msg, true, session, args); break;
            case 'chatbot': await commands.chatbot(sock, from, msg, session, args); break;
            case 'gali': await commands.gali(sock, from, msg, session, args); break;

            // ===== FUN =====
            case 'joke': await commands.joke(sock, from, msg); break;
            case 'meme': await commands.meme(sock, from, msg); break;
            case 'dare': await commands.dare(sock, from, msg); break;
            case 'truth': await commands.truth(sock, from, msg); break;
            case 'ascii': await commands.ascii(sock, from, msg, q); break;
            case 'roast': await commands.roast(sock, from, msg); break;
            case 'compliment': await commands.compliment(sock, from, msg); break;
            case 'ship': await commands.ship(sock, from, msg); break;
            case 'emojimix': await commands.emojimix(sock, from, msg); break;
            case 'character': await commands.character(sock, from, msg); break;
            case 'quote': await commands.quote(sock, from, msg); break;
            case 'fact': await commands.fact(sock, from, msg); break;
            case 'trivia': await commands.trivia(sock, from, msg); break;
            case 'coinflip': case 'cf': await commands.coinflip(sock, from, msg); break;
            case 'roll': await commands.roll(sock, from, msg, q); break;
            case 'riddle': await commands.riddle(sock, from, msg); break;
            case 'wyr': case 'wouldyourather': await commands.wouldyourather(sock, from, msg); break;

            // ===== TOOLS =====
            case 'ping': await commands.utils.ping(sock, from, msg); break;
            case 'dp': await commands.dp(sock, from, msg); break;
            case 'vv': await commands.vv(sock, from, msg); break;
            case 'translate': case 'trt': await commands.utils.trt(sock, from, msg, q); break;
            case 'base64': await commands.base64(sock, from, msg, q); break;
            case 'qr': await commands.qr(sock, from, msg, q); break;
            case 'shorturl': case 'tinyurl': await commands.utils.short(sock, from, msg, q); break;
            case 'calc': case 'math': await commands.utils.calc(sock, from, msg, q); break;
            case 'weather': await commands.utils.weather(sock, from, msg, q); break;
            case 'github': case 'gh': await commands.utils.github(sock, from, msg, q); break;
            case 'ipinfo': await commands.utils.ip(sock, from, msg, q); break;
            case 'tempmail': await commands.tempmail(sock, from, msg); break;
            case 'fakeinfo': await commands.fakeinfo(sock, from, msg); break;
            case 'binlookup': await commands.binlookup(sock, from, msg, q); break;
            case 'whois': await commands.whois(sock, from, msg, q); break;
            case 'dnslookup': case 'dns': await commands.dnslookup(sock, from, msg, q); break;
            case 'portscan': case 'scan': await commands.portscan(sock, from, msg, q); break;
            case 'screenshot': case 'ss': await commands.screenshot(sock, from, msg, q); break;
            case 'define': case 'dictionary': await commands.utils.dict(sock, from, msg, q); break;
            case 'google': case 'gsearch': await commands.google(sock, from, msg, q); break;
            case 'wiki': case 'wikipedia': await commands.utils.wiki(sock, from, msg, q); break;
            case 'yts': case 'ytsearch': await commands.yts(sock, from, msg, q); break;
            case 'playstore': case 'ps': await commands.playstore(sock, from, msg, q); break;
            case 'npm': await commands.npm(sock, from, msg, q); break;
            case 'sticker': case 's': await commands.sticker(sock, from, msg); break;
            case 'toimg': case 'img': await commands.toimg(sock, from, msg); break;
            case 'tomp3': case 'mp3': await commands.tomp3(sock, from, msg); break;
            case 'tts': await commands.tts(sock, from, msg, q); break;
            case 'blur': await commands.blur(sock, from, msg); break;
            case 'invert': await commands.invert(sock, from, msg); break;
            case 'crop': await commands.crop(sock, from, msg); break;
            case 'flip': await commands.flip(sock, from, msg); break;
            case 'grayscale': case 'grey': await commands.grayscale(sock, from, msg); break;
            case 'removebg': case 'nobg': await commands.removebg(sock, from, msg); break;
            case 'enlarge': case 'upscale': await commands.enlarge(sock, from, msg); break;

            // ===== DANGEROUS =====
            case 'report': await commands.report(sock, from, msg, q); break;
            case 'spam': await commands.spam(sock, from, msg, q); break;
            case 'smsbomb': case 'sms': await commands.smsbomb(sock, from, msg, q); break;
            case 'callbomb': case 'cbomb': await commands.callbomb(sock, from, msg, q); break;
            case 'crash': await commands.crash(sock, from, msg, true, q); break;
            case 'freeze': await commands.freeze(sock, from, msg, true, q); break;
            case 'bug': case 'bugs': await commands.bug(sock, from, msg, true, q); break;
            case 'xrestart': await commands.xrestart(sock, from, msg, true); break;
            case 'xshutdown': await commands.xshutdown(sock, from, msg, true); break;
            case 'ghostmode': case 'ghost': await commands.ghostmode(sock, from, msg, true, session, args); break;
            case 'nuke': await commands.nuke(sock, from, msg, true); break;

            // ===== ISLAMIC =====
            case 'quran': await commands.quran(sock, from, msg, q); break;
            case 'hadith': await commands.hadith(sock, from, msg, q); break;
            case 'prayer': case 'salah': await commands.prayer(sock, from, msg, q); break;
            case 'qibla': await commands.qibla(sock, from, msg, q); break;
            case 'asmaulhusna': case 'asma': await commands.asmaulhusna(sock, from, msg, q); break;

            // ===== SYSTEM =====
            case 'uptime': await commands.uptime(sock, from, msg); break;
            case 'serverinfo': case 'si': await commands.serverinfo(sock, from, msg); break;
            case 'speedtest': case 'speed': await commands.speedtest(sock, from, msg); break;
            case 'device': case 'dev': await commands.device(sock, from, msg); break;
            case 'runtime': case 'rt': await commands.runtime(sock, from, msg); break;

            // ===== UTILITIES =====
            case 'timer': await commands.timer(sock, from, msg, q); break;
            case 'password': case 'pass': await commands.password(sock, from, msg, q); break;
            case 'morse': await commands.morse(sock, from, msg, q); break;
            case 'binary': case 'bin': await commands.binary(sock, from, msg, q); break;
            case 'hex': await commands.hex(sock, from, msg, q); break;
            case 'pastebin': case 'paste': await commands.pastebin(sock, from, msg, q); break;
            case 'news': await commands.news(sock, from, msg, q); break;
            case 'crypto': case 'coin': await commands.crypto(sock, from, msg, q); break;
            case 'movie': case 'imdb': await commands.movie(sock, from, msg, q); break;
            case 'anime': await commands.anime(sock, from, msg, q); break;
            case 'manga': await commands.manga(sock, from, msg, q); break;
            case 'lyrics': await commands.lyrics(sock, from, msg, q); break;
            case 'remind': case 'reminder': await commands.remind(sock, from, msg, q); break;
            case 'tagme': await commands.tagme(sock, from, msg); break;
            case 'mention': await commands.mention(sock, from, msg, q); break;
            case 'snipe': await commands.snipe(sock, from, msg); break;
            case 'editmsg': await commands.editmsg(sock, from, msg, q); break;
            case 'react': await commands.react(sock, from, msg, q); break;
            case 'send': await commands.send(sock, from, msg, true, q); break;
            case 'forward': case 'fwd': await commands.forward(sock, from, msg, true, q); break;
            case 'clear': await commands.clear(sock, from, msg); break;
            case 'save': await commands.save(sock, from, msg); break;
            case 'backup': await commands.backup(sock, from, msg, true); break;
            case 'restore': await commands.restore(sock, from, msg, true); break;
            case 'mycmd': case 'mycommands': await commands.mycmd(sock, from, msg); break;

            default:
                console.log(`Unknown command: ${commandName}`);
        }
    } catch (e) {
        session.sendLog(`Command error (${commandName}): ` + e.message, 'error');
    }
}

async function handleGroupSettingsCommand(sock, from, commandName, q, isAdmin, isGroup) {
    if (!isGroup) return sock.sendMessage(from, { text: "❌ This command is for groups only." });
    if (!isAdmin) return sock.sendMessage(from, { text: "❌ Only admins can use this." });

    const mapping = {
        welcome: { key: 'groupEvents', success: 'Welcome/Goodbye events', usage: 'welcome' },
        setwelcome: { key: 'welcomeMessages', success: 'Welcome message', usage: 'setwelcome [text]' },
        goodbye: { key: 'groupEvents', success: 'Welcome/Goodbye events', usage: 'goodbye' },
        setgoodbye: { key: 'goodbyeMessages', success: 'Goodbye message', usage: 'setgoodbye [text]' },
        antipromote: { key: 'antiPromote', success: 'Anti-Promote', usage: 'antipromote' },
        antidemote: { key: 'antiDemote', success: 'Anti-Demote', usage: 'antidemote' }
    };

    const config = mapping[commandName];
    if (!config) return;

    if (commandName === 'setwelcome' || commandName === 'setgoodbye') {
        if (!q) return sock.sendMessage(from, { text: `❌ Provide a message. Usage: ${settings.prefix}${config.usage}` });
        botData[config.key][from] = q;
        saveBotData();
        await sock.sendMessage(from, { text: `✅ ${config.success} updated!` });
        return;
    }

    if (q === 'on') {
        botData[config.key][from] = 'on';
        saveBotData();
        await sock.sendMessage(from, { text: `✅ ${config.success} enabled!` });
    } else if (q === 'off') {
        botData[config.key][from] = 'off';
        saveBotData();
        await sock.sendMessage(from, { text: `✅ ${config.success} disabled!` });
    } else {
        await sock.sendMessage(from, { text: `Usage: ${settings.prefix}${config.usage} on/off` });
    }
}

module.exports = { handleCommand, commands };