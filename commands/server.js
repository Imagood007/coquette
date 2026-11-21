const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { OWNER_ID, MAIN_SERVER_ID } = require("../config");

const BOT_OWNER_ID = OWNER_ID;
const ITEMS_PER_PAGE = 5;
const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

async function resolvePageOwners(client, slice, ownerCache) {
  const uncachedGuilds = slice.filter((g) => g.ownerId && !ownerCache.has(g.ownerId));
  if (!uncachedGuilds.length) return;

  await Promise.all(
    uncachedGuilds.map(async (guild) => {
      const ownerId = guild.ownerId;
      const cached = client.users.cache.get(ownerId);
      if (cached) {
        ownerCache.set(ownerId, { tag: cached.tag || cached.username, id: ownerId });
        return;
      }
      try {
        const user = await client.users.fetch(ownerId).catch(() => null);
        ownerCache.set(ownerId, {
          tag: user ? user.tag || user.username : "Unknown",
          id: ownerId,
        });
      } catch {
        ownerCache.set(ownerId, { tag: "Unknown", id: ownerId });
      }
    })
  );
}

function buildServerPanel({
  client,
  guilds,
  page,
  totalPages,
  totalMembers,
  ownerCache,
  notice = null,
  disabled = false,
}) {
  const start = page * ITEMS_PER_PAGE;
  const currentSlice = guilds.slice(start, start + ITEMS_PER_PAGE);
  const container = new ContainerBuilder();

  if (notice) {
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✦ **${notice}**`))
      .addSeparatorComponents(new SeparatorBuilder());
  }

  const avatarUrl =
    client.user?.displayAvatarURL?.({ size: 128 }) || "https://cdn.discordapp.com/embed/avatars/0.png";

  const headerSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✦ **Bot Guilds & Stats**\n` +
        `• Total Guilds: **${guilds.length}** · Total Members: **${totalMembers.toLocaleString()}**\n` +
        `• Showing: **${guilds.length ? start + 1 : 0}**–**${Math.min(start + ITEMS_PER_PAGE, guilds.length)}** of **${guilds.length}**`
      )
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(avatarUrl).setDescription("bot avatar")
    );

  container
    .addSectionComponents(headerSection)
    .addSeparatorComponents(new SeparatorBuilder());

  if (currentSlice.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("*No servers found.*"));
  } else {
    for (let i = 0; i < currentSlice.length; i++) {
      const guild = currentSlice[i];
      const rank = `#${start + i + 1}`;
      const ownerInfo = ownerCache.get(guild.ownerId) || { tag: "Unknown", id: guild.ownerId };
      const isMain = guild.id === MAIN_SERVER_ID;

      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `\`${rank}\` **${guild.name}** (\`${guild.id}\`)\n` +
            `↳ Members: **${(guild.memberCount || 0).toLocaleString()}** · Owner: \`${ownerInfo.tag}\` (\`${guild.ownerId}\`)`
          )
        )
        .setButtonAccessory(
          isMain
            ? new ButtonBuilder()
                .setCustomId("btn_leave_main")
                .setLabel("Main Server")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            : new ButtonBuilder()
                .setCustomId(`btn_leave_${guild.id}`)
                .setLabel("Remove")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled)
        );

      container.addSectionComponents(section);
      if (i < currentSlice.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    }
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn_srv_prev")
          .setLabel("◀ Prev")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 0),
        new ButtonBuilder()
          .setCustomId("btn_srv_page")
          .setLabel(`${page + 1} / ${Math.max(1, totalPages)}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("btn_srv_next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page >= totalPages - 1)
      )
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

function buildFallbackPayload({
  guilds,
  page,
  totalPages,
  totalMembers,
  ownerCache,
  notice = null,
  disabled = false,
}) {
  const start = page * ITEMS_PER_PAGE;
  const currentSlice = guilds.slice(start, start + ITEMS_PER_PAGE);

  const lines = currentSlice.map((guild, idx) => {
    const rank = `#${start + idx + 1}`;
    const ownerInfo = ownerCache.get(guild.ownerId) || { tag: "Unknown", id: guild.ownerId };
    return `\`${rank}\` **${guild.name}** (\`${guild.id}\`)\n↳ Members: **${(guild.memberCount || 0).toLocaleString()}** · Owner: \`${ownerInfo.tag}\` (\`${guild.ownerId}\`)`;
  });

  let content = "";
  if (notice) {
    content += `✦ **${notice}**\n\n`;
  }
  content +=
    `✦ **Bot Guilds & Stats**\n` +
    `• Total Guilds: **${guilds.length}** · Total Members: **${totalMembers.toLocaleString()}**\n` +
    `• Page: **${page + 1} / ${Math.max(1, totalPages)}**\n\n` +
    (lines.length ? lines.join("\n\n") : "*No servers found.*");

  const removeButtons = currentSlice.map((guild, idx) => {
    const isMain = guild.id === MAIN_SERVER_ID;
    return new ButtonBuilder()
      .setCustomId(isMain ? "btn_leave_main" : `btn_leave_${guild.id}`)
      .setLabel(isMain ? `Main (#${start + idx + 1})` : `Rem #${start + idx + 1}`)
      .setStyle(isMain ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setDisabled(disabled || isMain);
  });

  const components = [];
  if (removeButtons.length > 0) {
    components.push(new ActionRowBuilder().addComponents(removeButtons));
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_srv_prev")
        .setLabel("◀ Prev")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page === 0),
      new ButtonBuilder()
        .setCustomId("btn_srv_page")
        .setLabel(`${page + 1} / ${Math.max(1, totalPages)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("btn_srv_next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || page >= totalPages - 1)
    )
  );

  return {
    content,
    components,
    allowedMentions: NO_MENTIONS,
  };
}

module.exports = {
  name: "server",
  aliases: ["servers", "guilds"],
  description: "check bot server count, member counts, owner details, and remove servers (bot owner only)",
  guildOnly: false,
  async execute(message, args, { client: ctxClient } = {}) {
    const client = ctxClient || message.client;

    // Strict owner-only check
    if (message.author.id !== BOT_OWNER_ID && message.author.id !== "806113872620421140") {
      await message.reply({
        content: "No permission.",
        allowedMentions: NO_MENTIONS,
      }).catch(() => {});
      return;
    }

    let guilds = [...client.guilds.cache.values()].sort(
      (a, b) => (b.memberCount || 0) - (a.memberCount || 0)
    );
    let totalMembers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    let totalPages = Math.ceil(guilds.length / ITEMS_PER_PAGE) || 1;
    const ownerCache = new Map();

    let currentPage = 0;
    let isV2 = true;
    let currentNotice = null;

    // Pre-resolve owners for first page
    await resolvePageOwners(client, guilds.slice(0, ITEMS_PER_PAGE), ownerCache);

    let sentMsg;
    try {
      sentMsg = await message.reply(
        buildServerPanel({
          client,
          guilds,
          page: currentPage,
          totalPages,
          totalMembers,
          ownerCache,
          notice: currentNotice,
        })
      );
    } catch (err) {
      console.error("[server command] Components V2 failed, using standard fallback:", err?.message);
      isV2 = false;
      sentMsg = await message.reply(
        buildFallbackPayload({
          guilds,
          page: currentPage,
          totalPages,
          totalMembers,
          ownerCache,
          notice: currentNotice,
        })
      ).catch(() => null);
    }

    if (!sentMsg) return;

    const collector = sentMsg.createMessageComponentCollector({
      time: 600_000, // 10 minutes
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== BOT_OWNER_ID && interaction.user.id !== "806113872620421140") {
        await interaction.reply({
          content: "No permission.",
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      collector.resetTimer();

      if (interaction.customId === "btn_srv_prev") {
        currentPage = Math.max(0, currentPage - 1);
        currentNotice = null;
      } else if (interaction.customId === "btn_srv_next") {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        currentNotice = null;
      } else if (interaction.customId.startsWith("btn_leave_")) {
        const targetGuildId = interaction.customId.replace("btn_leave_", "");

        if (targetGuildId === "main" || targetGuildId === MAIN_SERVER_ID) {
          await interaction.reply({
            content: "Cannot remove bot from the main server.",
            ephemeral: true,
          }).catch(() => {});
          return;
        }

        const targetGuild =
          client.guilds.cache.get(targetGuildId) ||
          (await client.guilds.fetch(targetGuildId).catch(() => null));

        if (!targetGuild) {
          guilds = guilds.filter((g) => g.id !== targetGuildId);
          currentNotice = `Bot is no longer in server (\`${targetGuildId}\`).`;
        } else {
          const targetName = targetGuild.name || targetGuildId;
          try {
            await targetGuild.leave();
            guilds = guilds.filter((g) => g.id !== targetGuildId);
            currentNotice = `Removed bot from **${targetName}** (\`${targetGuildId}\`).`;
          } catch (err) {
            console.error(`[server command] failed to leave guild ${targetGuildId}:`, err);
            await interaction.reply({
              content: `Failed to remove from **${targetName}**: ${err.message}`,
              ephemeral: true,
            }).catch(() => {});
            return;
          }
        }

        // Recalculate stats
        totalMembers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);
        totalPages = Math.ceil(guilds.length / ITEMS_PER_PAGE) || 1;
        if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
      }

      // Ensure owners for target page are resolved
      const start = currentPage * ITEMS_PER_PAGE;
      await resolvePageOwners(client, guilds.slice(start, start + ITEMS_PER_PAGE), ownerCache);

      const render = isV2 ? buildServerPanel : buildFallbackPayload;
      const payload = render({
        client,
        guilds,
        page: currentPage,
        totalPages,
        totalMembers,
        ownerCache,
        notice: currentNotice,
      });

      await interaction.update(payload).catch(async (e) => {
        console.error("[server command] interaction update failed:", e?.message);
      });

      if (currentNotice && interaction.customId.startsWith("btn_leave_")) {
        await interaction.followUp({
          content: `✦ ${currentNotice}`,
          ephemeral: true,
        }).catch(() => {});
      }
    });

    collector.on("end", async () => {
      const render = isV2 ? buildServerPanel : buildFallbackPayload;
      const disabledPayload = render({
        client,
        guilds,
        page: currentPage,
        totalPages,
        totalMembers,
        ownerCache,
        notice: currentNotice,
        disabled: true,
      });
      await sentMsg.edit(disabledPayload).catch(() => {});
    });
  },
};
