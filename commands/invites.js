const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const { getInvite } = require("../personalInvites");
const { getGuildActiveInvites } = require("../inviteTracker");

const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

function resolveTarget(message, args) {
  const mentioned = message.mentions.users.first();
  if (mentioned) return mentioned;

  const raw = args[0]?.replace(/[<@!>]/g, "");
  if (raw && /^\d{16,22}$/.test(raw)) {
    return { id: raw, username: `User ${raw}`, displayAvatarURL: () => null };
  }

  return message.author;
}

module.exports = {
  name: "invites",
  aliases: ["i", "invite", "myinvites"],
  description: "show personal invite stats and active server joins (no pings)",
  guildOnly: true,
  async execute(message, args) {
    const target = resolveTarget(message, args);
    const entry = await getInvite(message.guild.id, target.id).catch(() => null);

    const { activeCount, activeMembers, leftMembers } = await getGuildActiveInvites(
      message.guild,
      target.id
    );

    const isSelf = target.id === message.author.id;
    const displayName = target.displayName || target.username || `User ${target.id}`;
    const title = `✦ ${isSelf ? "Your" : `${displayName}'s`} Invite Stats`;

    const headerSection = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${title}**`)
    );

    if (target.displayAvatarURL) {
      const avatar = target.displayAvatarURL({ size: 128 });
      if (avatar) {
        headerSection.setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatar).setDescription("avatar")
        );
      }
    }

    let statsText = `• **Server:** ${message.guild.name}\n`;

    if (!entry) {
      statsText += `• **Invite Link:** None\n`;
      if (isSelf) statsText += `-# Run .link to create your personal invite link.\n`;
    } else if (entry.active) {
      statsText += `• **Invite Link:** ${entry.inviteURL}\n`;
      statsText += `• **Link Joins:** ${entry.joins}/${entry.maxJoins}\n`;
      statsText += `• **Link Status:** Active\n`;
    } else {
      statsText += `• **Invite Link:** Completed / Expired\n`;
      statsText += `• **Link Joins:** ${entry.joins}/${entry.maxJoins}\n`;
      statsText += `• **Link Status:** Completed\n`;
    }

    const accessStatus = activeCount >= 2 ? "Unlocked" : `Locked (need ${Math.max(0, 2 - activeCount)} more)`;
    statsText += `• **Active Server Invites:** ${activeCount} / 2\n`;
    statsText += `• **Quest Access:** ${accessStatus}\n`;

    let usersText = `**Invited Members (${activeMembers.length + leftMembers.length}):**\n`;
    if (activeMembers.length > 0 || leftMembers.length > 0) {
      const lines = [];
      for (const id of activeMembers) {
        const member = message.guild.members?.cache?.get(id);
        const name = member ? (member.displayName || member.user?.username) : null;
        lines.push(name ? `• **${name}** (\`${id}\`) — active` : `• User \`${id}\` — active`);
      }
      for (const id of leftMembers) {
        const member = message.guild.members?.cache?.get(id);
        const name = member ? (member.displayName || member.user?.username) : null;
        lines.push(name ? `• **${name}** (\`${id}\`) — *(left)*` : `• User \`${id}\` — *(left)*`);
      }
      usersText += lines.join("\n");
    } else {
      usersText += `-# No members currently invited in this server.`;
    }

    if (usersText.length > 3900) {
      usersText = usersText.slice(0, 3900) + "\n-# ...and more";
    }

    const container = new ContainerBuilder()
      .addSectionComponents(headerSection)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsText))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(usersText));

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: NO_MENTIONS,
    });
  },
};
