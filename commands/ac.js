const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, ALLOWED_ROLE_ID, OWNER_ROLE_ID, MSG } = require("../config");
const { getGrants } = require("../inviteTracker");

module.exports = {
  name: "ac",
  aliases: [],
  description: "show all access grant logs",
  guildOnly: true,
  async execute(message, args) {
    const allowedRoles = [OWNER_ROLE_ID, ADMIN_ROLE_ID].filter(Boolean);
    if (!message.member?.roles?.cache?.some(r => allowedRoles.includes(r.id))) {
      await message.reply(MSG.no_permission);
      return;
    }

    const grants = getGrants();
    if (grants.length === 0) {
      await message.reply("No access grants recorded yet.");
      return;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**ACCESS LOGS** — ${grants.length} total`)
      )
      .addSeparatorComponents(new SeparatorBuilder());

    for (const g of grants.slice(0, 20)) {
      const date = `<t:${Math.floor(g.timestamp / 1000)}:f>`;
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**admin :** ${g.adminTag}\n**user :** ${g.userTag} — ${date}`)
      );
    }

    if (grants.length > 20) {
      container.addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# showing 20 of ${grants.length} entries`)
        );
    }

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
