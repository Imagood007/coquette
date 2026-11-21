const { ADMIN_ROLE_ID, MSG } = require("../config");
const { cleanupStaleInstances, runningInstances } = require("../instances");

module.exports = {
  name:        "int",
  aliases:     ["instances"],
  description: "manually clear stale instance folders",
  guildOnly:   true,
  adminOnly:   true,
  async execute(message) {
    if (!message.member?.roles?.cache?.has(ADMIN_ROLE_ID)) {
      await message.reply(MSG.no_permission);
      return;
    }

    const removed = cleanupStaleInstances();
    await message.reply(`instances cleaned: **${removed}** removed, **${runningInstances.size}** active kept.`);
  },
};
