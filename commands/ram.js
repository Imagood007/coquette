const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require("discord.js");
const os = require("os");
const { questEngine, runningInstances } = require("../instances");
const { MSG, OWNER_ROLE_ID, OWNER_ID } = require("../config");

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatGB(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function getCpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t in cpu.times) total += cpu.times[t];
    idle += cpu.times.idle;
  }
  return { idle, total };
}

async function getCpuPercent() {
  const s1 = getCpuSnapshot();
  await new Promise((r) => setTimeout(r, 100));
  const s2 = getCpuSnapshot();
  const idle = s2.idle - s1.idle;
  const total = s2.total - s1.total;
  return total > 0 ? ((1 - idle / total) * 100).toFixed(1) : "0.0";
}

module.exports = {
  name: "ram",
  aliases: ["memory", "mem", "stats", "usage"],
  description: "show bot cpu and ram usage in component v2 embed (owner only)",
  guildOnly: true,
  async execute(message, args, { client } = {}) {
    const member = message.member || (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);
    const isOwner =
      message.author.id === OWNER_ID ||
      member?.roles?.cache?.has(OWNER_ROLE_ID);

    if (!isOwner) {
      await message.reply(MSG.no_permission);
      return;
    }

    const cpuPercentPromise = getCpuPercent();

    const mem = process.memoryUsage();
    const totalSysMem = os.totalmem();
    const freeSysMem = os.freemem();
    const usedSysMem = totalSysMem - freeSysMem;
    const sysMemPct = ((usedSysMem / totalSysMem) * 100).toFixed(1);

    const cpus = os.cpus();
    const cpuCount = cpus.length;

    const cpuPercent = await cpuPercentPromise;

    const activeSessions = questEngine ? questEngine.activeSessionsCount : (runningInstances ? runningInstances.size : 0);
    const activeOperations = questEngine ? questEngine.getActiveQuestOperationsCount() : 0;

    const avatarUrl = client?.user?.displayAvatarURL?.({ size: 128 }) || "https://cdn.discordapp.com/embed/avatars/0.png";

    const headerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `𝜗𝜚 **system & engine performance**\n` +
          `-# uptime: ${formatUptime(process.uptime())} · node ${process.version} · pid ${process.pid}`
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder().setURL(avatarUrl).setDescription("bot avatar")
      );

    const container = new ContainerBuilder()
      .addSectionComponents(headerSection)
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✦ **Memory (RAM) Usage**\n` +
          `• **Process RSS:** \`${formatBytes(mem.rss)}\` *(Resident Set Size)*\n` +
          `• **V8 Heap Used:** \`${formatBytes(mem.heapUsed)}\` / \`${formatBytes(mem.heapTotal)}\`\n` +
          `• **External & Buffers:** \`${formatBytes(mem.external)}\` · \`${formatBytes(mem.arrayBuffers)}\` ArrayBuffers\n` +
          `• **System RAM:** \`${formatGB(usedSysMem)}\` / \`${formatGB(totalSysMem)}\` (\`${sysMemPct}%\` used)`
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✦ **CPU & Hardware**\n` +
          `• **CPU Usage:** \`${cpuPercent}%\`\n` +
          `• **Cores:** \`${cpuCount}\``
        )
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✦ **Shared Quest Engine**\n` +
          `• **Active User Sessions:** \`${activeSessions}\` running\n` +
          `• **Active Quest Tasks:** \`${activeOperations}\` in-flight\n` +
          `• **RAM per Session:** \`~0.6 – 1.8 MB\` *(shared architecture)*\n\n` +
          `-# 𝜗𝜚 .gg/coquettes · autoquest`
        )
      );

    await message.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    }).catch(async (err) => {
      console.error("[ram command] error sending Components V2:", err?.message);
      // Fallback in case guild does not support components v2 flag
      await message.reply(
        `**System & Engine Performance**\n` +
        `• **Process RSS:** ${formatBytes(mem.rss)}\n` +
        `• **Heap:** ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}\n` +
        `• **CPU:** ${cpuPercent}%\n` +
        `• **Active Sessions:** ${activeSessions}`
      ).catch(() => {});
    });
  },
};
