const fs = require("fs");
const path = require("path");

const ADS_PATH = path.join(__dirname, "database", "ad_config.json");
const AD_BONUS_PATH = path.join(__dirname, "database", "ad-bonus.json");

// ── ad config ─────────────────────────────────────────────────

function loadAds() {
  try {
    const data = JSON.parse(fs.readFileSync(ADS_PATH, "utf-8"));
    if (!data.ads) return { ads: [], currentIndex: 0 };
    return data;
  } catch {
    return { ads: [], currentIndex: 0 };
  }
}

function saveAds(data) {
  fs.writeFileSync(ADS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function addAdConfig(adConfig) {
  const data = loadAds();
  data.ads.push(adConfig);
  saveAds(data);
}

function clearAds() {
  if (fs.existsSync(ADS_PATH)) fs.unlinkSync(ADS_PATH);
  if (fs.existsSync(AD_BONUS_PATH)) fs.unlinkSync(AD_BONUS_PATH);
}

function getNextAd() {
  const data = loadAds();

  if (!data.ads || data.ads.length === 0) return null;

  let currentIndex = data.currentIndex || 0;

  if (currentIndex >= data.ads.length) {
    currentIndex = 0;
  }

  const ad = data.ads[currentIndex];
  data.currentIndex = currentIndex + 1;
  saveAds(data);
  return ad;
}

// ── bonus tracking ─────────────────────────────────────────────

function loadBonus() {
  try {
    return JSON.parse(fs.readFileSync(AD_BONUS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveBonus(data) {
  fs.writeFileSync(AD_BONUS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if user has already claimed the bonus for this ad in the last 24h.
 * adKey = serverId of the ad.
 */
function hasClaimedBonus(userId, adKey) {
  const data = loadBonus();
  const userClaims = data[userId];
  if (!userClaims || !userClaims[adKey]) return false;
  // Allow re-claim after 24h
  return Date.now() - userClaims[adKey] < BONUS_COOLDOWN_MS;
}

/**
 * Record that a user claimed the bonus for this ad (stores timestamp).
 */
function recordBonusClaim(userId, adKey) {
  const data = loadBonus();
  if (!data[userId]) data[userId] = {};
  data[userId][adKey] = Date.now();
  saveBonus(data);
}

function getAdByServerId(serverId) {
  const data = loadAds();
  if (!data.ads) return null;
  return data.ads.find(ad => ad.serverId === serverId) || null;
}

function getAllAdServerIds() {
  const data = loadAds();
  if (!data.ads) return [];
  return data.ads.map(ad => ad.serverId).filter(Boolean);
}

module.exports = { addAdConfig, clearAds, getNextAd, hasClaimedBonus, recordBonusClaim, getAdByServerId, getAllAdServerIds };
