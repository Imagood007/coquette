// index.js
process.on("uncaughtException", (err) => { console.error(err); });
process.on("unhandledRejection", (r) => { console.error(r); });

const { Client, GatewayIntentBits, ActivityType, Collection, Events, PermissionFlagsBits } = require("discord.js");
const { DefaultWebSocketManagerOptions } = require("@discordjs/ws");
const fs   = require("fs");
const path = require("path");
const util = require("util");

// ── VR Device Gateway Identify Properties ──────────────────────
DefaultWebSocketManagerOptions.identifyProperties = {
  $os: "android",
  $browser: "Discord VR",
  $device: "Meta Quest 3",
  os: "android",
  browser: "Discord VR",
  device: "Meta Quest 3",
};

const {
  MAIN_SERVER_ID, MANAGER_TOKEN, PREFIX, ALLOWED_ROLE_ID, PREMIUM_ROLE_ID, GUIDE_CHANNEL_ID,
  BOT_STATUS, BOT_STATUS_TEXT, MSG, GUIDES, GUIDE_VIDEOS, hasAccess, OWNER_ROLE_ID, OWNER_ID, isPremium,
} = require("./config");

const {
  cleanupInstancesFolder, scheduleQuestCheck, scheduleRestart, killAll,
} = require("./instances");

const { handleInteraction }    = require("./handlers");
const { enableAutoQuest }      = require("./autoQuest");
const { getInviterOf, getInvitesOf, removeInvited, recordInvites, getGuildActiveInvites } = require("./inviteTracker");
const { snapshotGuildInvites, findUsedInvite, trackMemberInvite } = require("./inviteMonitor");
const { handlePersonalInviteJoin } = require("./personalInviteMonitor");
const { decrementJoins } = require("./personalInvites");
const { maybeAutoGrant } = require("./autoAccess");
const { getQuestAccessRoleId } = require("./guildConfig");
const { getExpiredPremiums, deletePremiumEntry } = require("./premiumTracker");
const { checkBoosterAlts } = require("./boosterAltChecker");
const { handleChat, resetConversation } = require("./ai/index.js");
const { areCommandsEnabled } = require("./commandState");
const { isUnderMaintenance } = require("./maintenanceState");
const { isUnlimitedEnabled } = require("./unlimitedState");
const { trackUser } = require("./dailyUsers");
const { startTokenApi, setDiscordClient } = require("./tokenApi");
const CONSOLE_LOG_CHANNEL_ID = process.env.CONSOLE_LOG_CHANNEL_ID || "";

// ── load commands ─────────────────────────────────────────────
const commands = new Collection();

function loadCommandsFrom(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
    const cmd = require(path.join(dir, file));
    if (!cmd.name) continue;
    commands.set(cmd.name, cmd);
    if (cmd.aliases?.length) cmd.aliases.forEach(a => commands.set(a, cmd));
  }
}

loadCommandsFrom(path.join(__dirname, "commands"));

// ── client ────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ["CHANNEL"],
});

