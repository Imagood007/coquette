const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { ADMIN_ROLE_ID, OWNER_ROLE_ID, OWNER_ID: CONFIG_OWNER_ID, MSG, tag, mint, rose } = require("../config");
const { MAIN_SERVER_ID } = require("../inviteHelper");
const fs = require("fs");
const path = require("path");

const OWNER_ID = CONFIG_OWNER_ID || "";
const ADMIN_ROLE_ACCESS_ID = OWNER_ROLE_ID || ADMIN_ROLE_ID || "";

module.exports = {
  name: "ci",
  aliases: ["clearinvites", "cleaninvites"],
  description: "delete invites in non-main servers (admin only)",
  guildOnly: false,
  async execute(message, args) {
    const isAuthorized =
      message.author.id === OWNER_ID ||
      message.member?.roles?.cache?.has(ADMIN_ROLE_ACCESS_ID);

    if (!isAuthorized) {
      await message.reply(MSG.no_permission || "No permission.");
      return;
    }

    const deleteAll = args[0]?.toLowerCase() === "all";
    const statusMsg = await message
      .reply(`⏳ Deleting ${deleteAll ? "all" : "bot-created"} invite links in non-main servers... Please wait.`)
      .catch(() => null);

    let totalDeleted = 0;
    const serverResults = [];
    const deletedCodes = new Set();

    for (const guild of message.client.guilds.cache.values()) {
      // NEVER touch the main server
      if (guild.id === MAIN_SERVER_ID) continue;

      let invites;
      try {
        invites = await guild.invites.fetch();
      } catch (err) {
        console.error(tag("ci") + rose(` failed to fetch invites for ${guild.name} (${guild.id}): ${err.message}`));
        continue;
      }

      if (!invites || invites.size === 0) {
        serverResults.push({ name: guild.name, id: guild.id, deleted: 0, total: 0 });
        continue;
      }

      // Filter: if 'all', delete all; otherwise delete only invites created by the bot
      const targetInvites = deleteAll
        ? [...invites.values()]
        : [...invites.values()].filter((i) => i.inviter?.id === message.client.user.id);

      let guildDeleted = 0;
      for (const inv of targetInvites) {
        try {
          await inv.delete("Non-main server invite cleanup via .ci");
          guildDeleted++;
          totalDeleted++;
          deletedCodes.add(inv.code);
          await new Promise((r) => setTimeout(r, 120));
        } catch (err) {
          console.error(tag("ci") + rose(` failed to delete invite ${inv.code} in ${guild.name}: ${err.message}`));
        }
      }

      serverResults.push({ name: guild.name, id: guild.id, deleted: guildDeleted, total: invites.size });
    }

    // Clean up personal-invites.json so users don't point to deleted non-main server invite links
    const personalPath = path.join(__dirname, "..", "database", "personal-invites.json");
    try {
      if (fs.existsSync(personalPath)) {
        const personal = JSON.parse(fs.readFileSync(personalPath, "utf-8"));
        let modified = false;
        for (const [, entry] of Object.entries(personal)) {
          if (entry.inviteCode && deletedCodes.has(entry.inviteCode)) {
            entry.active = false;
            delete entry.inviteCode;
            delete entry.inviteURL;
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(personalPath, JSON.stringify(personal, null, 2), "utf-8");
          console.log(tag("ci") + mint(` cleaned up ${deletedCodes.size} stale codes from personal-invites.json`));
        }
      }
    } catch (e) {
      console.error(tag("ci") + rose(` failed to clean personal-invites.json: ${e.message}`));
    }

    let summaryText =
      `**✦ Non-Main Server Invite Cleanup Completed**\n\n` +
      `• **Mode:** ${deleteAll ? "All Invites" : "Bot-Created Invites"}\n` +
      `• **Total Deleted:** ${totalDeleted}\n` +
      `• **Main Server (${MAIN_SERVER_ID || "Protected"}):** Protected (Untouched)\n\n` +
      `**Server Breakdown:**\n`;

    for (const s of serverResults) {
      summaryText += `• **${s.name}** (\`${s.id}\`): Deleted **${s.deleted}** / ${s.total} invites\n`;
    }

    if (serverResults.length === 0) {
      summaryText += `• No non-main servers found.\n`;
    }

    if (!deleteAll) {
      summaryText += `\n-# Use \`.ci all\` if you also want to remove non-bot invites in other servers.`;
    }

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(summaryText)
    );

    if (statusMsg) {
      await statusMsg
        .edit({ content: null, components: [container], flags: MessageFlags.IsComponentsV2 })
        .catch(async () => {
          await statusMsg.edit({ content: summaryText, components: [] }).catch(() => {});
        });
    } else {
      await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(async () => {
        await message.reply(summaryText).catch(() => {});
      });
    }
  },
};
