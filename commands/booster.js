const { ADMIN_ROLE_ID, BOOSTER_ALT_ROLE_ID } = require("../config");
const { addBoosterAlt } = require("../boosterTracker");

module.exports = {
  name: "booster",
  description: "Give premium access to a booster's alt account.",
  async execute(message, args) {
    if (!message.member?.roles?.cache?.has(ADMIN_ROLE_ID) && !message.member?.permissions.has("Administrator")) {
      return message.reply("You don't have permission to use this command.");
    }

    if (message.mentions.users.size < 2) {
      return message.reply("Usage: `.booster @boosterUser @altUser`");
    }

    const mentions = Array.from(message.mentions.users.values());
    const boosterUser = mentions[0];
    const altUser = mentions[1];

    if (!boosterUser || !altUser) {
      return message.reply("Usage: `.booster @boosterUser @altUser`");
    }

    const guild = message.guild;
    const boosterMember = await guild.members.fetch(boosterUser.id).catch(() => null);
    const altMember = await guild.members.fetch(altUser.id).catch(() => null);

    if (!boosterMember) {
      return message.reply(`Could not find ${boosterUser.tag} in the server.`);
    }

    const { BOOSTER_ROLE_ID } = require("../config");
    if (!boosterMember.roles.cache.has(BOOSTER_ROLE_ID)) {
      return message.reply(`${boosterUser.tag} does not currently have the server booster role.`);
    }

    if (!altMember) {
      return message.reply(`Could not find ${altUser.tag} in the server.`);
    }

    // Give the role to the alt user
    try {
      await altMember.roles.add(BOOSTER_ALT_ROLE_ID);
      addBoosterAlt(boosterUser.id, altUser.id, guild.id);
      
      await message.reply(`Successfully linked ${altUser.tag} as an alt for ${boosterUser.tag} and granted them the booster alt role.`);
    } catch (e) {
      console.error(`Failed to grant booster alt role: ${e.message}`);
      await message.reply("Failed to add the role. Please check my permissions and role hierarchy.");
    }
  }
};
