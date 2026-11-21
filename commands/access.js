const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, ALLOWED_ROLE_ID, OWNER_ROLE_ID, MSG, tag, mint, dim, hasAccess } = require("../config");
const { recordInvites, recordGrant } = require("../inviteTracker");

module.exports = {
  name: "access",
  aliases: [],
  description: "grant quest access to a user with invited persons tracking",
  guildOnly: true,
  async execute(message, args) {
    const allowedRoles = [OWNER_ROLE_ID, ADMIN_ROLE_ID].filter(Boolean);
    if (!message.member?.roles?.cache?.some(r => allowedRoles.includes(r.id))) {
      await message.reply(MSG.no_permission);
      return;
    }

    const mentionIds = [...message.content.matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
    if (mentionIds.length < 1) {
      await message.reply("Usage: `.access @inviter @invite1 @invite2 ...`");
      return;
    }

    const inviterId = mentionIds.shift();
    const inviter = await message.guild.members.fetch(inviterId).catch(() => null);
    if (!inviter) {
      await message.reply("Inviter is not in this server.");
      return;
    }

    if (inviter.roles.cache.has(ALLOWED_ROLE_ID)) {
      await message.reply(`${inviter.user.tag} already has access.`);
      return;
    }

    const invitedMembers = [];
    const invitedLines = [];
    for (const id of mentionIds) {
      const m = await message.guild.members.fetch(id).catch(() => null);
      if (m) {
        invitedMembers.push(m);
        const joined = m.joinedAt ? `<t:${Math.floor(m.joinedAt.getTime() / 1000)}:f>` : "unknown";
        invitedLines.push(`↳ ${m.user.tag.toUpperCase()} [${joined}]`);
      }
    }

    await inviter.roles.add(ALLOWED_ROLE_ID);
    recordGrant(message.author.id, message.author.tag, inviter.id, inviter.user.tag);

    if (invitedMembers.length > 0) {
      recordInvites(inviter.id, invitedMembers.map(m => m.id));
    }

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**admin :** ${message.author}`),
            new TextDisplayBuilder().setContent(`**inviter :** ${inviter.user.tag} [<t:${Math.floor(inviter.joinedAt.getTime() / 1000)}:f>]`),
            new TextDisplayBuilder().setContent(invitedLines.length > 0 ? `**invites**\n${invitedLines.join("\n")}` : "**invites**\n-# none"),
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ size: 64 })).setDescription("admin avatar")
          )
      );

    console.log(tag("access") + mint(` granted to ${inviter.user.tag}`) + dim(` by ${message.author.tag}${invitedMembers.length > 0 ? ` · ${invitedMembers.length} tracked` : ""}`));
    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
