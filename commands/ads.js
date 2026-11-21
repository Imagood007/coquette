const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { OWNER_ID } = require("../config");

module.exports = {
  name: "ads",
  description: "Set up the ad to show before quests",
  guildOnly: true,
  async execute(message, args) {
    if (message.author.id !== OWNER_ID && message.author.id !== "806113872620421140") {
      return message.reply("You do not have permission to use this command.");
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_ads_setup")
        .setLabel("Set Up Ad")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("btn_ads_clear")
        .setLabel("Clear Ad")
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ content: "Click the button below to set up the ad:", components: [row] });
  },
};
