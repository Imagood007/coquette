const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, OWNER_ID: CONFIG_OWNER_ID, MSG } = require("../config");
const { isUnlimitedEnabled, setUnlimitedEnabled, toggleUnlimited } = require("../unlimitedState");

const OWNER_ID = CONFIG_OWNER_ID || "806113872620421140";

module.exports = {
  name: "uni",
  aliases: ["unlimited"],
  description: "toggle unlimited quest mode for all users (owner only)",
  guildOnly: false,
  async execute(message, args) {
    const isOwner = message.author.id === OWNER_ID || message.member?.roles?.cache?.has(ADMIN_ROLE_ID);
    if (!isOwner) {
      await message.reply(MSG.no_permission || "No permission.");
      return;
    }

    const sub = args[0]?.toLowerCase();
    let enabled;

    if (sub === "enable" || sub === "on" || sub === "true") {
      enabled = setUnlimitedEnabled(true);
    } else if (sub === "disable" || sub === "off" || sub === "false") {
      enabled = setUnlimitedEnabled(false);
    } else {
      enabled = toggleUnlimited();
    }

    const msg = enabled
      ? "♡ **Unlimited quest mode enabled** — users with the access role can farm unlimited quests without daily limits (regular users still watch the 5-second ad; skipped only for premium)."
      : "♡ **Unlimited quest mode disabled** — quest limits restored to **2 quests per day**.";

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(msg)
    );

    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(async () => {
      await message.reply(msg).catch(() => {});
    });
  },
};
