// ╔══════════════════════════════════════════════════════════════╗
// ║              PERSONAL INVITE JOIN MONITOR                    ║
// ║  increments join count · auto-delete at limit · DMs owner    ║
// ╚══════════════════════════════════════════════════════════════╝

const { findByCode, incrementJoins, deactivateInvite } = require("./personalInvites");
const { getInviterOf, recordInvites, getHistoryOf } = require("./inviteTracker");
const { PERSONAL_INVITE_MAX_JOINS, INVITE_LOG_CHANNEL_ID, MAIN_SERVER_ID, tag, mint, rose } = require("./config");

const recentJoiners = new Map();

async function handlePersonalInviteJoin(member, usedInvite) {
  if (!usedInvite?.code) return null;

  const entry = await findByCode(usedInvite.code).catch(() => null);
  if (!entry || !entry.active) return null;
  if (entry.userId === member.id) return null;

  const guildId = entry.guildId || member.guild.id;
  if (guildId !== member.guild.id) return null;

  // A Discord account in this guild is permanently locked to their first inviter in this guild
  const historicalInviter = getHistoryOf(guildId, member.id);
  if (historicalInviter && historicalInviter !== entry.userId) {
    // If they were originally invited by someone else in this guild, reject stealing
    return { inviterId: entry.userId, joins: entry.joins, counted: false };
  }

  const now = Date.now();
  const joinKey = `${guildId}:${member.id}`;
  const lastJoin = recentJoiners.get(joinKey);
  if (lastJoin && now - lastJoin < 5 * 60 * 1000) return null;
  recentJoiners.set(joinKey, now);

  const increment = await incrementJoins(guildId, entry.userId, member.id).catch(() => null);
  if (!increment) return null;
  if (!increment.counted) {
    return { inviterId: entry.userId, joins: increment.entry.joins, counted: false };
  }
  const { entry: updated } = increment;
  recordInvites(guildId, entry.userId, [member.id]);

  console.log(tag("personal-invite") + mint(` ${member.user.tag} joined via ${entry.userId}'s invite in ${member.guild.name} (${updated.joins}/${updated.maxJoins})`));

  if (updated.joins >= updated.maxJoins) {
    await deactivateInvite(guildId, entry.userId).catch(() => {});
    await deleteDiscordInvite(member, usedInvite.code);
    await notifyOwner(member, entry);
  }

  if (INVITE_LOG_CHANNEL_ID && guildId === MAIN_SERVER_ID) {
    await logToChannel(member, entry, updated);
  }

  return { inviterId: entry.userId, joins: updated.joins, counted: true };
}

async function deleteDiscordInvite(member, code) {
  try {
    const invite = await member.guild.invites.fetch(code).catch(() => null);
    if (invite) {
      await invite.delete("reached personal invite limit");
      console.log(tag("personal-invite") + mint(` invite ${code} deleted (limit reached) in ${member.guild.name}`));
    }
  } catch (e) {
    console.log(tag("personal-invite") + rose(` could not delete invite ${code}: ${e.message}`));
  }
}

async function notifyOwner(member, entry) {
  try {
    const owner = await member.client.users.fetch(entry.userId).catch(() => null);
    if (owner) {
      await owner.send(
        `Your invite ${entry.inviteURL} for **${member.guild.name}** has reached the limit (${entry.maxJoins}/${entry.maxJoins}) and was deleted.\nRun \`.link\` to create a new one.`
      );
    }
  } catch (e) {
    console.log(tag("personal-invite") + rose(` could not DM owner ${entry.userId}: ${e.message}`));
  }
}

async function logToChannel(member, entry, updated) {
  try {
    const channel = await member.client.channels.fetch(INVITE_LOG_CHANNEL_ID).catch(() => null);
    if (!channel?.send) return;
    await channel.send(
      `[personal-invite] ${member.user.tag} joined via ${entry.userId}'s invite — ${updated.joins}/${updated.maxJoins}${updated.joins >= updated.maxJoins ? " · invite deleted" : ""}`
    );
  } catch (e) {
    console.log(tag("personal-invite") + rose(` could not log invite event: ${e.message}`));
  }
}

module.exports = { handlePersonalInviteJoin };
