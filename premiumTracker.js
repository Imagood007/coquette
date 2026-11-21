const fs = require("fs");
const path = require("path");

const PREMIUM_PATH = path.join(__dirname, "database", "premium.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(PREMIUM_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(PREMIUM_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function grantPremium(userId, adminId, durationMs) {
  const data = load();
  data[userId] = {
    adminId,
    grantedAt: Date.now(),
    expiresAt: Date.now() + (durationMs || 30 * 24 * 60 * 60 * 1000),
  };
  save(data);
}

function getPremiumInfo(userId) {
  const data = load();
  return data[userId] || null;
}

function getAllPremium() {
  const data = load();
  return Object.entries(data)
    .map(([userId, info]) => ({ userId, ...info }))
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

function getExpiredPremiums() {
  const data = load();
  const now = Date.now();
  const expired = [];
  for (const [userId, info] of Object.entries(data)) {
    if (info.expiresAt <= now) {
      expired.push(userId);
    }
  }
  return expired;
}

function deletePremiumEntry(userId) {
  const data = load();
  if (!(userId in data)) return false;
  delete data[userId];
  save(data);
  return true;
}

function removeExpired() {
  const data = load();
  const now = Date.now();
  const expired = [];
  for (const [userId, info] of Object.entries(data)) {
    if (info.expiresAt <= now) {
      expired.push(userId);
      delete data[userId];
    }
  }
  if (expired.length > 0) save(data);
  return expired;
}

module.exports = { grantPremium, getPremiumInfo, getAllPremium, getExpiredPremiums, deletePremiumEntry, removeExpired };
