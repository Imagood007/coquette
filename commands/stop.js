const { runningInstances } = require("../instances");
const { tag, peach }       = require("../config");
const { buildQuestProgressComponents } = require("../embeds");

module.exports = {
  name:        "stop",
  aliases:     [],
  description: "stop your running quest session",
  guildOnly:   true,
  async execute(message) {
    const entry = [...runningInstances.entries()].find(([, v]) => v.userId === message.author.id);
    if (!entry) { await message.reply("Stopped no running session to stop."); return; }

    const [token, instance] = entry;
    instance.endReason = "stopped";

    // Update previous session UI to show stopped
    if (instance.session) {
      try {
        if (typeof instance.session.updateStoppedEmbed === "function") {
          await instance.session.updateStoppedEmbed();
        } else if (instance.session.patchEmbed) {
          const container = buildQuestProgressComponents(instance.session.quests || [], true, Infinity, true);
          await instance.session.patchEmbed({
            components: [container.toJSON ? container.toJSON() : container],
            flags: 32768,
          });
        }
      } catch (err) {
        console.warn("[stop] failed to patch session embed:", err.message);
      }
    }

    try { instance.process.kill("SIGINT"); } catch (_) {}
    console.log(tag("stop") + peach(` stopped instance for ${message.author.tag}`));
    await message.reply("Done session stopped.");
  },
};
