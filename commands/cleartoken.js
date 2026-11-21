const { isPremium, MSG, tag, peach } = require("../config");
const { getTokenList, clearTokens }        = require("../instances");

module.exports = {
  name:        "cleartoken",
  aliases:     [],
  description: "clear all your saved tokens",
  guildOnly:   true,
  boosterOnly: true,
  async execute(message) {
    if (!isPremium(message.member)) { await message.reply(MSG.booster_only); return; }
    const list = getTokenList(message.author.id);
    if (list.length === 0) { await message.reply(MSG.no_tokens); return; }
    clearTokens(message.author.id);
    console.log(tag("cleartoken") + peach(` ${message.author.tag} cleared all tokens`));
    await message.reply("Done All tokens cleared.");
  },
};
