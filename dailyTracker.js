const fs = require("fs");
const path = require("path");

const TRACKER_PATH = path.join(__dirname, "database", "daily-quests.json");
const BASE_DAILY_QUESTS = 2;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function load() {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/** Returns the effective daily quest limit for a user (base + role bonus + any ad bonus). */
function getDailyLimit(userId) {
  const data = load();
  const entry = data[userId];
  return BASE_DAILY_QUESTS + (entry?.roleBonus || 0) + (entry?.bonus || 0);
}

/** Returns how many quests the user can still run today before hitting their limit. */
function getRemainingQuests(userId, roleBonus = 0) {
  const data = load();
  const entry = data[userId];
  const limit = BASE_DAILY_QUESTS + roleBonus + (entry?.bonus || 0);

  if (!entry) return limit;

  const now = Date.now();
  const isExpired = (entry.cooldownUntil && now >= entry.cooldownUntil) || 
                    (entry.resetAt && now >= entry.resetAt);

  if (isExpired) {
    // If their day reset, they have their full base + role bonus (ad bonuses expire)
    return BASE_DAILY_QUESTS + roleBonus;
  }

  const remaining = limit - (entry.count || 0);
  return remaining > 0 ? remaining : 0;
}

/**
 * Set a role-based bonus for a user (idempotent — won't stack on repeated calls).
 * If the user was on cooldown but now has room, the cooldown is cleared.
 */
function applyRoleBonus(userId, bonus) {
  const data = load();
  const entry = data[userId] || { count: 0 };
  if ((entry.roleBonus || 0) === bonus) return; // already applied, nothing to do

  entry.roleBonus = bonus;
  const newLimit = BASE_DAILY_QUESTS + bonus + (entry.bonus || 0);

  if (entry.cooldownUntil && entry.count < newLimit) {
    delete entry.cooldownUntil;
  }

  data[userId] = entry;
  save(data);
}

/** Grant extra quest uses from an ad claim (resets daily). */
function addBonusQuests(userId, count) {
  const data = load();
  const entry = data[userId] || { count: 0, bonus: 0 };

  // Anchor the daily reset window if not yet set
  if (!entry.resetAt) entry.resetAt = Date.now() + COOLDOWN_MS;

  const oldLimit = BASE_DAILY_QUESTS + (entry.bonus || 0);
  const wasExhausted = entry.count >= oldLimit;

  entry.bonus = (entry.bonus || 0) + count;
  const newLimit = BASE_DAILY_QUESTS + entry.bonus;

  // If cooldown was set because they hit the old limit, but they now have
  // room under the new limit — clear the cooldown so they can play again
  if (entry.cooldownUntil && entry.count < newLimit) {
    delete entry.cooldownUntil;
  }

  data[userId] = entry;
  save(data);
  return { wasExhausted, currentCount: entry.count, newLimit };
}

function canStartQuest(userId) {
  const data = load();
  const entry = data[userId];
  if (!entry) return true;

  const limit = BASE_DAILY_QUESTS + (entry.roleBonus || 0) + (entry.bonus || 0);

  // Self-heal: if cooldown is set but user is still under their limit, clear it
  if (entry.cooldownUntil && entry.count < limit) {
    delete entry.cooldownUntil;
    data[userId] = entry;
    save(data);
    return true;
  }

  // If cooldown is active, check if 24h have passed
  if (entry.cooldownUntil) {
    if (Date.now() < entry.cooldownUntil) {
      return false; // still on cooldown
    }
    // Cooldown expired — reset their entry
    delete data[userId];
    save(data);
    return true;
  }

  // Under the limit, allow
  if (entry.count < limit) return true;

  // Hit the limit — set cooldown
  entry.cooldownUntil = Date.now() + COOLDOWN_MS;
  data[userId] = entry;
  save(data);
  return false;
}

function getCooldownRemaining(userId) {
  const data = load();
  const entry = data[userId];
  if (!entry || !entry.cooldownUntil) return 0;
  const remaining = entry.cooldownUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function recordQuestUsed(userId) {
  const data = load();
  const entry = data[userId] || { count: 0, bonus: 0 };

  if (!entry.resetAt) entry.resetAt = Date.now() + COOLDOWN_MS;

  entry.count += 1;

  const limit = BASE_DAILY_QUESTS + (entry.roleBonus || 0) + (entry.bonus || 0);

  // If they've hit the limit, set cooldown timestamp
  if (entry.count >= limit) {
    entry.cooldownUntil = entry.resetAt; // align cooldown with daily reset
  }

  data[userId] = entry;
  save(data);
}

function resetDaily() {
  const data = load();
  const now = Date.now();
  for (const userId of Object.keys(data)) {
    const entry = data[userId];
    // Expire by cooldownUntil OR by the daily resetAt window
    if ((entry.cooldownUntil && now >= entry.cooldownUntil) ||
        (entry.resetAt && now >= entry.resetAt)) {
      delete data[userId];
    }
  }
  save(data);
}

module.exports = { canStartQuest, getCooldownRemaining, recordQuestUsed, resetDaily, addBonusQuests, getDailyLimit, applyRoleBonus, getRemainingQuests };
