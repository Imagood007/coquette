const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { ADMIN_ROLE_ID, MSG } = require("../config");

function buildStaffPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xffb6c1)
    .setTitle("Staff Application")
    .setDescription("Click the button below to fill the staff application form.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_apply_open")
      .setLabel("Apply for Staff")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  name:        "staff",
  aliases:     [],
  description: "open or post the staff application form",
  guildOnly:   true,
  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();

    if (sub === "set" && action === "channel") {
      if (!message.member?.roles?.cache?.has(ADMIN_ROLE_ID)) {
        await message.reply(MSG.no_permission);
        return;
      }

      const targetChannel = message.mentions.channels.first() ?? message.channel;
      await targetChannel.send(buildStaffPanel());
      await message.reply(`staff application panel sent to ${targetChannel}.`);
      return;
    }

    await message.reply(buildStaffPanel());
  },
};
