const { MessageFlags }                   = require("discord.js");
const { MSG, tag, rose }                 = require("../config");
const { runningInstances, sanitizeToken } = require("../instances");
const { buildStatusComponents }           = require("../handlers");
const fs   = require("fs");
const path = require("path");

module.exports = {
  name:        "status",
  aliases:     ["s"],
  description: "check your current quest session progress",
  guildOnly:   true,
  async execute(message) {
    const entry = [...runningInstances.entries()].find(([, v]) => v.userId === message.author.id);
    if (!entry) { await message.reply(MSG.no_instance); return; }

    const [token] = entry;
    let quests = null;
    try {
      const p = path.join(__dirname, "..", "instances", sanitizeToken(token), "progress.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.quests?.length) quests = data.quests;
      }
    } catch (_) {}

    if (!quests) { await message.reply(MSG.quest_starting); return; }

    try {
      await message.reply({ components: buildStatusComponents(quests, message.author.displayAvatarURL({ size: 64 })), flags: MessageFlags.IsComponentsV2 });
    } catch (e) {
      console.error(tag("status") + rose(` embed error: ${e.message}`));
      await message.reply(MSG.status_error);
    }
  },
};
