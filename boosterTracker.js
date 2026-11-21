const fs = require("fs");
const path = require("path");

const TRACKER_PATH = path.join(__dirname, "database", "booster-alts.json");

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

function addBoosterAlt(boosterId, altId, guildId) {
  const data = load();
  data[altId] = { boosterId, guildId };
  save(data);
}

function removeBoosterAlt(altId) {
  const data = load();
  if (data[altId]) {
    delete data[altId];
    save(data);
    return true;
  }
  return false;
}

function getAllAlts() {
  return load();
}

module.exports = { addBoosterAlt, removeBoosterAlt, getAllAlts };
