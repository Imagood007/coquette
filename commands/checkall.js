const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, MSG } = require("../config");
const { getAllPremium } = require("../premiumTracker");

module.exports = {
  name: "checkall",
  aliases: [],
  description: "show all premium users with expiry",
  guildOnly: true,
  async execute(message, args) {
    if (!message.member?.roles?.cache?.has(ADMIN_ROLE_ID)) {
      await message.reply(MSG.no_permission);
      return;
    }

    const all = getAllPremium();
    if (all.length === 0) {
      await message.reply("No premium users.");
      return;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**PREMIUM USERS** — ${all.length} total`)
      )
      .addSeparatorComponents(new SeparatorBuilder());

    for (const p of all.slice(0, 20)) {
      const expiry = `<t:${Math.floor(p.expiresAt / 1000)}:R>`;
      const granted = `<t:${Math.floor(p.grantedAt / 1000)}:f>`;
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`\`${p.userId}\`\n**expires :** ${expiry}\n**granted :** ${granted}`)
      );
    }

    if (all.length > 20) {
      container.addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# showing 20 of ${all.length} entries`)
        );
    }

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
