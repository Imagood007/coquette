// ╔══════════════════════════════════════════════════════════════╗
// ║                       INSTANCES                             ║
// ║  token vault · validation · shared engine · checker · clean ║
// ╚══════════════════════════════════════════════════════════════╝

const { randomUUID } = require("crypto");
const fs             = require("fs");
const path           = require("path");

const {
  MANAGER_TOKEN, CLIENT_ID,
  LOG_CHANNEL_ID, BOOSTER_ROLE_ID, isPremium,
  SESSION_MINUTES, MAX_TOKENS,
  MANAGER_RESTART_MS, QUEST_CHECK_MIN_MS, QUEST_CHECK_MAX_MS,
  MSG, tag, mint, peach, rose, dim, pink,
} = require("./config");
const { isUnlimitedEnabled } = require("./unlimitedState");

let questEngine;
try {
  questEngine = require("./dist/src/questEngine").questEngine;
} catch (_) {
  questEngine = require("./src/questEngine").questEngine;
}

const {
  loadTokens,
  getToken,
  getTokenList,
  saveToken: saveTokenCrypto,
  setTokenSlot,
  clearTokens,
} = require("./tokenCrypto");

const BASE_DIR        = __dirname;
const RUN_DURATION_MS = SESSION_MINUTES * 60 * 1000;

// token → { process, userId, channelId, startTime, tokenList, tokenIndex, endReason, session }
const runningInstances = new Map();

// ╔══════════════════════════════════════════════════════════════╗
// ║                      TOKEN VAULT                            ║
// ╚══════════════════════════════════════════════════════════════╝

function saveToken(userId, token, isBooster = false) {
  saveTokenCrypto(userId, token, isBooster, MAX_TOKENS);
}

function getStats() {
  const tokens = loadTokens();
  return { saved: Object.keys(tokens).length, active: runningInstances.size };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                      VALIDATION                             ║
// ╚══════════════════════════════════════════════════════════════╝

async function validateToken(token) {
  try {
    const headers = { Authorization: token };
    const userRes = await fetch("https://discord.com/api/v10/users/@me", { headers });
    if (!userRes.ok) return { valid: false };

    const user = await userRes.json();

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

    return {
      valid: true,
      id: user.id,
      tag: user.discriminator !== "0" ? `${user.username}#${user.discriminator}` : user.username,
      avatarUrl,
      guilds: [],
      token,
    };
  } catch { return { valid: false }; }
}

async function checkQuestsAvailable(token) {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/quests", {
      headers: { Authorization: token },
    });
    if (!res.ok) return false;
    const quests = await res.json();
    return Array.isArray(quests) && quests.length > 0;
  } catch { return false; }
}

async function fetchAvailableQuests(token) {
  try {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36";
    const res = await fetch("https://discord.com/api/v10/quests/@me", {
      headers: {
        Authorization: token,
        "User-Agent": userAgent,
        "Accept-Language": "en-US",
        "Origin": "https://discord.com",
      },
    });
    if (!res.ok) return { ok: false, status: res.status, quests: [] };
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, status: 500, quests: [] };
    const rawQuests = Array.isArray(data) ? data : (data.quests || []);
    const now = Date.now();
    const valid = rawQuests.filter(q =>
      q.id !== "1412491570820812933" &&
      !q.user_status?.completed_at &&
      (!q.config?.expires_at || new Date(q.config.expires_at).getTime() > now)
    );
    return { ok: true, status: 200, quests: valid };
  } catch (err) {
    return { ok: false, error: err.message, quests: [] };
  }
}

