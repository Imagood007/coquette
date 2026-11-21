const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  MessageFlags,
} = require("discord.js");
const { OWNER_ID, OWNER_ROLE_ID, ADMIN_ROLE_ID, MSG, tag, mint, rose } = require("../config");
const { isGuildAdmin } = require("../guildConfig");

module.exports = {
  name: "setavatar",
  aliases: ["setpfp", "botavatar", "botpfp"],
  description: "Change the bot's avatar (owner/admin only)",
  guildOnly: false,
  async execute(message, args) {
    const isOwner =
      message.author.id === OWNER_ID ||
      message.member?.roles?.cache?.has(OWNER_ROLE_ID) ||
      message.member?.roles?.cache?.has(ADMIN_ROLE_ID) ||
      isGuildAdmin(message.member);

    if (!isOwner) {
      await message.reply(MSG.no_permission);
      return;
    }

    let avatarUrl = null;
    const attachment = message.attachments?.first();
    if (attachment && attachment.url) {
      avatarUrl = attachment.url;
    } else if (args[0]) {
      avatarUrl = args[0].trim();
      if (avatarUrl.startsWith("<") && avatarUrl.endsWith(">")) {
        avatarUrl = avatarUrl.slice(1, -1);
      }
    }

    if (!avatarUrl) {
      await message.reply("✦ **Usage:** `.setavatar <image URL>` or attach an image with `.setavatar`");
      return;
    }

    const waitMsg = await message.reply("♡ Updating bot avatar...").catch(() => null);

    try {
      await message.client.user.setAvatar(avatarUrl);
      const newAvatarUrl = message.client.user.displayAvatarURL({ size: 256 });

      const container = new ContainerBuilder()
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("**✦ Bot avatar updated successfully!**"),
              new TextDisplayBuilder().setContent("-# your new profile picture is now live")
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(newAvatarUrl).setDescription("New Avatar"))
        );

      if (waitMsg) {
        await waitMsg.edit({
          content: null,
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        }).catch(async () => {
          await waitMsg.edit({ content: "✦ **Bot avatar updated successfully!**" });
        });
      } else {
        await message.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        }).catch(async () => {
          await message.reply("✦ **Bot avatar updated successfully!**");
        });
      }
      console.log(tag("avatar") + mint(` Avatar updated by ${message.author.tag}`));
    } catch (err) {
      console.error(tag("avatar") + rose(` failed to update avatar: ${err.message}`));
      const errMsg = err.code === 50035 || err.message?.includes("fast")
        ? "✗ Discord rate limit: you are changing the bot avatar too fast. Please wait a few minutes."
        : `✗ Failed to update avatar: ${err.message}`;

      if (waitMsg) {
        await waitMsg.edit({ content: errMsg }).catch(() => {});
      } else {
        await message.reply(errMsg).catch(() => {});
      }
    }
  },
};
