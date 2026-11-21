// ============================================================
// embeds.js
// ============================================================

const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

// ---- Public embed placeholder — sent by manager bot, patched by bot.ts via Bot token ----
function buildUserEmbed(data, finishTimeStr) {
  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`𝜗𝜚 **${data.tag}**`),
          new TextDisplayBuilder().setContent(`-# session started  ·  ends at ${finishTimeStr}`),
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(data.avatarUrl).setDescription("user avatar")
        )
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("♡ fetching quests...")
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ---- Live quest progress — patched by bot.ts via manager bot token ----
function buildQuestProgressComponents(quests, done, maxQuests = Infinity, stopped = false) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        stopped
          ? `✗ **quest session stopped**`
          : done
            ? `✦ **quest session complete**`
            : `♡ **quest session in progress**`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder());

  const list = Array.isArray(quests) ? quests.slice(0, 8) : [];
  if (list.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        stopped
          ? `-# session stopped before quests were loaded`
          : `-# fetching quests...`
      )
    );
  } else {
    for (const [i, q] of list.entries()) {
      const isDone = q.status === "done" || (q.percent != null && q.percent >= 100);
      const icon   = stopped ? (isDone ? "✦" : "✗") : isDone ? "✦" : q.status === "running" ? "♡" : "✗";
      const reward = q.reward && q.reward !== "Unknown" ? q.reward : "—";

      let details = `↳ ${reward}`;
      if (isDone) {
        const target = q.secondsNeeded || 900;
        details += `  ·  ✦ ${target}/${target}s (100%)  ·  done`;
      } else if (stopped) {
        details += `  ·  ✗ session stopped`;
      } else if (q.status === "running" && q.secondsNeeded) {
        const cur = q.current || 0;
        const target = q.secondsNeeded;
        const pct = q.percent != null ? q.percent : Math.min(100, Math.floor((cur / target) * 100));
        const secLeft = Math.max(0, target - cur);
        const minsLeft = Math.ceil(secLeft / 60);
        const timeLeftStr = q.timeLeft || (minsLeft > 1 ? `~${minsLeft} min left` : secLeft > 0 ? `~${secLeft}s left` : "almost done");
        details += `  ·  ♡ ${cur}/${target}s (${pct}%)  ·  ${timeLeftStr}`;
      }

      const buttonLabel = stopped
        ? (isDone ? "✓ done" : "✗ stopped")
        : isDone
          ? "✓ done"
          : q.status === "running"
            ? (q.percent != null ? `♡ ${q.percent}%` : "♡ running")
            : "✗ failed";

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${icon} **${q.name}**\n-# ${details}`)
          )
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`noop_${i}_${q.name.replace(/\s/g, "_").slice(0, 15)}`)
              .setLabel(buttonLabel)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          )
      );
    }
  }

  if (stopped) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# session was stopped via .stop  ·  𝜗𝜚 .gg/coquettes`
        )
      );
  } else if (done) {
    const succeeded = list.filter(q => q.status === "done").length;
    const failed    = list.filter(q => q.status === "failed").length;
    const limitReached = Number.isFinite(maxQuests);

    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          limitReached
            ? `-# you reached your today's limit  ·  come back tomorrow`
            : `-# ✓ ${succeeded} done${failed ? `  ·  ✗ ${failed} failed` : ""}  ·  𝜗𝜚 .gg/coquettes`
        )
      );
  }

  return container;
}

module.exports = {
  buildUserEmbed,
  buildQuestProgressComponents,
};
