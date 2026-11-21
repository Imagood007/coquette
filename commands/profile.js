// commands/profile.js
const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  ThumbnailBuilder, SeparatorBuilder, MessageFlags,
} = require("discord.js");

const { OWNER_ID: CONFIG_OWNER_ID, STAFF_ROLE_ID: CONFIG_STAFF_ROLE_ID } = require("../config");
const { getRatings } = require("../ratingsStore");

const STAFF_ROLE_ID = CONFIG_STAFF_ROLE_ID || "";
const OWNER_ID      = CONFIG_OWNER_ID || "";

function starsBar(average) {
  const filled = Math.round(average);
  return "✦".repeat(filled) + "✧".repeat(5 - filled);
}

module.exports = {
  name: "profile",
  aliases: ["staffprofile", "sp"],
  description: "View a staff member's rating profile",
  guildOnly: true,
  async execute(message, args) {
    const target = message.mentions.members?.first() || message.member;

    const isStaff = target.roles.cache.has(STAFF_ROLE_ID);
    const isOwner = message.author.id === OWNER_ID;

    if (!isStaff && !isOwner) {
      await message.reply("That user is not a staff member — only staff profiles can be viewed.");
      return;
    }

    await message.guild.members.fetch().catch(() => {});

    const { ratings, average, total } = getRatings(target.id);
    const avatarUrl = target.user.displayAvatarURL({ size: 128 });
    const bar = starsBar(average);
    const avgDisplay = total ? average.toFixed(1) : "—";

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**✦ Staff Profile — ${target.displayName}**`
            ),
            new TextDisplayBuilder().setContent(
              `• **Rating:** ${bar}  **${avgDisplay} / 5**\n` +
              `• **Total Votes:** ${total}`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(avatarUrl).setDescription("staff avatar")
          )
      )
      .addSeparatorComponents(new SeparatorBuilder());

    if (total > 0) {
      const recent = ratings.slice(-10).reverse();
      let recentText = "**Recent Ratings:**\n";
      for (const r of recent) {
        const rBar = "✦".repeat(r.stars) + "✧".repeat(5 - r.stars);
        const date = new Date(r.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        recentText += `• ${rBar}  ${r.voterTag} — ${date}\n`;
      }
      if (ratings.length > 10) {
        recentText += `-# ...and ${ratings.length - 10} more ratings`;
      }

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(recentText)
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# No ratings yet.")
      );
    }

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
