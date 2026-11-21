const { ALLOWED_ROLE_ID, MAIN_SERVER_ID, tag, mint } = require("./config");
const { getQuestAccessRoleId } = require("./guildConfig");
const { getGuildActiveInvites, recordGrant } = require("./inviteTracker");

/**
 * Called after a new member joins or when checking invite eligibility.
 * Automatically grants quest access once the inviter has 2 invited
 * members currently present in the server.
 */
async function maybeAutoGrant(memberOrGuild, inviterId) {
  if (!inviterId) return false;

  const guild = memberOrGuild.guild || memberOrGuild;
  if (!guild) return false;

  const inviter = await guild.members.fetch(inviterId).catch(() => null);
  if (!inviter || inviter.user?.bot) return false;

  // Determine access role for this guild
  const accessRoleId =
    guild.id === MAIN_SERVER_ID
      ? ALLOWED_ROLE_ID
      : getQuestAccessRoleId(guild.id);

  if (!accessRoleId) {
    return false;
  }

  const { activeCount } = await getGuildActiveInvites(guild, inviterId);

  if (activeCount < 2) return false;

  if (inviter.roles.cache.has(accessRoleId)) return true;

  try {
    await inviter.roles.add(accessRoleId);
    recordGrant("auto-access", "Auto Access", inviterId, inviter.user.tag);
    console.log(tag("access") + mint(` auto-granted access to ${inviter.user.tag} in ${guild.name}`) + ` · ${activeCount} active invites`);
    await inviter.send(`You invited **${activeCount} active members** in **${guild.name}** — quest bot access unlocked! Use \`.q\` to start farming.`).catch(() => {});
    return true;
  } catch (err) {
    console.error(`[access] failed to add role ${accessRoleId} to ${inviter.user.tag} in ${guild.name}: ${err.message}`);
    return false;
  }
}

module.exports = { maybeAutoGrant };