async function fetchTokenOrbs(token) {
  try {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36";
    const superProperties = Buffer.from(JSON.stringify({
      os: "Windows",
      browser: "Discord Client",
      release_channel: "stable",
      client_version: "1.0.9215",
      os_version: "10.0.19045",
      os_arch: "x64",
      app_arch: "x64",
      system_locale: "en-US",
      has_client_mods: false,
      client_launch_id: randomUUID(),
      browser_user_agent: userAgent,
      browser_version: "37.6.0",
      os_sdk_version: "19045",
      client_build_number: 471091,
      native_build_number: 72186,
      client_event_source: null,
      launch_signature: randomUUID(),
      client_heartbeat_session_id: randomUUID(),
      client_app_state: "focused",
    })).toString("base64");

    const res = await fetch("https://discord.com/api/v9/users/@me/virtual-currency/balance", {
      headers: {
        Authorization: token,
        "User-Agent": userAgent,
        "Accept-Language": "en-US",
        "Origin": "https://discord.com",
        "X-Debug-Options": "bugReporterEnabled",
        "X-Discord-Locale": "en-US",
        "X-Discord-Timezone": "Asia/Calcutta",
        "X-Super-Properties": superProperties,
        Referer: "https://discord.com/shop?tab=orbs",
      },
    });
    if (!res.ok) return { ok: false, error: `Discord balance fetch failed (${res.status}).` };

    const data = await res.json().catch(() => null);
    if (!Number.isFinite(data?.balance)) return { ok: false, error: "Discord did not return an Orbs balance." };

    return { ok: true, orbs: data.balance, source: "Discord virtual currency balance" };
  } catch (error) {
    return { ok: false, error: error.message || "Could not fetch Discord Orbs balance." };
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                      FILE HELPERS                           ║
// ╚══════════════════════════════════════════════════════════════╝

function sanitizeToken(t)     { return t.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 32); }
function cleanupInstance(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }

function cleanupInstancesFolder() {
  const dir = path.join(BASE_DIR, "instances");
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(tag("manager") + dim(" [cleanup] cleaned up instances"));
}

function cleanupStaleInstances() {
  const dir = path.join(BASE_DIR, "instances");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return 0;
  }

  let removed = 0;
  const activeDirs = new Set([...runningInstances.keys()].map(sanitizeToken));
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || activeDirs.has(entry.name)) continue;
    try {
      fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
      removed += 1;
    } catch (_) {}
  }
  return removed;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║               SHARED ENGINE SESSION EXECUTION               ║
// ╚══════════════════════════════════════════════════════════════╝

function spawnInstance(
  token,
  userId,
  channelId,
  client,
  embedMessageId = null,
  tokenList = [],
  tokenIndex = 0,
  maxQuests = Infinity,
  targetQuestId = null
) {
  if (runningInstances.has(token)) {
    return runningInstances.get(token);
  }

  const session = questEngine.startSession({
    token,
    userId,
    channelId,
    embedMessageId,
    tokenList,
    tokenIndex,
    maxQuests,
    targetQuestId,
    maxConcurrentQuests: 2,
    durationMs: RUN_DURATION_MS,
    managerToken: MANAGER_TOKEN,
    logChannelId: LOG_CHANNEL_ID,
    onEnd: async (sess, code, endReason) => {
      runningInstances.delete(token);
      console.log(tag("manager") + dim(` instance ${userId} exited (${code})`));

      if (code === 401 || code === 403) {
        console.log(tag("manager") + rose(` token rejected (${code}) for ${userId} — DMing`));
        try {
          const u = await client.users.fetch(userId);
          await u.send(MSG.invalid_token_dm);
        } catch (e) {
          console.error(tag("manager") + rose(` DM failed: ${e.message}`));
        }
      }

      if (code !== 0 && code !== null) {
        console.log(tag("manager") + rose(` instance failed for ${userId}; not sending done DM`));
        return;
      }

      if (endReason === "stopped" || endReason === "restart") return;

      const nextIndex = tokenIndex + 1;
      if (tokenList.length > 1 && nextIndex < tokenList.length) {
        console.log(tag("manager") + peach(` chaining token [${nextIndex + 1}/${tokenList.length}] for ${userId}`));
        setTimeout(() => chainNextToken(client, tokenList, nextIndex, userId, channelId), 2000);
      } else {
        try {
          const u = await client.users.fetch(userId);
          await u.send(MSG.session_done_dm);
        } catch (e) {
          console.error(tag("manager") + rose(` DM failed for ${userId}: ${e.message}`));
        }
      }
    },
  });

  const instanceInfo = {
    process: session.process,
    userId,
    channelId,
    startTime: session.startTime,
    tokenList,
    tokenIndex,
    get endReason() { return session.endReason; },
    set endReason(val) { session.endReason = val; },
    session,
    targetQuestId,
  };

  runningInstances.set(token, instanceInfo);
  console.log(tag("manager") + mint(` ✓ instance started (shared engine)`) + dim(` · ${userId} [${tokenIndex + 1}/${Math.max(tokenList.length, 1)}]`));
  return instanceInfo;
}

