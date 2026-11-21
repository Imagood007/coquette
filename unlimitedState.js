const fs   = require("fs");
const path = require("path");

const STATE_PATH = path.join(__dirname, "database", "unlimited.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { enabled: false };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function isUnlimitedEnabled() {
  return loadState().enabled === true;
}

function setUnlimitedEnabled(enabled) {
  saveState({ enabled: !!enabled });
  return !!enabled;
}

function toggleUnlimited() {
  const next = !isUnlimitedEnabled();
  setUnlimitedEnabled(next);
  return next;
}

module.exports = { isUnlimitedEnabled, setUnlimitedEnabled, toggleUnlimited };
