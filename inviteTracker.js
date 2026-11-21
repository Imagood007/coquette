const fs = require("fs");
const path = require("path");

const INVITES_PATH = path.join(__dirname, "database", "invites.json");
const GRANTS_PATH = path.join(__dirname, "database", "access-grants.json");
const HISTORY_PATH = path.join(__dirname, "database", "invite-history.json");
const { MAIN_SERVER_ID } = require("./config");

function load(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function save(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[inviteTracker] save error:", err.message);
  }
}

function resolveGuildAndArgs(arg1, arg2, arg3) {
  // If arg3 is provided, signature is (guildId, inviterId, invitedIds)
  if (arg3 !== undefined) {
    return { guildId: arg1 || MAIN_SERVER_ID, id1: arg2, id2: arg3 };
  }
  // If only 2 arguments are provided:
  // Could be (guildId, id) or (inviterId, invitedIds)
  if (Array.isArray(arg2)) {
    return { guildId: MAIN_SERVER_ID, id1: arg1, id2: arg2 };
  }
  return { guildId: arg1 || MAIN_SERVER_ID, id1: arg2 };
}

function recordInvites(arg1, arg2, arg3) {
  let guildId = MAIN_SERVER_ID;
  let inviterId = arg1;
  let invitedIds = arg2;

  if (arg3 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    inviterId = arg2;
    invitedIds = arg3;
  }

  if (!Array.isArray(invitedIds)) invitedIds = [invitedIds];

  const data = load(INVITES_PATH);
  const history = load(HISTORY_PATH);

  const key = `${guildId}:${inviterId}`;
  if (!data[key]) data[key] = [];
  if (guildId === MAIN_SERVER_ID && !data[inviterId]) data[inviterId] = [];

  for (const id of invitedIds) {
    if (!id || id === inviterId) continue;

    const histKey = `${guildId}:${id}`;
    // Lock them permanently to the first inviter in this guild
    if (history[histKey] && history[histKey] !== inviterId) {
      continue;
    }
    if (guildId === MAIN_SERVER_ID && history[id] && history[id] !== inviterId) {
      continue;
    }

    if (!history[histKey]) {
      history[histKey] = inviterId;
    }
    if (guildId === MAIN_SERVER_ID && !history[id]) {
      history[id] = inviterId;
    }

    if (!data[key].includes(id)) {
      data[key].push(id);
    }
    if (guildId === MAIN_SERVER_ID && !data[inviterId].includes(id)) {
      data[inviterId].push(id);
    }
  }

  save(INVITES_PATH, data);
  save(HISTORY_PATH, history);
}

function getHistoryOf(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let invitedId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    invitedId = arg2;
  }

  const history = load(HISTORY_PATH);
  const histKey = `${guildId}:${invitedId}`;
  if (history[histKey]) return history[histKey];
  if (guildId === MAIN_SERVER_ID && history[invitedId]) return history[invitedId];
  return null;
}

function getInviterOf(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let invitedId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    invitedId = arg2;
  }

  const data = load(INVITES_PATH);
  const keyPrefix = `${guildId}:`;

  for (const [key, invitedIds] of Object.entries(data)) {
    if (key.startsWith(keyPrefix) && Array.isArray(invitedIds) && invitedIds.includes(invitedId)) {
      return key.slice(keyPrefix.length);
    }
    if (guildId === MAIN_SERVER_ID && !key.includes(":") && Array.isArray(invitedIds) && invitedIds.includes(invitedId)) {
      return key;
    }
  }

  return getHistoryOf(guildId, invitedId);
}

function getInvitesOf(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let inviterId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    inviterId = arg2;
  }

  const data = load(INVITES_PATH);
  const key = `${guildId}:${inviterId}`;
  if (data[key] && Array.isArray(data[key])) return data[key];
  if (guildId === MAIN_SERVER_ID && data[inviterId] && Array.isArray(data[inviterId])) return data[inviterId];
  return [];
}

function removeInvited(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let invitedId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    invitedId = arg2;
  }

  const data = load(INVITES_PATH);
  const keyPrefix = `${guildId}:`;

  for (const key of Object.keys(data)) {
    if (key.startsWith(keyPrefix) || (guildId === MAIN_SERVER_ID && !key.includes(":"))) {
      if (Array.isArray(data[key])) {
        data[key] = data[key].filter((id) => id !== invitedId);
        if (data[key].length === 0 && key.startsWith(keyPrefix)) {
          delete data[key];
        }
      }
    }
  }

  save(INVITES_PATH, data);
}

function recordGrant(adminId, adminTag, userId, userTag) {
  const data = load(GRANTS_PATH);
  const key = `${userId}_${Date.now()}`;
  data[key] = {
    adminId,
    adminTag,
    userId,
    userTag,
    timestamp: Date.now(),
  };
  save(GRANTS_PATH, data);
}

function getGrants() {
  const data = load(GRANTS_PATH);
  return Object.entries(data)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getAllInvitedBy(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let inviterId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    inviterId = arg2;
  }

  const history = load(HISTORY_PATH);
  const keyPrefix = `${guildId}:`;
  const result = [];

  for (const [histKey, storedInviterId] of Object.entries(history)) {
    if (storedInviterId === inviterId) {
      if (histKey.startsWith(keyPrefix)) {
        const id = histKey.slice(keyPrefix.length);
        if (!result.includes(id)) result.push(id);
      } else if (guildId === MAIN_SERVER_ID && !histKey.includes(":")) {
        if (!result.includes(histKey)) result.push(histKey);
      }
    }
  }

  return result;
}

/**
 * Returns active members currently in the guild who were invited by userId.
 * Solves the issue where an invited user left and rejoined without requiring
 * two additional invites on a new link.
 */
async function getGuildActiveInvites(guild, userId) {
  if (!guild || !userId) {
    return { activeCount: 0, activeMembers: [], leftMembers: [], totalInvited: 0 };
  }

  const guildId = guild.id;
  const fromInvites = getInvitesOf(guildId, userId);
  const fromHistory = getAllInvitedBy(guildId, userId);

  let fromPersonal = [];
  try {
    const { getInvite } = require("./personalInvites");
    const pInvite = await getInvite(guildId, userId);
    if (pInvite && Array.isArray(pInvite.joinedUserIds)) {
      fromPersonal = pInvite.joinedUserIds;
    }
  } catch {}

  const allSet = new Set([...fromInvites, ...fromHistory, ...fromPersonal]);
  allSet.delete(userId); // can't invite self

  const activeMembers = [];
  const leftMembers = [];

  for (const invitedId of allSet) {
    let m = guild.members.cache.get(invitedId);
    if (!m) {
      m = await guild.members.fetch(invitedId).catch(() => null);
    }
    if (m && !m.user?.bot) {
      activeMembers.push(invitedId);
    } else {
      leftMembers.push(invitedId);
    }
  }

  return {
    activeCount: activeMembers.length,
    activeMembers,
    leftMembers,
    totalInvited: allSet.size,
  };
}

module.exports = {
  recordInvites,
  getInviterOf,
  getHistoryOf,
  getInvitesOf,
  removeInvited,
  recordGrant,
  getGrants,
  getAllInvitedBy,
  getGuildActiveInvites,
};
