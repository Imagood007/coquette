const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { getDailyCount, getUsersToday, getDailyHistory } = require("../dailyUsers");

module.exports = {
  name: "count",
  aliases: ["users"],
  description: "show how many users used the bot today",
  guildOnly: true,
  async execute(message) {
    const count = getDailyCount();
    const users = getUsersToday();
    const history = getDailyHistory();

    const blocks = [];

    const today = [`**users today :** ${count}`];
    if (users.length > 0) {
      today.push(`-# ${users.slice(0, 10).join(" · ")}${users.length > 10 ? ` · +${users.length - 10} more` : ""}`);
    }
    blocks.push(today.join("\n"));

    const pastDays = history
      .filter(h => h.date !== history[0]?.date)
      .slice(0, 5)
      .map(h => `-# ${h.date} — ${h.count} users`);
    if (pastDays.length > 0) {
      blocks.push(pastDays.join("\n"));
    }

    const textDisplay = new TextDisplayBuilder().setContent(blocks.join("\n\n"));
    const container = new ContainerBuilder().addTextDisplayComponents(textDisplay);

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};