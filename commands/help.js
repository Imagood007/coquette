const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

function buildHelpComponents() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "**Coquette Bot — Commands**\n-# prefix: `.`  ·  all user commands (staff/admin commands omitted)"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "♡ **Quest Automation**\n" +
        "• `.quest` (`.q`) — start or manage your quest session\n" +
        "• `.status` (`.s`) — view active quest progression & time remaining\n" +
        "• `.stop` — stop your running quest session\n" +
        "• `.orbs` (`.orb`) — check saved account's Discord quest orbs\n" +
        "• `.addtoken` — manage booster multi-token slots"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "✦ **Access & Invites**\n" +
        "• `.link` (`.inv`) — generate custom invite link (2 joins = access)\n" +
        "• `.invites` (`.i`) — check your tracked invites count\n" +
        "• `.leaderboard` (`.lb`) — view top inviters leaderboard"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "⨾𓍢ִ໋ **Support & Staff**\n" +
        "• `.rate @staff` (`.vouch`) — rate a staff member (1-5 stars)\n" +
        "• `.profile @staff` (`.sp`) — view a staff member's ratings profile"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "✧ **Utilities**\n" +
        "• `.ping` (`.p`) — check bot latency and responsiveness\n" +
        "• `.guide` (`.tutorial`) — token extraction bookmarklet & video guide"
      )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("btn_guide_pc").setLabel("ᝰ.ᐟ  PC Guide").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("btn_guide_android").setLabel("⨾𓍢ִ໋ Android Guide").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("btn_guide_ios").setLabel(".✦ ݁˖  iOS Guide").setStyle(ButtonStyle.Secondary)
      )
    );

  return [container];
}

function buildFallbackHelpEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0xffb6c1)
    .setTitle("Coquette Bot — Commands")
    .setDescription("Prefix: `.`  ·  All user commands (staff/admin commands omitted)")
    .addFields(
      {
        name: "♡ Quest Automation",
        value: "• `.quest` (`.q`) — Start or manage quest session\n• `.status` (`.s`) — View current quest progress\n• `.stop` — Stop running session\n• `.orbs` (`.orb`) — Check Discord quest orbs\n• `.addtoken` — Booster token slots",
      },
      {
        name: "✦ Access & Invites",
        value: "• `.link` (`.inv`) — Get invite link (2 joins = access)\n• `.invites` (`.i`) — Check your invite count\n• `.leaderboard` (`.lb`) — Top inviters leaderboard",
      },
      {
        name: "⨾𓍢ִ໋ Support & Staff",
        value: "• `.rate @staff` (`.vouch`) — Rate staff member\n• `.profile @staff` (`.sp`) — View staff profile",
      },
      {
        name: "✧ Utilities",
        value: "• `.ping` (`.p`) — Check bot ping\n• `.guide` (`.tutorial`) — Token bookmarklet guide",
      }
    )
    .setFooter({ text: "Click buttons below to view platform token bookmarklet guides" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("btn_guide_pc").setLabel("ᝰ.ᐟ  PC Guide").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("btn_guide_android").setLabel("⨾𓍢ִ໋ Android Guide").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("btn_guide_ios").setLabel(".✦ ݁˖  iOS Guide").setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  name: "help",
  aliases: ["h", "commands", "cmds"],
  description: "Show all available user bot commands",
  guildOnly: false,
  async execute(message) {
    try {
      await message.reply({
        components: buildHelpComponents(),
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: NO_MENTIONS,
      });
    } catch (_) {
      const fallback = buildFallbackHelpEmbed();
      await message.reply({
        embeds: fallback.embeds,
        components: fallback.components,
        allowedMentions: NO_MENTIONS,
      }).catch(() => {});
    }
  },
};
