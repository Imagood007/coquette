const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, MSG, OWNER_ROLE_ID, OWNER_ID } = require("../config");
const { setMaintenance, isUnderMaintenance } = require("../maintenanceState");

module.exports = {
  name: "main",
  aliases: ["maintenance"],
  description: ".main on / .main off — toggle maintenance mode (owner only)",
  guildOnly: true,
  async execute(message, args) {
    const member = message.member || (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);
    const isOwner =
      message.author.id === OWNER_ID ||
      member?.roles?.cache?.has(OWNER_ROLE_ID);

    if (!isOwner) {
      await message.reply(MSG.no_permission);
      return;
    }

    const sub = args[0]?.toLowerCase();
    if (sub !== "on" && sub !== "off") {
      await message.reply("Usage: `.main on` or `.main off`");
      return;
    }

    const enabled = sub === "on";
    setMaintenance(enabled);

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          enabled
            ? "**maintenance mode enabled** — all commands are now disabled"
            : "**maintenance mode disabled** — commands are back online"
        )
      );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
