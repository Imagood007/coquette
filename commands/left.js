const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, ALLOWED_ROLE_ID, OWNER_ROLE_ID, OWNER_ID: CONFIG_OWNER_ID, MSG, tag, mint, rose, isPremium } = require("../config");
const { getInvitesOf, getAllInvitedBy, removeInvited } = require("../inviteTracker");
const { getInvite, decrementJoins } = require("../personalInvites");

const OWNER_ID = CONFIG_OWNER_ID || "";
const ADMIN_ROLE_ACCESS_ID = OWNER_ROLE_ID || ADMIN_ROLE_ID || "";

module.exports = {
  name: "left",
  aliases: ["checkleft", "invitecheck"],
  description: "check members with access role and remove it if their invites left",
  guildOnly: true,
  async execute(message, args) {
    const isAuthorized =
      message.author.id === OWNER_ID ||
      message.member?.roles?.cache?.has(ADMIN_ROLE_ACCESS_ID);

    if (!isAuthorized) {
      await message.reply(MSG.no_permission || "No permission.");
      return;
    }

    const statusMsg = await message.reply("⏳ Checking members with the access role... Please wait.").catch(() => null);

    // Fetch all guild members to ensure cache is completely up to date
    await message.guild.members.fetch().catch((e) => {
      console.error(tag("left") + rose(` failed to fetch guild members: ${e.message}`));
    });

    const membersWithRole = message.guild.members.cache.filter(
      (m) => !m.user.bot && m.roles.cache.has(ALLOWED_ROLE_ID)
    );

    let removedCount = 0;
    let keptCount = 0;
    let skippedCount = 0;
    const removedList = [];

    for (const [, member] of membersWithRole) {
      // Skip owner and admins with the role
      if (
        member.id === OWNER_ID ||
        member.roles.cache.has(ADMIN_ROLE_ACCESS_ID)
      ) {
        skippedCount++;
        continue;
      }

      // Collect all recorded invited user IDs for this member
      const historyInvites = getAllInvitedBy(member.id);
      const normalInvites = getInvitesOf(member.id);
      const pInvite = await getInvite(member.id).catch(() => null);
      const personalInvites = Array.isArray(pInvite?.joinedUserIds) ? pInvite.joinedUserIds : [];

      const allInvited = new Set([...historyInvites, ...normalInvites, ...personalInvites]);

      let activeCount = 0;
      const leftIds = [];

      for (const invitedId of allInvited) {
        if (invitedId === member.id) continue;
        if (message.guild.members.cache.has(invitedId)) {
          activeCount++;
        } else {
          leftIds.push(invitedId);
          // Clean up stale entries from files
          removeInvited(invitedId);
          await decrementJoins(member.id, invitedId).catch(() => {});
        }
      }

      // Access requires at least 2 active invites still present in the server
      if (activeCount < 2) {
        try {
          await member.roles.remove(ALLOWED_ROLE_ID, "Invited users left the server");
          removedCount++;
          removedList.push({ id: member.id, tag: member.user.tag, activeCount, leftCount: leftIds.length });
          console.log(tag("left") + rose(` removed access from ${member.user.tag} (${member.id}) — ${activeCount}/2 active invites`));
          // Small delay between role updates to prevent rate limiting
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          console.error(tag("left") + rose(` error removing role from ${member.id}: ${e.message}`));
        }
      } else {
        keptCount++;
      }
    }

    let summaryText =
      `**✦ Invite Check Completed**\n\n` +
      `• **Role Checked:** <@&${ALLOWED_ROLE_ID}>\n` +
      `• **Total Checked:** ${membersWithRole.size}\n` +
      `• **Access Removed:** ${removedCount} (invites left or < 2 active)\n` +
      `• **Access Kept:** ${keptCount} (2+ active invites)\n` +
      `• **Skipped (Staff/Owner):** ${skippedCount}`;

    if (removedList.length > 0) {
      summaryText += "\n\n**Removed Members:**\n";
      for (const item of removedList.slice(0, 15)) {
        summaryText += `• <@${item.id}> (\`${item.tag}\`) — ${item.activeCount}/2 invites active\n`;
      }
      if (removedList.length > 15) {
        summaryText += `-# ...and ${removedList.length - 15} more members`;
      }
    }

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(summaryText)
    );

    if (statusMsg) {
      await statusMsg.edit({ content: null, components: [container], flags: MessageFlags.IsComponentsV2 }).catch(async () => {
        await statusMsg.edit({ content: summaryText, components: [] }).catch(() => {});
      });
    } else {
      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(async () => {
        await message.reply(summaryText).catch(() => {});
      });
    }
  },
};
