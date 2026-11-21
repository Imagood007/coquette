const { Routes } = require("discord.js");

const NO_MENTIONS = { parse: [], users: [], roles: [], repliedUser: false };

module.exports = {
  name:        "ping",
  aliases:     ["p"],
  description: "check bot latency",
  guildOnly:   false,
  async execute(message, args, { client } = {}) {
    const botClient = client || message.client;
    const t0 = Date.now();
    let restPing = 0;

    try {
      if (botClient?.rest) {
        await botClient.rest.get(Routes.gateway());
        restPing = Date.now() - t0;
      }
    } catch (_) {}

    if (!restPing || restPing <= 0) {
      restPing = Math.max(1, Date.now() - message.createdTimestamp);
    }

    const wsPing = botClient?.ws?.ping > 0 ? Math.round(botClient.ws.ping) : restPing;

    await message.reply({
      content: `✦ **${restPing}ms**  ·  ws \`${wsPing}ms\``,
      allowedMentions: NO_MENTIONS,
    });
  },
};
