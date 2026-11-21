const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const { getTokenList, fetchTokenOrbs } = require("../instances");

function fmt(num) {
  return Number(num).toLocaleString("en-US");
}

function resolveTarget(message, args) {
  const mentioned = message.mentions.users.first();
  if (mentioned) return mentioned;

  const raw = args[0]?.replace(/[<@!>]/g, "");
  if (raw && /^\d{16,22}$/.test(raw)) {
    return { id: raw, tag: `User ${raw}`, displayAvatarURL: () => null };
  }

  return message.author;
}

module.exports = {
  name: "orbs",
  aliases: ["orb"],
  description: "show saved account orb balance",
  guildOnly: true,
  async execute(message, args) {
    const target = resolveTarget(message, args);
    const tokens = getTokenList(target.id).filter(Boolean);
    const isSelf = target.id === message.author.id;

    if (tokens.length === 0) {
      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Orbs**\n${isSelf ? "You do" : `<@${target.id}> does`} not have a saved token.`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          )
        );

      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      return;
    }

    const results = await Promise.all(tokens.map(token => fetchTokenOrbs(token)));
    const good = results.filter(r => r.ok);
    const total = good.reduce((sum, r) => sum + r.orbs, 0);

    const descText = good.length === 0
      ? `Could not fetch orbs for ${isSelf ? "your" : `<@${target.id}>'s`} saved account.`
      : `${isSelf ? "Your" : `<@${target.id}>'s`} saved account has **${fmt(total)} orbs**.`;

    const avatar = target.displayAvatarURL ? target.displayAvatarURL({ size: 128 }) : null;

    const container = new ContainerBuilder();

    if (avatar) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Orbs**\n${descText}`))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar).setDescription("user avatar"))
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Orbs**\n${descText}`)
      );
    }

    if (tokens.length > 1) {
      const slotsText = results.map((result, index) => (
        result.ok
          ? `slot ${index + 1}: **${fmt(result.orbs)}** orbs`
          : `slot ${index + 1}: could not fetch`
      )).join("\n");

      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Slots**\n${slotsText}`)
        );
    } else if (good.length === 0) {
      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Reason**\n${results[0]?.error || "No orb balance found."}`)
        );
    }

    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# ${good.length}/${tokens.length} token slot${tokens.length === 1 ? "" : "s"} checked  ·  ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        )
      );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
