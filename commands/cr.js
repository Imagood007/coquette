// commands/cr.js — clear staff ratings (owner only)
const { MessageFlags } = require("discord.js");
const { OWNER_ID: CONFIG_OWNER_ID, OWNER_ROLE_ID: CONFIG_OWNER_ROLE_ID, STAFF_ROLE_ID: CONFIG_STAFF_ROLE_ID } = require("../config");
const { clearRating } = require("../ratingsStore");

const OWNER_ROLE_ID = CONFIG_OWNER_ROLE_ID || "";
const OWNER_ID      = CONFIG_OWNER_ID || "";
const STAFF_ROLE_ID = CONFIG_STAFF_ROLE_ID || "";

module.exports = {
  name: "cr",
  aliases: ["clearrating", "resetrating"],
  description: "Clear all ratings for a staff member (owner only)",
  guildOnly: true,
  async execute(message, args) {
    const isAuthorized =
      message.author.id === OWNER_ID ||
      message.member?.roles?.cache?.has(OWNER_ROLE_ID);

    if (!isAuthorized) {
      await message.reply("No permission.");
      return;
    }

    const target = message.mentions.members?.first();

    if (!target) {
      await message.reply("Please mention a staff member. Example: `.cr @staffmember`");
      return;
    }

    if (!target.roles.cache.has(STAFF_ROLE_ID)) {
      await message.reply("That user is not a staff member.");
      return;
    }

    clearRating(target.id);
    await message.reply(`✦ Ratings cleared for **${target.displayName}**.`);
  },
};
