const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "database", "maintenance.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { enabled: false };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state), "utf-8");
}

function isUnderMaintenance() {
  return loadState().enabled;
}

function setMaintenance(enabled) {
  saveState({ enabled });
}

module.exports = { isUnderMaintenance, setMaintenance };
