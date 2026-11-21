const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { PERSONAL_INVITE_COOLDOWN_MS, tag, mint, rose } = require("../config");
const { getInvite, createInvite } = require("../personalInvites");
const { createPersonalInvite } = require("../inviteHelper");

const cooldowns = new Map();

module.exports = {
  name: "link",
  aliases: [],
  description: "create your personal invite link (max 2 joins)",
  guildOnly: true,
  async execute(message) {
    const cooldownKey = `${message.guild.id}:${message.author.id}`;
    const cooldownLeft = (cooldowns.get(cooldownKey) || 0) + PERSONAL_INVITE_COOLDOWN_MS - Date.now();
    if (cooldownLeft > 0) {
      await message.reply(`You're going too fast. Try again in ${Math.ceil(cooldownLeft / 1000)}s.`);
      return;
    }
    cooldowns.set(cooldownKey, Date.now());

    const existing = await getInvite(message.guild.id, message.author.id).catch(() => null);
    if (existing && existing.active) {
      const liveInvite = await message.client.fetchInvite(existing.inviteCode).catch(() => null);
      if (liveInvite && liveInvite.guild?.id === message.guild.id) {
        const container = new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `✦ **Your Active Invite**\n\n` +
            `• **Server:** ${message.guild.name}\n` +
            `• **Link:** ${existing.inviteURL}\n` +
            `• **Joins:** ${existing.joins}/${existing.maxJoins}\n\n` +
            `-# Share this invite. Once 2 people join through it, you automatically get quest access.`
          )
        );

        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
    }

    try {
      const invite = await createPersonalInvite(message.guild, message.channel.id, message.author);
      const url = `https://discord.gg/${invite.code}`;
      const entry = await createInvite(message.guild.id, message.author.id, invite.code, url);

      console.log(tag("personal-invite") + mint(` ${message.author.tag} created invite ${invite.code} in ${message.guild.name}`));

      const container = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✦ **Personal Invite Created**\n\n` +
          `• **Server:** ${message.guild.name}\n` +
          `• **Link:** ${url}\n` +
          `• **Joins:** 0/${entry.maxJoins}\n\n` +
          `-# Once 2 people join through your link, you will automatically get quest access.`
        )
      );

      await message.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (e) {
      console.error(tag("personal-invite") + rose(` create failed for ${message.author.id} in ${message.guild.name}: ${e.message}`));
      if (e.code === 30016) {
        await message.reply("The server reached Discord's maximum invite limit (1,000). Please try again in a moment.");
      } else {
        await message.reply(`Could not create invite: ${e.message}`);
      }
    }
  },
};
