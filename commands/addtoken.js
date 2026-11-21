const { MessageFlags }              = require("discord.js");
const { isPremium, MSG }      = require("../config");
const { buildAddTokenComponents }   = require("../handlers");

module.exports = {
  name:        "addtoken",
  aliases:     ["tokens"],
  description: "manage your booster token slots",
  guildOnly:   true,
  boosterOnly: true,
  async execute(message) {
    if (!isPremium(message.member)) { await message.reply(MSG.booster_only); return; }
    await message.channel.send({ components: buildAddTokenComponents(message.author.id), flags: MessageFlags.IsComponentsV2 });
  },
};
