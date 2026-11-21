// commands/rate.js
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags,
} = require("discord.js");

const { OWNER_ID: CONFIG_OWNER_ID, STAFF_ROLE_ID: CONFIG_STAFF_ROLE_ID } = require("../config");

const STAFF_ROLE_ID = CONFIG_STAFF_ROLE_ID || "";
const OWNER_ID      = CONFIG_OWNER_ID || "";

module.exports = {
  name: "rate",
  aliases: ["vouch", "review"],
  description: "Rate a staff member with 1–5 stars",
  guildOnly: true,
  async execute(message, args) {
    const target = message.mentions.members?.first();

    if (!target) {
      await message.reply("Please mention a staff member to rate. Example: `.rate @staffmember`");
      return;
    }

    if (target.id === message.author.id) {
      await message.reply("You can't rate yourself.");
      return;
    }

    if (!target.roles.cache.has(STAFF_ROLE_ID)) {
      await message.reply("That user is not a staff member.");
      return;
    }

    const staffName = target.displayName;
    const staffAvatar = target.user.displayAvatarURL({ size: 64 });

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**✦ Rate Staff**\n` +
          `Rate **${staffName}** — click a star below to submit your rating\n` +
          `-# You can change your rating at any time`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_rate:${target.id}:1`)
            .setLabel("✦ 1")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`btn_rate:${target.id}:2`)
            .setLabel("✦ 2")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`btn_rate:${target.id}:3`)
            .setLabel("✦ 3")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`btn_rate:${target.id}:4`)
            .setLabel("✦ 4")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`btn_rate:${target.id}:5`)
            .setLabel("✦ 5")
            .setStyle(ButtonStyle.Primary),
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Rating **${staffName}** (${target.id})`)
      );

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
