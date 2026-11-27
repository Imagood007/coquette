const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, ContainerBuilder, TextDisplayBuilder,
} = require("discord.js");
const fs                                                            = require("fs");
const path                                                          = require("path");
const { MSG, tag, pink, hasAccess, isPremium }                      = require("../config");

const { buildQuestComponents }                                      = require("../handlers");
const { setCommandsEnabled }                                        = require("../commandState");
const { getQuestChannelId, getQuestAccessRoleId, isGuildAdmin, MAIN_SERVER_ID } = require("../guildConfig");

module.exports = {
  name:        "quest",
  aliases:     ["q"],
  description: "start a quest farming session",
  guildOnly:   true,
  async execute(message, args) {
    if (args[0] === "enable") {
      setCommandsEnabled(true);
      await message.reply("Commands enabled.");
      return;
    }
    if (args[0] === "disable") {
      setCommandsEnabled(false);
      await message.reply("Commands disabled.");
      return;
    }

    const targetChannelId = getQuestChannelId(message.guild.id);
    if (targetChannelId && message.channel.id !== targetChannelId) {
      await message.reply({
        content: `✦ Do quest in the configured quest channel: <#${targetChannelId}>`,
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      }).catch(() => {});
      return;
    }

    if (!targetChannelId && message.guild.id !== MAIN_SERVER_ID) {
      if (isGuildAdmin(message.member)) {
        const { buildSetupPanel } = require("./setup");
        const panel = buildSetupPanel(
          message.guild,
          "Quest channel is not configured yet. Configure it below to enable quests:"
        );
        await message.reply({
          components: panel.components,
          flags: panel.flags,
          allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        }).catch(async () => {
          await message.reply({
            content: "✦ Quest channel is not configured yet. Run `.setup` to configure it.",
            allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
          }).catch(() => {});
        });
      } else {
        await message.reply({
          content: "✦ Quest bot is not configured in this server yet. Please ask a server admin to run `.setup`.",
          allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        }).catch(() => {});
      }
      return;
    }

    if (!hasAccess(message.member)) {
      await message.reply({
        content: MSG.no_access,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("btn_personal_invite_link")
              .setLabel("link")
              .setStyle(ButtonStyle.Secondary)
          ),
        ],
        allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
      });
      return;
    }
    console.log(tag("quest") + pink(` sent to ${message.author.tag}`));

    // Cross-server check: ensure main server member is cached for premium role check
    if (message.guild?.id !== MAIN_SERVER_ID) {
      const mainGuild = message.client?.guilds?.cache?.get(MAIN_SERVER_ID);
      if (mainGuild && !mainGuild.members?.cache?.has(message.author.id)) {
        await mainGuild.members.fetch(message.author.id).catch(() => null);
      }
    }
const components = await buildQuestComponents(message.author.id, message.member);
    await message.reply({ components, flags: MessageFlags.IsComponentsV2 });
  },
};
