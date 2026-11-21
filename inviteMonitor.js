const { recordInvites } = require("./inviteTracker");

// A normal invite can be attributed by comparing its use count before and
// after a member joins. Vanity-link joins do not expose an inviter.
const guildInviteSnapshots = new Map();

async function snapshotGuildInvites(guild) {
  const invites = await guild.invites.fetch();
  const snapshot = new Map();
  for (const invite of invites.values()) {
    snapshot.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviterId ?? invite.inviter?.id ?? null,
    });
  }
  guildInviteSnapshots.set(guild.id, snapshot);
  return snapshot;
}

async function findUsedInvite(member) {
  const previous = guildInviteSnapshots.get(member.guild.id);
  let current;
  try {
    current = await snapshotGuildInvites(member.guild);
  } catch (error) {
    console.warn(`[invite] could not fetch invites for ${member.guild.id}: ${error.message}`);
    return null;
  }

  // On the first join after a restart there is no safe baseline to compare.
  if (!previous) return null;

  const usedInvite = [...current.entries()].find(([code, invite]) =>
    invite.uses > (previous.get(code)?.uses ?? 0)
  );

  if (!usedInvite) return null;
  const [code, invite] = usedInvite;
  return { code, ...invite };
}

async function trackMemberInvite(member, usedInvite = null) {
  const used = usedInvite ?? (await findUsedInvite(member));
  if (!used?.inviterId || used.inviterId === member.id) return null;
  recordInvites(used.inviterId, [member.id]);
  console.log(`[invite] tracked ${member.user.tag} for inviter ${used.inviterId}`);
  return used.inviterId;
}

module.exports = { snapshotGuildInvites, findUsedInvite, trackMemberInvite };
