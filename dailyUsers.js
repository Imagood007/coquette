const fs = require("fs");
const path = require("path");

const TRACKER_PATH = path.join(__dirname, "database", "daily-users.json");

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

function getToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function trackUser(userId) {
  const data = load();
  const today = getToday();
  if (!data[today]) data[today] = [];
  if (!data[today].includes(userId)) data[today].push(userId);
  save(data);
}

function getDailyCount() {
  const data = load();
  const today = getToday();
  return (data[today] || []).length;
}

function getUsersToday() {
  const data = load();
  const today = getToday();
  return data[today] || [];
}

function getDailyHistory() {
  const data = load();
  return Object.entries(data)
    .map(([date, users]) => ({ date, count: users.length }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function getTotalUniqueUsers() {
  const data = load();
  return new Set(Object.values(data).flat().filter(id => typeof id === "string")).size;
}

module.exports = { trackUser, getDailyCount, getUsersToday, getDailyHistory, getTotalUniqueUsers };