async function chainNextToken(client, tokenList, fromIndex, userId, channelId) {
  for (let i = fromIndex; i < tokenList.length; i++) {
    const nextToken = tokenList[i];
    if (!nextToken) continue;
    const check = await validateToken(nextToken);
    if (!check.valid) {
      console.log(tag("manager") + rose(` token [${i + 1}] invalid for ${userId} — skipping`));
      try { const u = await client.users.fetch(userId); await u.send(MSG.invalid_token_dm); }
      catch (_) {}
      continue;
    }
    const tokens = loadTokens();
    const isBooster = Array.isArray(tokens[userId]);
    const hasUnlimited = isBooster || isUnlimitedEnabled();
    spawnInstance(nextToken, userId, channelId, client, null, tokenList, i, hasUnlimited ? Infinity : 2);
    return;
  }
  try { const u = await client.users.fetch(userId); await u.send(MSG.session_done_dm); }
  catch (_) {}
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                     QUEST CHECKER                           ║
// ╚══════════════════════════════════════════════════════════════╝

function randBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function scheduleQuestCheck(client) {
  const delay = randBetween(QUEST_CHECK_MIN_MS, QUEST_CHECK_MAX_MS);
  console.log(tag("checker") + dim(` next check in ${Math.round(delay / 60000)} min`));

  setTimeout(async () => {
    console.log(tag("checker") + pink(" checking for available quests..."));

    const tokens  = loadTokens();
    const entries = Object.entries(tokens);
    if (entries.length === 0) { scheduleQuestCheck(client); return; }

    let questsFound = false;
    for (const [, val] of entries) {
      const probe = Array.isArray(val) ? val[0] : val;
      if (!probe) continue;
      questsFound = await checkQuestsAvailable(probe);
      if (questsFound) break;
    }

    if (!questsFound) {
      console.log(tag("checker") + dim(" no quests — checking again later"));
      scheduleQuestCheck(client);
      return;
    }

    console.log(tag("checker") + mint(" quests available — auto-starting boosters"));
    const guild = client.guilds.cache.first();

    for (const [userId, val] of entries) {
      try {
        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
        if (!isPremium(member)) continue;

        const tokenList = (Array.isArray(val) ? val : [val]).filter(Boolean);
        if (tokenList.length === 0) continue;
        if (tokenList.some(t => runningInstances.has(t))) continue;

        const firstToken = tokenList[0];
        const check      = await validateToken(firstToken);
        if (!check.valid) {
          try { const u = await client.users.fetch(userId); await u.send(MSG.invalid_token_dm); }
          catch (_) {}
          continue;
        }

        const allTokens = loadTokens();
        const isBooster = Array.isArray(allTokens[userId]);
        const hasUnlimited = isBooster || isUnlimitedEnabled();
        spawnInstance(firstToken, userId, LOG_CHANNEL_ID, client, null, tokenList, 0, hasUnlimited ? Infinity : 2);
        console.log(tag("checker") + mint(` ✓ auto-started ${userId}`));
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(tag("checker") + rose(` error for ${userId}: ${e.message}`));
      }
    }

    scheduleQuestCheck(client);
  }, delay);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                      RESTART                                ║
// ╚══════════════════════════════════════════════════════════════╝

function scheduleRestart() {
  setTimeout(() => {
    console.log(tag("manager") + peach(" ⟳ hourly cleanup"));
    cleanupStaleInstances();
    console.log(tag("manager") + dim(" [cleanup] cleaned up instances"));
    scheduleRestart();
  }, MANAGER_RESTART_MS);
}

function killAll() {
  questEngine.stopAll("restart");
  runningInstances.clear();
}

module.exports = {
  runningInstances,
  questEngine,
  // vault
  loadTokens, getToken, getTokenList, setTokenSlot, saveToken, clearTokens, getStats,
  // validation
  validateToken, checkQuestsAvailable, fetchTokenOrbs, fetchAvailableQuests,
  // files
  sanitizeToken, cleanupInstance, cleanupInstancesFolder, cleanupStaleInstances,
  // spawn
  spawnInstance, chainNextToken,
  // scheduler
  scheduleQuestCheck, scheduleRestart, killAll,
};
