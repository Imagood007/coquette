const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const {
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  isGuildAdmin,
} = require("../guildConfig");
const { MSG } = require("../config");

const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

function buildSetupPanel(guild, notice = null) {
  const cfg = getGuildConfig(guild.id);
  const channelId = cfg.questChannelId;
  const roleId = cfg.questAccessRoleId;

  const role = roleId ? guild.roles?.cache?.get(roleId) : null;
  const roleDisplay = role ? `@${role.name} (\`${roleId}\`)` : roleId ? `\`${roleId}\`` : "*Not configured*";
  const channel = channelId ? guild.channels?.cache?.get(channelId) : null;
  const channelDisplay = channel ? `#${channel.name} (\`${channelId}\`)` : channelId ? `<#${channelId}>` : "*Not configured*";

  const container = new ContainerBuilder();

  if (notice) {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`✦ **${notice}**`)
      )
      .addSeparatorComponents(new SeparatorBuilder());
  }

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✦ **Server Setup — ${guild.name}**\n` +
        `Configure the quest automation bot for this server.\n\n` +
        `• **Server ID:** \`${guild.id}\`\n` +
        `• **Quest Channel:** ${channelDisplay}\n` +
        `• **Quest Access Role:** ${roleDisplay}\n\n` +
        `**Quick Subcommands:**\n` +
        `• Set Channel: \`.setup channel #channel\` or \`.setup channel <channelId>\`\n` +
        `• Set Role: \`.setup role @role\` or \`.setup role <roleId>\`\n` +
        `• Reset: \`.setup reset\`\n\n` +
        `-# Users in this server can use: .q, .p, .link, .i, .status (.s)`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn_setup_channel")
          .setLabel("Set Quest Channel")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("btn_setup_role")
          .setLabel("Set Quest Role")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("btn_setup_reset")
          .setLabel("Reset Config")
          .setStyle(ButtonStyle.Secondary)
      )
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function resolveChannel(guild, input) {
  if (!input) return null;
  const clean = input.replace(/[<#!>]/g, "").trim();
  let ch = guild.channels?.cache?.get(clean);
  if (!ch && /^\d+$/.test(clean)) {
    ch = await guild.channels?.fetch?.(clean).catch(() => null);
  }
  if (!ch && guild.channels?.cache) {
    ch = guild.channels.cache.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase() && c.isTextBased?.()
    );
  }
  return ch && ch.isTextBased?.() ? ch : null;
}

async function resolveRole(guild, input) {
  if (!input) return null;
  const clean = input.replace(/[<@&!>]/g, "").trim();
  let r = guild.roles?.cache?.get(clean);
  if (!r && /^\d+$/.test(clean)) {
    r = await guild.roles?.fetch?.(clean).catch(() => null);
  }
  if (!r && guild.roles?.cache) {
    r = guild.roles.cache.find(
      (ro) => ro.name.toLowerCase() === clean.toLowerCase()
    );
  }
  return r || null;
}

async function sendSetupReply(message, panel, fallbackText) {
  try {
    await message.reply({
      components: panel.components,
      flags: panel.flags,
      allowedMentions: NO_MENTIONS,
    });
  } catch (err) {
    console.error("[setup command] error sending Components V2:", err?.message);
    await message.reply({
      content: fallbackText,
      allowedMentions: NO_MENTIONS,
    }).catch(() => {});
  }
}

module.exports = {
  name: "setup",
  aliases: ["set"],
  description: "Configure quest channel and quest access role (Components V2, no emojis, no pings)",
  guildOnly: true,
  async execute(message, args) {
    if (!isGuildAdmin(message.member)) {
      await message.reply({ content: MSG.no_permission, allowedMentions: NO_MENTIONS });
      return;
    }

    const sub = args[0]?.toLowerCase();

    // 1. Set channel subcommand: .setup channel #channel, .setup channel <id>, .setup ch <name>
    if (sub === "channel" || sub === "ch") {
      const raw = args[1];
      if (!raw) {
        await message.reply({
          content: "Usage: `.setup channel #channel` or `.setup channel <channelId>`",
          allowedMentions: NO_MENTIONS,
        });
        return;
      }

      const targetChannel = await resolveChannel(message.guild, raw);
      if (!targetChannel) {
        await message.reply({
          content: "Could not find that text channel in this server.",
          allowedMentions: NO_MENTIONS,
        });
        return;
      }

      setGuildConfig(message.guild.id, { questChannelId: targetChannel.id });
      const notice = `Quest channel updated to #${targetChannel.name} (\`${targetChannel.id}\`).`;
      const panel = buildSetupPanel(message.guild, notice);
      await sendSetupReply(
        message,
        panel,
        `✦ **${notice}**\n• Quest Channel: #${targetChannel.name} (\`${targetChannel.id}\`)`
      );
      return;
    }

    // 2. Set role subcommand: .setup role @role, .setup role <id>, .setup role <name>
    if (sub === "role") {
      const raw = args[1];
      if (!raw) {
        await message.reply({
          content: "Usage: `.setup role @role` or `.setup role <roleId>`",
          allowedMentions: NO_MENTIONS,
        });
        return;
      }

      const targetRole = await resolveRole(message.guild, raw);
      if (!targetRole) {
        await message.reply({
          content: "Could not find that role in this server.",
          allowedMentions: NO_MENTIONS,
        });
        return;
      }

      setGuildConfig(message.guild.id, { questAccessRoleId: targetRole.id });
      const notice = `Quest access role updated to @${targetRole.name} (\`${targetRole.id}\`).`;
      const panel = buildSetupPanel(message.guild, notice);
      await sendSetupReply(
        message,
        panel,
        `✦ **${notice}**\n• Quest Access Role: @${targetRole.name} (\`${targetRole.id}\`)`
      );
      return;
    }

    // 3. Reset subcommand: .setup reset
    if (sub === "reset") {
      resetGuildConfig(message.guild.id);
      const notice = "Server configuration has been reset.";
      const panel = buildSetupPanel(message.guild, notice);
      await sendSetupReply(
        message,
        panel,
        `✦ **${notice}**\n• Run \`.setup channel #channel\` to configure a quest channel.`
      );
      return;
    }

    // 4. Direct channel input: user typed `.setup #general` or `.setup <channelId>`
    if (args[0]) {
      const directChannel = await resolveChannel(message.guild, args[0]);
      if (directChannel) {
        setGuildConfig(message.guild.id, { questChannelId: directChannel.id });
        const notice = `Quest channel updated to #${directChannel.name} (\`${directChannel.id}\`).`;
        const panel = buildSetupPanel(message.guild, notice);
        await sendSetupReply(
          message,
          panel,
          `✦ **${notice}**\n• Quest Channel: #${directChannel.name} (\`${directChannel.id}\`)`
        );
        return;
      }

      // Direct role input: user typed `.setup @role` or `.setup <roleId>`
      const directRole = await resolveRole(message.guild, args[0]);
      if (directRole) {
        setGuildConfig(message.guild.id, { questAccessRoleId: directRole.id });
        const notice = `Quest access role updated to @${directRole.name} (\`${directRole.id}\`).`;
        const panel = buildSetupPanel(message.guild, notice);
        await sendSetupReply(
          message,
          panel,
          `✦ **${notice}**\n• Quest Access Role: @${directRole.name} (\`${directRole.id}\`)`
        );
        return;
      }
    }

    // Default: Show Setup Panel
    const panel = buildSetupPanel(message.guild);
    await sendSetupReply(
      message,
      panel,
      `✦ **Server Setup — ${message.guild.name}**\n• Configure via \`.setup channel #channel\` and \`.setup role @role\``
    );
  },
  buildSetupPanel,
  resolveChannel,
  resolveRole,
};
