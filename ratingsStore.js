// ratingsStore.js — persistent staff rating storage
const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "database", "ratings.json");

function load() {
  if (!fs.existsSync(FILE)) return {};
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")); } catch { return {}; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Add or update a rating for a staff member.
 * Only one vote per voter per staff member (overwrites previous).
 * @param {string} staffId
 * @param {string} voterId
 * @param {string} voterTag
 * @param {number} stars  1–5
 */
function setRating(staffId, voterId, voterTag, stars) {
  const data = load();
  if (!data[staffId]) data[staffId] = { ratings: [] };

  const existing = data[staffId].ratings.findIndex(r => r.voterId === voterId);
  const entry = { voterId, voterTag, stars, at: new Date().toISOString() };

  if (existing !== -1) {
    data[staffId].ratings[existing] = entry;
  } else {
    data[staffId].ratings.push(entry);
  }

  save(data);
}

/**
 * Get all ratings for a staff member.
 * Returns { ratings: [], average: number, total: number, percentage: number }
 */
function getRatings(staffId) {
  const data = load();
  const entry = data[staffId] || { ratings: [] };
  const ratings = entry.ratings;
  const total = ratings.length;
  const sum = ratings.reduce((acc, r) => acc + r.stars, 0);
  const average = total ? +(sum / total).toFixed(2) : 0;
  const percentage = total ? Math.round((sum / (total * 5)) * 100) : 0;
  return { ratings, average, total, percentage };
}

/**
 * Clear all ratings for a staff member.
 * @param {string} staffId
 */
function clearRating(staffId) {
  const data = load();
  if (data[staffId]) {
    data[staffId] = { ratings: [] };
    save(data);
  }
}

module.exports = { setRating, getRatings, clearRating };
