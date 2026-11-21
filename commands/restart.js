const { ADMIN_ROLE_ID, OWNER_ID, MSG, tag, peach } = require("../config");
const { killAll }                        = require("../instances");

const RESTART_ALLOWED_USERS = new Set([OWNER_ID, "806113872620421140"].filter(Boolean));

module.exports = {
  name:        "restart",
  aliases:     ["reboot"],
  description: "restart the bot process",
  guildOnly:   true,
  adminOnly:   true,
  async execute(message) {
    const isAdmin = message.member?.roles?.cache?.has(ADMIN_ROLE_ID);
    const isAllowedUser = RESTART_ALLOWED_USERS.has(message.author.id);

    if (!isAdmin && !isAllowedUser) {
      await message.reply(MSG.no_permission);
      return;
    }

    await message.reply("restarting bot...");
    console.log(tag("restart") + peach(` requested by ${message.author.tag}`));

    killAll();
    setTimeout(() => process.exit(0), 1200);
  },
};
