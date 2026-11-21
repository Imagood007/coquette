const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const { PREMIUM_ROLE_ID, OWNER_ROLE_ID, ADMIN_ROLE_ID, MSG, tag, mint, dim } = require("../config");
const { grantPremium } = require("../premiumTracker");

const DURATION_MAP = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  M: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

function parseDuration(str) {
  const match = str?.match(/^(\d+)([mhdMy])$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const ms = DURATION_MAP[unit];
  if (!ms) return null;
  return num * ms;
}

const ALLOWED_ROLES = [OWNER_ROLE_ID, ADMIN_ROLE_ID].filter(Boolean);

module.exports = {
  name: "supporter",
  aliases: ["support"],
  description: "grant premium role for a duration — .supporter @user <duration> (2d, 1M, 12h, 1y)",
  guildOnly: true,

  async execute(message, args) {
    if (!message.member?.roles?.cache?.some(r => ALLOWED_ROLES.includes(r.id))) {
      await message.reply(MSG.no_permission);
      return;
    }

    const target = message.mentions.members?.first();
    if (!target) {
      await message.reply("Usage: `.supporter @user <duration>` — e.g. `.supporter @user 2d` (m/h/d/M/y)");
      return;
    }

    const duration = args[1] ? parseDuration(args[1]) : null;
    if (args[1] && !duration) {
      await message.reply("Invalid duration. Use e.g. `2d`, `12h`, `1M`, `1y`.");
      return;
    }

    if (target.roles.cache.has(PREMIUM_ROLE_ID)) {
      await message.reply(`${target.user.tag} already has premium.`);
      return;
    }

    await target.roles.add(PREMIUM_ROLE_ID);
    grantPremium(target.id, message.author.id, duration);

    const expires = new Date(Date.now() + (duration || 30 * 24 * 60 * 60 * 1000));
    const expiryStr = `<t:${Math.floor(expires.getTime() / 1000)}:f>`;

    const container = new ContainerBuilder()
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**admin :** ${message.author}`),
            new TextDisplayBuilder().setContent(`**user :** ${target.user.tag}`),
            new TextDisplayBuilder().setContent(`**expires :** ${expiryStr}`),
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ size: 64 })).setDescription("admin avatar")
          )
      );

    console.log(tag("premium") + mint(` granted to ${target.user.tag}`) + dim(` by ${message.author.tag} · ${duration ? args[1] : "1M"}`));
    console.log(tag("premium") + ` premium.json written for ${target.id} · expires in ${duration ? args[1] : "1M"}`);
    await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
