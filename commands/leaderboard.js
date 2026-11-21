const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { getAll } = require("../personalInvites");

module.exports = {
  name: "leaderboard",
  aliases: ["lb"],
  description: "show top inviters",
  guildOnly: true,
  async execute(message) {
    let entries = await getAll().catch(() => []);
    entries = entries
      .filter((e) => e.joins > 0)
      .sort((a, b) => b.joins - a.joins)
      .slice(0, 10);

    const names = await Promise.all(
      entries.map(async (e) => {
        const user = await message.client.users.fetch(e.userId).catch(() => null);
        return user ? user.username : "unknown";
      })
    );

    let lines;
    if (entries.length === 0) {
      lines = ["Top Inviters", "", "No invites yet. Be the first with `.link`!"];
    } else {
      const medals = ["#1", "#2", "#3"];
      lines = ["Top Inviters", ""];
      entries.forEach((e, i) => {
        const label = medals[i] ? `${medals[i]} ` : `${i + 1}. `;
        lines.push(`${label}${names[i]} — ${e.joins} join${e.joins === 1 ? "" : "s"}`);
      });
    }

    await message.reply({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(lines.join("\n"))
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
