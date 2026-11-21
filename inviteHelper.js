const { PermissionFlagsBits } = require("discord.js");
const { tag, rose, mint, MAIN_SERVER_ID } = require("./config");

const MAIN_INVITE_CHANNEL_ID = "1475091249793994875"; // .chat channel in main server

async function pruneStaleInvite(guild) {
  try {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return false;
    const botId = guild.client.user.id;
    // Find a 0-use invite created by the bot
    const stale = [...invites.values()].find((i) => (i.inviterId === botId || i.inviter?.id === botId) && i.uses === 0);
    if (stale) {
      await stale.delete("auto-prune for new personal invite");
      console.log(tag("personal-invite") + mint(` auto-pruned stale invite ${stale.code} in ${guild.name}`));
      return true;
    }
  } catch (e) {
    console.error(tag("personal-invite") + rose(` auto-prune failed in ${guild.name}: ${e.message}`));
  }
  return false;
}

/**
 * Creates a personal invite in the specified guild.
 * If user runs .link in Server 1 -> creates invite for Server 1.
 * If user runs .link in Server 2 -> creates invite for Server 2.
 */
async function createPersonalInvite(guild, preferredChannelId, user) {
  if (!guild) {
    throw new Error("Guild not provided.");
  }

  const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    throw new Error("Bot member could not be fetched in this server.");
  }

  // 1. Determine target channel inside this guild
  let targetChannelId = null;

  if (preferredChannelId) {
    const ch = guild.channels.cache.get(preferredChannelId);
    if (ch && ch.isTextBased?.() && !ch.isThread?.() && ch.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite)) {
      targetChannelId = ch.id;
    }
  }

  if (!targetChannelId && guild.id === MAIN_SERVER_ID) {
    const mainCh = guild.channels.cache.get(MAIN_INVITE_CHANNEL_ID);
    if (mainCh && mainCh.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite)) {
      targetChannelId = mainCh.id;
    }
  }

  if (!targetChannelId) {
    const fallback = guild.channels.cache.find(
      (c) => c.isTextBased?.() && !c.isThread?.() && c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite)
    );
    if (fallback) targetChannelId = fallback.id;
  }

  if (!targetChannelId) {
    throw new Error("Bot lacks permission to create invites in any channel. Please grant 'Create Invite' permission to the bot.");
  }

  const options = {
    maxAge: 0,
    maxUses: 0,
    unique: true,
    reason: `personal invite for ${user.tag} in ${guild.name}`,
  };

  try {
    return await guild.invites.create(targetChannelId, options);
  } catch (err) {
    // Error 30016: Maximum number of invites to this server reached
    if (err.code === 30016) {
      console.log(tag("personal-invite") + rose(` guild invite limit reached in ${guild.name}, pruning a stale invite...`));
      const pruned = await pruneStaleInvite(guild);
      if (pruned) {
        return await guild.invites.create(targetChannelId, options);
      }
    }
    throw err;
  }
}

module.exports = {
  createPersonalInvite,
  pruneStaleInvite,
  MAIN_SERVER_ID,
  MAIN_INVITE_CHANNEL_ID,
};
