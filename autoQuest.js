// ╔══════════════════════════════════════════════════════════════╗
// ║                     AUTO QUEST                               ║
// ║  shared engine booster quest automation                      ║
// ╚══════════════════════════════════════════════════════════════╝

const { spawnInstance, runningInstances } = require("./instances");
const { LOG_CHANNEL_ID, BOOSTER_TOKEN }   = require("./config");

const INTERVAL_MS = 3 * 60 * 60 * 1000;

let timer = null;

function startAutoQuest(client) {
  if (!BOOSTER_TOKEN) return;
  if (runningInstances.has(BOOSTER_TOKEN)) {
    console.log(`[auto-quest] booster session already active, skipping overlap at ${new Date().toLocaleString()}`);
    return;
  }

  const startTime = new Date().toLocaleString();
  console.log(`[auto-quest] starting shared booster session at ${startTime}`);

  spawnInstance(
    BOOSTER_TOKEN,
    "auto-quest",
    LOG_CHANNEL_ID,
    client,
    null,
    [BOOSTER_TOKEN],
    0,
    Infinity
  );
}

function enableAutoQuest(client) {
  if (timer || !BOOSTER_TOKEN) return;
  console.log("[auto-quest] enabled — checking every 3 hours");
  startAutoQuest(client);
  timer = setInterval(() => startAutoQuest(client), INTERVAL_MS);
}

function disableAutoQuest() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log("[auto-quest] disabled");
}

module.exports = { enableAutoQuest, disableAutoQuest };
