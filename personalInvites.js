// ╔══════════════════════════════════════════════════════════════╗
// ║                PERSONAL INVITE TRACKER                       ║
// ║  stores personal .link invites in personal-invites.json     ║
// ╚══════════════════════════════════════════════════════════════╝

const fsp = require("fs/promises");
const path = require("path");

const DATA_PATH = path.join(__dirname, "database", "personal-invites.json");
const { MAIN_SERVER_ID } = require("./config");

async function load() {
  try {
    const raw = await fsp.readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function save(data) {
  try {
    await fsp.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[personal-invite] failed to write data: ${e.message}`);
  }
}

async function getInvite(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let userId = arg1;
  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    userId = arg2;
  }

  const data = await load();
  const key = `${guildId}:${userId}`;
  if (data[key]) return { guildId, userId, ...data[key] };
  if (guildId === MAIN_SERVER_ID && data[userId]) return { guildId, userId, ...data[userId] };
  return null;
}

async function createInvite(arg1, arg2, arg3, arg4) {
  let guildId = MAIN_SERVER_ID;
  let userId = arg1;
  let inviteCode = arg2;
  let inviteURL = arg3;

  if (arg4 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    userId = arg2;
    inviteCode = arg3;
    inviteURL = arg4;
  }

  const data = await load();
  const key = `${guildId}:${userId}`;
  const entry = {
    guildId,
    userId,
    inviteCode,
    inviteURL,
    joins: 0,
    joinedUserIds: [],
    maxJoins: 2,
    active: true,
    createdAt: Date.now(),
  };

  data[key] = entry;
  if (guildId === MAIN_SERVER_ID) {
    data[userId] = entry;
  }

  await save(data);
  return entry;
}

async function incrementJoins(arg1, arg2, arg3) {
  let guildId = MAIN_SERVER_ID;
  let userId = arg1;
  let joinedUserId = arg2;

  if (arg3 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    userId = arg2;
    joinedUserId = arg3;
  }

  const data = await load();
  const key = `${guildId}:${userId}`;
  let entry = data[key] || (guildId === MAIN_SERVER_ID ? data[userId] : null);

  if (!entry || !entry.active) return null;
  if (!Array.isArray(entry.joinedUserIds)) entry.joinedUserIds = [];

  const normalizedJoinerId = String(joinedUserId);
  entry.joinedUserIds = entry.joinedUserIds.map(String);

  if (entry.joinedUserIds.includes(normalizedJoinerId)) {
    return { entry: { guildId, userId, ...entry }, counted: false };
  }

  entry.joinedUserIds.push(normalizedJoinerId);
  entry.joins += 1;
  data[key] = entry;
  if (guildId === MAIN_SERVER_ID) data[userId] = entry;

  await save(data);
  return { entry: { guildId, userId, ...entry }, counted: true };
}

async function decrementJoins(arg1, arg2, arg3) {
  let guildId = MAIN_SERVER_ID;
  let userId = arg1;
  let joinedUserId = arg2;

  if (arg3 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    userId = arg2;
    joinedUserId = arg3;
  }

  const data = await load();
  const key = `${guildId}:${userId}`;
  let entry = data[key] || (guildId === MAIN_SERVER_ID ? data[userId] : null);

  if (!entry || !Array.isArray(entry.joinedUserIds)) return null;

  const normalizedJoinerId = String(joinedUserId);
  entry.joinedUserIds = entry.joinedUserIds.map(String);

  if (entry.joinedUserIds.includes(normalizedJoinerId)) {
    entry.joinedUserIds = entry.joinedUserIds.filter((id) => id !== normalizedJoinerId);
    entry.joins = Math.max(0, entry.joins - 1);
    data[key] = entry;
    if (guildId === MAIN_SERVER_ID) data[userId] = entry;
    await save(data);
    return { guildId, userId, ...entry };
  }
  return null;
}

async function deactivateInvite(arg1, arg2) {
  let guildId = MAIN_SERVER_ID;
  let userId = arg1;

  if (arg2 !== undefined) {
    guildId = arg1 || MAIN_SERVER_ID;
    userId = arg2;
  }

  const data = await load();
  const key = `${guildId}:${userId}`;
  let entry = data[key] || (guildId === MAIN_SERVER_ID ? data[userId] : null);

  if (!entry) return null;
  entry.active = false;
  data[key] = entry;
  if (guildId === MAIN_SERVER_ID) data[userId] = entry;

  await save(data);
  return { guildId, userId, ...entry };
}

async function findByCode(code) {
  const data = await load();
  for (const [key, info] of Object.entries(data)) {
    if (info && info.inviteCode === code) {
      let guildId = info.guildId || MAIN_SERVER_ID;
      let userId = info.userId;
      if (!userId && key.includes(":")) {
        [guildId, userId] = key.split(":");
      } else if (!userId) {
        userId = key;
      }
      return { guildId, userId, ...info };
    }
  }
  return null;
}

async function getAll(guildId = MAIN_SERVER_ID) {
  const data = await load();
  const prefix = `${guildId}:`;
  const list = [];

  for (const [key, info] of Object.entries(data)) {
    if (key.startsWith(prefix)) {
      list.push({ guildId, userId: key.slice(prefix.length), ...info });
    } else if (guildId === MAIN_SERVER_ID && !key.includes(":")) {
      list.push({ guildId: MAIN_SERVER_ID, userId: key, ...info });
    }
  }
  return list;
}

module.exports = {
  getInvite,
  createInvite,
  incrementJoins,
  decrementJoins,
  deactivateInvite,
  findByCode,
  getAll,
};
