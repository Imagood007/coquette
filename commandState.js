const fs = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "database", "command-state.json");

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

function areCommandsEnabled() {
  return loadState().enabled;
}

function setCommandsEnabled(enabled) {
  saveState({ enabled });
}

module.exports = { areCommandsEnabled, setCommandsEnabled };