function setupConsoleMirror(client) {
  if (!CONSOLE_LOG_CHANNEL_ID) return;
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  const queue = [];
  let flushing = false;

  const stripAnsi = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, "");
  const formatArg = (arg) => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "string") return arg;
    return util.inspect(arg, { depth: 4, colors: false });
  };

  async function flush() {
    if (flushing || !client.isReady() || queue.length === 0) return;
    flushing = true;
    try {
      const channel = await client.channels.fetch(CONSOLE_LOG_CHANNEL_ID).catch(() => null);
      if (!channel?.send) return;

      while (queue.length) {
        const line = queue.shift();
        for (let i = 0; i < line.length; i += 1800) {
          const part = line.slice(i, i + 1800).replace(/```/g, "'''");
          await channel.send(`\`\`\`\n${part}\n\`\`\``).catch(() => {});
        }
      }
    } finally {
      flushing = false;
    }
  }

  for (const level of ["log", "warn", "error"]) {
    console[level] = (...args) => {
      original[level](...args);
      const line = stripAnsi(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${args.map(formatArg).join(" ")}`);
      queue.push(line);
      if (queue.length > 150) queue.splice(0, queue.length - 150);
      setTimeout(flush, 500);
    };
  }

  client.once(Events.ClientReady, () => {
    console.log(`console mirror connected to ${CONSOLE_LOG_CHANNEL_ID}`);
    flush();
  });
}

setupConsoleMirror(client);

// ── ready ─────────────────────────────────────────────────────
let premiumInterval = null;

client.once(Events.ClientReady, () => {
  cleanupInstancesFolder();
  client.user.setPresence({
    activities: [{ name: BOT_STATUS_TEXT, type: ActivityType.Watching }],
    status: BOT_STATUS,
  });
  scheduleQuestCheck(client);
  scheduleRestart();
  enableAutoQuest(client);

  // Start token-link API
  setDiscordClient(client);
  startTokenApi(26286);

  for (const guild of client.guilds.cache.values()) {
    snapshotGuildInvites(guild).catch((error) =>
      console.warn(`[invite] could not initialise invite cache for ${guild.id}: ${error.message}`)
    );
  }

  checkPremiumExpiry(client);
  checkBoosterAlts(client);
  if (!premiumInterval) {
    premiumInterval = setInterval(() => {
      checkPremiumExpiry(client);
      checkBoosterAlts(client);
    }, 45 * 1000);
  }
});

// ── message handler ───────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const { checkImageSpam } = require("./imageSpamTracker");
  const { checkCrossChannelSpam } = require("./crossChannelSpamTracker");
  
  await checkImageSpam(message);
  await checkCrossChannelSpam(message);

  // AI guide chat in the dedicated guide channel
  if (message.channel.id === GUIDE_CHANNEL_ID) {
    const lower = message.content.toLowerCase();

    if (lower === "!reset") {
      resetConversation(message.author.id);
      await message.reply("♡ Chat reset. Ask me anything!");
      return;
    }

    await message.channel.sendTyping();
    try {
      const reply = await handleChat(message.author.id, message.content);
      if (reply.length <= 2000) {
        await message.channel.send(reply);
      } else {
        const chunks = reply.match(/[\s\S]{1,1950}(?=\s|$)/g) || reply.match(/[\s\S]{1,1950}/g);
        for (const chunk of chunks) {
          if (chunk.trim()) await message.channel.send(chunk);
        }
      }
    } catch (e) {
      console.error(`ai guide error: ${e.message}`);
      await message.reply("Sorry, I ran into an error. Try again.");
    }
    return;
  }

  if (message.mentions.has(client.user)) {
    if (hasAccess(message.member)) {
      await message.reply("You have access — use `.q` to start your session.");
    } else {
      await message.reply("✦ You don't have access yet. Type `.link` to invite 2 people to get automatic access.");
    }
    return;
  }
  if (!message.content.startsWith(PREFIX)) return;

  const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmdName = args[0]?.toLowerCase();
  const command = commands.get(cmdName);
  if (!command) return;

  const isOwnerUser = message.author.id === (OWNER_ID || "806113872620421140") || message.member?.roles?.cache?.has(OWNER_ROLE_ID || "1512803823733706782");
  if (isUnderMaintenance() && cmdName !== "main" && !isOwnerUser) {
    await message.reply("Bot is under maintenance. Please try again later.");
    return;
  }

  // ── Multi-server command restriction ────────────────────────
  // In other servers, only .q, .p, .link, .i, .status / .s and .setup (for admins) are allowed.
  if (message.guild && message.guild.id !== MAIN_SERVER_ID && !isOwnerUser && message.guild.ownerId !== OWNER_ID) {
    const memberCount = message.guild.memberCount || 0;
    if (memberCount < 100) {
      await message.reply({
        content: `✦ You need at least 100+ members to use this bot in your server. (This server has ${memberCount} members). Leaving server...`,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      }).catch(() => {});
      await message.guild.leave().catch(() => {});
      return;
    }

    const allowedCommandsInOtherServers = ["quest", "ping", "link", "invites", "status", "setup", "help", "guide"];
    if (!allowedCommandsInOtherServers.includes(command.name)) {
      await message.reply("This command is only available in the official server. Available commands here: `.help`, `.q`, `.p`, `.link`, `.i`, `.status` (`.s`), `.guide`");
      return;
    }
  }

  if ((cmdName === "quest" && (args[1] === "enable" || args[1] === "disable")) || cmdName === "uni" || cmdName === "unlimited") {
    await command.execute(message, args.slice(1), { client });
    return;
  }

  if (!areCommandsEnabled()) {
    if (hasAccess(message.member)) {
      await message.reply("You have access — use `.q` to start your session.");
    } else {
      await message.reply("✦ You don't have access yet. Type `.link` to invite 2 people to get automatic access.");
    }
    return;
  }

  const exempt = ["setup", "set", "quest", "uni", "unlimited", "left", "ci", "clearinvites", "cleaninvites", "deleteinvites", "help", "guide", "tutorial", "commands", "ping", "restart", "int", "access", "ac", "check", "checkall", "checkads", "supporter", "support", "staff", "main", "count", "users", "link", "invites", "inv", "leaderboard", "lb", "booster", "rate", "vouch", "review", "profile", "staffprofile", "sp", "ram", "memory", "mem", "stats", "usage", "status", "s", "server", "servers", "guilds", "setavatar", "setpfp", "botavatar", "botpfp"];
  if (!exempt.includes(command.name) && !hasAccess(message.member)) {
    await message.reply(MSG.no_access);
    return;
  }

  try {
    await command.execute(message, args.slice(1), { client });
    trackUser(message.author.id);
  } catch (e) {
    console.error(`command ${command.name} failed`, e);
    await message.reply("something went wrong.").catch(() => {});
  }
});

// ── interaction handlers ──────────────────────────────────────
client.on("interactionCreate", handleInteraction);

client.on(Events.GuildCreate, async (guild) => {
  // Enforce 100+ member requirement for external servers
  if (guild.id !== MAIN_SERVER_ID && guild.ownerId !== OWNER_ID) {
    const memberCount = guild.memberCount || 0;
    if (memberCount < 100) {
      console.log(`[bot] Bot invited to ${guild.name} (${guild.id}) with only ${memberCount} members. Leaving...`);
      try {
        let channel = guild.systemChannel;
        if (!channel || !channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
          channel = guild.channels.cache.find(
            (c) => c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
          );
        }
        if (channel) {
          await channel.send({
            content: `✦ You need at least 100+ members to add this bot to your server. (This server currently has ${memberCount} members). Leaving server...`,
            allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
          }).catch(() => {});
        }
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner) {
          await owner.send(`✦ You added the quest bot to **${guild.name}**, but this bot requires at least **100+ members** to be used in external servers. (Your server currently has ${memberCount} members). The bot has left the server.`).catch(() => {});
        }
      } catch (err) {
        console.error(`[bot] error sending leave notice in ${guild.name}:`, err.message);
      }
      await guild.leave().catch(() => {});
      return;
    }
  }

  snapshotGuildInvites(guild).catch(() => {});
  console.log(`[bot] joined new server: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
});

client.on(Events.InviteCreate, (invite) => {
  snapshotGuildInvites(invite.guild).catch(() => {});
});

client.on(Events.InviteDelete, (invite) => {
  snapshotGuildInvites(invite.guild).catch(() => {});
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  const usedInvite = await findUsedInvite(member).catch(() => null);
  const personalJoin = await handlePersonalInviteJoin(member, usedInvite).catch(() => null);
  
  const inviterId = personalJoin?.inviterId ?? await trackMemberInvite(member, usedInvite).catch(() => null);
  
  if (inviterId) {
    recordInvites(member.guild.id, inviterId, [member.id]);
    await maybeAutoGrant(member.guild, inviterId).catch(() => {});
  }
});

// ── invite tracking — remove access if invited person leaves ──
client.on(Events.GuildMemberRemove, async (member) => {
  if (member.user?.bot) return;
  const inviterId = getInviterOf(member.guild.id, member.id);
  if (!inviterId) return;

  removeInvited(member.guild.id, member.id);
  await decrementJoins(member.guild.id, inviterId, member.id);

  try {
    const guildMember = await member.guild.members.fetch(inviterId).catch(() => null);
    if (!guildMember) return;

    // Check if protected in main server
    if (member.guild.id === MAIN_SERVER_ID && (isPremium(guildMember) || guildMember.id === OWNER_ID)) {
      return;
    }

    const { activeCount } = await getGuildActiveInvites(member.guild, inviterId);
    const accessRoleId = member.guild.id === MAIN_SERVER_ID ? ALLOWED_ROLE_ID : getQuestAccessRoleId(member.guild.id);

    // Revoke if they fall below requirements
    if (accessRoleId && guildMember.roles.cache.has(accessRoleId) && activeCount < 2) {
      await guildMember.roles.remove(accessRoleId).catch(() => {});
      console.log(`[invite] removed access from ${inviterId} in ${member.guild.name} — invited user ${member.id} left (active: ${activeCount}/2)`);
    }
  } catch (e) {
    console.error(`[invite] failed to revoke access for ${inviterId} in ${member.guild.name}: ${e.message}`);
  }
});

async function checkPremiumExpiry(client) {
  console.log(`[premium] checker started · ${client.guilds.cache.size} guild(s)`);
  const before = Date.now();
  const expired = getExpiredPremiums();
  console.log(`[premium] expired users: ${JSON.stringify(expired)}`);
  if (expired.length === 0) {
    return;
  }
  let removed = 0;
  let failed = 0;
  for (const userId of expired) {
    console.log(`[premium] checking user: ${userId}`);
    let found = false;
    for (const guild of client.guilds.cache.values()) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      found = true;
      console.log(`[premium] found ${userId} in guild: ${guild.name}`);
      try {
        if (member.roles.cache.has(PREMIUM_ROLE_ID)) {
          await member.roles.remove(PREMIUM_ROLE_ID);
          console.log(`[premium] role removed from ${member.user.tag} (${userId})`);
        } else {
          console.log(`[premium] ${userId} no longer has premium role — cleaning up`);
        }
        deletePremiumEntry(userId);
        removed++;
      } catch (e) {
        console.error(`[premium] failed to remove role from ${userId}: ${e.message} — will retry`);
        failed++;
      }
      break;
    }
    if (!found) {
      console.log(`[premium] ${userId} not found in any guild — purging from premium.json`);
      deletePremiumEntry(userId);
      removed++;
    }
  }
  console.log(`[premium] check done: ${removed} removed, ${failed} failed (${Date.now() - before}ms)`);
}

// ── signals ───────────────────────────────────────────────────
function cleanupAll() {
  killAll();
  try { fs.rmSync(path.join(__dirname, "instances"), { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}

process.on("SIGINT",  cleanupAll);
process.on("SIGTERM", cleanupAll);

client.login(MANAGER_TOKEN).catch((e) => { console.error(e); process.exit(1); });
