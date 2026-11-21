const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { buildGuideComponents } = require("../handlers");

const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

module.exports = {
  name: "guide",
  aliases: ["tutorial", "howto", "tokenguide"],
  description: "How to extract your Discord token using the bookmarklet",
  guildOnly: false,
  async execute(message) {
    try {
      await message.reply({
        components: buildGuideComponents(),
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: NO_MENTIONS,
      });
    } catch (_) {
      const embed = new EmbedBuilder()
        .setColor(0xffb6c1)
        .setTitle("HOW TO FIND YOUR TOKEN")
        .setDescription("Pick your platform below to view the tutorial bookmarklet and video guide.");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("btn_guide_pc").setLabel("ᝰ.ᐟ  PC").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("btn_guide_android").setLabel("⨾𓍢ִ໋Android").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("btn_guide_ios").setLabel(".✦ ݁˖  iOS").setStyle(ButtonStyle.Secondary)
      );

      await message.reply({
        embeds: [embed],
        components: [row],
        allowedMentions: NO_MENTIONS,
      }).catch(() => {});
    }
  },
};
