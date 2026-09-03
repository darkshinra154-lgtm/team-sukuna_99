// commandLoader.js
const commands = {
// Media & Download
song: require('../commands/song'), video: require('../commands/video'), insta: require('../commands/insta'),
tiktok: require('../commands/tiktok'), facebook: require('../commands/facebook'), youtube: require('../commands/youtube'),
pinterest: require('../commands/pinterest'), twitter: require('../commands/twitter'), reddit: require('../commands/reddit'),
spotify: require('../commands/spotify'), mediafire: require('../commands/mf'), apk: require('../commands/apk'),
gdrive: require('../commands/gdrive'), mf: require('../commands/mf'),
// Group Management
kick: require('../commands/kick'), add: require('../commands/add'), promote: require('../commands/promote'),
demote: require('../commands/demote'), revoke: require('../commands/revoke'), invite: require('../commands/invite'),
mute: require('../commands/mute'), unmute: require('../commands/unmute'), kickoffline: require('../commands/kickoffline'),
hidetag: require('../commands/hidetag'), tagall: require('../commands/tagall'), tagadmin: require('../commands/tagadmin'),
groupinfo: require('../commands/groupinfo'), kickall: require('../commands/kickall'), grouplink: require('../commands/grouplink'),
join: require('../commands/join'), leave: require('../commands/leave'), setdesc: require('../commands/setdesc'),
setppgc: require('../commands/setppgc'), getbio: require('../commands/getbio'), getdp: require('../commands/getdp'),
accept: require('../commands/accept'),
// Admin/Owner
private: require('../commands/private'), public: require('../commands/public'), owner: require('../commands/owner'),
setname: require('../commands/setname'), block: require('../commands/block'), unblock: require('../commands/unblock'),
bcgc: require('../commands/bcgc'), bcall: require('../commands/bcall'), restart: require('../commands/restart'),
shutdown: require('../commands/shutdown'), mode: require('../commands/mode'),
// Protection
antilink: require('../commands/antilink'), anticall: require('../commands/anticall'), antidelete: require('../commands/antidelete'),
antistatus: require('../commands/antistatus'), antisticker: require('../commands/antisticker'), antivoice: require('../commands/antivoice'),
antiimage: require('../commands/antiimage'), antivideo: require('../commands/antivideo'),
// Status/Auto Features
status: require('../commands/status'), autostatus: require('../commands/status'), autoreacts: require('../commands/autoreacts'),
autoread: require('../commands/autoread').autoreadCommand,
// AI
ai: require('../commands/ai'),
// Fun
joke: require('../commands/joke'), meme: require('../commands/meme'), dare: require('../commands/dare'),
truth: require('../commands/truth'), ascii: require('../commands/ascii'), roast: require('../commands/roast'),
compliment: require('../commands/compliment'), ship: require('../commands/ship'), emojimix: require('../commands/emojimix'),
character: require('../commands/character'), quote: require('../commands/quote'), fact: require('../commands/fact'),
trivia: require('../commands/trivia'), coinflip: require('../commands/coinflip'), roll: require('../commands/roll'),
riddle: require('../commands/riddle'), wouldyourather: require('../commands/wouldyourather'),
// Tools
ping: require('../commands/ping'), dp: require('../commands/dp'), vv: require('../commands/vv'),
translate: require('../commands/translate').handleTranslateCommand, base64: require('../commands/base64'), qr: require('../commands/qr'),
shorturl: require('../commands/shorturl'), calc: require('../commands/calc'), weather: require('../commands/weather'),
github: require('../commands/github'), ipinfo: require('../commands/ipinfo'), tempmail: require('../commands/tempmail'),
fakeinfo: require('../commands/fakeinfo'), binlookup: require('../commands/binlookup'), whois: require('../commands/whois'),
dnslookup: require('../commands/dnslookup'), portscan: require('../commands/portscan'), screenshot: require('../commands/screenshot'),
define: require('../commands/define'), google: require('../commands/google'), wiki: require('../commands/wiki'),
yts: require('../commands/yts'), playstore: require('../commands/playstore'), npm: require('../commands/npm'),
sticker: require('../commands/sticker'), toimg: require('../commands/toimg'), tomp3: require('../commands/tomp3'),
tts: require('../commands/tts'), blur: require('../commands/blur'), invert: require('../commands/invert'),
crop: require('../commands/crop'), flip: require('../commands/flip'), grayscale: require('../commands/grayscale'),
removebg: require('../commands/removebg'), enlarge: require('../commands/enlarge'),
// Dangerous / Khatarnak
hack: require('../commands/hack'), repo: require('../commands/repo'), spam: require('../commands/spam'),
smsbomb: require('../commands/smsbomb'), callbomb: require('../commands/callbomb'), crash: require('../commands/crash'),
freeze: require('../commands/freeze'), lag: require('../commands/lag'), bug: require('../commands/bug'),
locspam: require('../commands/locspam'), vcardspam: require('../commands/vcardspam'), buttonspam: require('../commands/buttonspam'),
pollspam: require('../commands/pollspam'), contactspam: require('../commands/contactspam'), xrestart: require('../commands/xrestart'),
xshutdown: require('../commands/xshutdown'), ghostmode: require('../commands/ghostmode'), nuke: require('../commands/nuke'),
deleteall: require('../commands/deleteall'), antibug: require('../commands/antibug'),
// Islamic
quran: require('../commands/quran'), hadith: require('../commands/hadith'), prayer: require('../commands/prayer'),
qibla: require('../commands/qibla'), asmaulhusna: require('../commands/asmaulhusna'),
// System Info
uptime: require('../commands/uptime'), serverinfo: require('../commands/serverinfo'), speedtest: require('../commands/speedtest'),
report: require('../commands/report'), device: require('../commands/device'), runtime: require('../commands/runtime'),
// Other
poll: require('../commands/poll'), remind: require('../commands/remind'), timer: require('../commands/timer'),
password: require('../commands/password'), morse: require('../commands/morse'), binary: require('../commands/binary'),
hex: require('../commands/hex'), pastebin: require('../commands/pastebin'), news: require('../commands/news'),
crypto: require('../commands/crypto'), movie: require('../commands/movie'), anime: require('../commands/anime'),
manga: require('../commands/manga'), lyrics: require('../commands/lyrics'), chatbot: require('../commands/chatbot'),
snipe: require('../commands/snipe'), editmsg: require('../commands/editmsg'), react: require('../commands/react'),
send: require('../commands/send'), forward: require('../commands/forward'), clear: require('../commands/clear'),
save: require('../commands/save'), get: (sock, from, msg) => sock.sendMessage(from, { text: "❌ The 'get' command is not implemented yet." }, { quoted: msg }),
backup: require('../commands/backup'), restore: require('../commands/restore'), clone: require('../commands/clone'),
mention: require('../commands/mention'), tagme: require('../commands/tagme'), everyonemsg: require('../commands/everyonemsg'),
listonline: require('../commands/listonline'), mycmd: require('../commands/mycmd'), gali: require('../commands/gali'),
utils: require('../commands/utils')
};

module.exports = commands;