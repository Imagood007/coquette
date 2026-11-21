const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { PREMIUM_ROLE_ID } = require("../config");
const { getPremiumInfo } = require("../premiumTracker");

module.exports = {
  name: "check",
  aliases: [],
  description: "check your premium remaining time",
  guildOnly: true,
  async execute(message, args) {
    const hasRole = message.member?.roles?.cache?.has(PREMIUM_ROLE_ID);
    const info = getPremiumInfo(message.author.id);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          info && hasRole
            ? `**PREMIUM** — ${message.author.tag}\n**expires :** <t:${Math.floor(info.expiresAt / 1000)}:R> (<t:${Math.floor(info.expiresAt / 1000)}:f>)`
            : `**PREMIUM** — ${message.author.tag}\n-# no active premium`
        )
      );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
