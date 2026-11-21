// ╔══════════════════════════════════════════════════════════════╗
// ║                    ENCRYPTED TOKEN VAULT                    ║
// ║      5-shard AES-256-GCM secure encrypted token storage      ║
// ╚══════════════════════════════════════════════════════════════╝

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE_DIR = __dirname;
const DB_DIR = path.join(BASE_DIR, "database");
const KEY_FILE = path.join(DB_DIR, ".token_key");
const SHARD_COUNT = 5;

// Algorithm: AES-256-GCM
// Binary format per shard:
// [ 12 bytes IV ] [ 16 bytes AuthTag ] [ N bytes Ciphertext ]

function getMasterKey() {
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    const raw = process.env.TOKEN_ENCRYPTION_KEY.trim();
    if (raw.length === 64) {
      return Buffer.from(raw, "hex");
    }
    return crypto.createHash("sha256").update(raw).digest();
  }

  if (fs.existsSync(KEY_FILE)) {
    try {
      const keyBuf = fs.readFileSync(KEY_FILE);
      if (keyBuf.length === 32) return keyBuf;
      if (keyBuf.length === 64) return Buffer.from(keyBuf.toString("utf-8").trim(), "hex");
    } catch (_) {}
  }

  // Generate strong persistent 32-byte key
  const newKey = crypto.randomBytes(32);
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, newKey);
  } catch (err) {
    console.error("[tokenCrypto] Failed to persist key file:", err.message);
  }
  return newKey;
}

let MASTER_KEY = null;
function getKey() {
  if (!MASTER_KEY) {
    MASTER_KEY = getMasterKey();
  }
  return MASTER_KEY;
}

function getShardPath(shardIndex) {
  // Shards 1 through 5
  return path.join(DB_DIR, `tokens_shard_${shardIndex}.enc`);
}

function getShardIndexForUser(userId) {
  try {
    const big = BigInt(userId);
    return Number(big % BigInt(SHARD_COUNT)) + 1; // 1 to 5
  } catch (_) {
    // If userId is non-numeric, use sha256 modulo
    const hash = crypto.createHash("sha256").update(String(userId)).digest();
    return (hash.readUInt32BE(0) % SHARD_COUNT) + 1;
  }
}

function encryptPayload(dataObj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(dataObj), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

function decryptPayload(buffer) {
  if (!buffer || buffer.length < 28) return {};
  try {
    const key = getKey();
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf-8"));
  } catch (err) {
    return {};
  }
}

function readShard(shardIndex) {
  const filePath = getShardPath(shardIndex);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const buf = fs.readFileSync(filePath);
    return decryptPayload(buf);
  } catch (_) {
    return {};
  }
}

function writeShard(shardIndex, dataObj) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const filePath = getShardPath(shardIndex);
  const encBuffer = encryptPayload(dataObj);
  fs.writeFileSync(filePath, encBuffer);
}

function initShards() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  for (let i = 1; i <= SHARD_COUNT; i++) {
    const p = getShardPath(i);
    if (!fs.existsSync(p)) {
      writeShard(i, {});
    } else {
      try {
        const buf = fs.readFileSync(p);
        const data = decryptPayload(buf);
        if (!data || typeof data !== "object") {
          writeShard(i, {});
        }
      } catch (_) {
        writeShard(i, {});
      }
    }
  }
}

// Global combined token map
function loadTokens() {
  const combined = {};
  for (let i = 1; i <= SHARD_COUNT; i++) {
    const shard = readShard(i);
    for (const [uid, val] of Object.entries(shard)) {
      combined[uid] = val;
    }
  }
  return combined;
}

function getToken(userId) {
  if (!userId) return null;
  const shardIdx = getShardIndexForUser(userId);
  const shard = readShard(shardIdx);
  const val = shard[userId];
  if (!val) return null;
  return Array.isArray(val) ? val[0] : val;
}

function getTokenList(userId) {
  if (!userId) return [];
  const shardIdx = getShardIndexForUser(userId);
  const shard = readShard(shardIdx);
  const val = shard[userId];
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function saveToken(userId, token, isBooster = false, maxTokens = 5) {
  if (!userId || !token) return;
  const shardIdx = getShardIndexForUser(userId);
  const shard = readShard(shardIdx);
  const existing = shard[userId];

  if (isBooster) {
    if (Array.isArray(existing)) {
      if (!existing.includes(token) && existing.length < maxTokens) existing.push(token);
      shard[userId] = existing;
    } else if (existing) {
      shard[userId] = existing === token ? [token] : [existing, token];
    } else {
      shard[userId] = [token];
    }
  } else {
    shard[userId] = token;
  }

  writeShard(shardIdx, shard);
}

function setTokenSlot(userId, slotIndex, token) {
  if (!userId) return;
  const shardIdx = getShardIndexForUser(userId);
  const shard = readShard(shardIdx);
  let list = Array.isArray(shard[userId]) ? [...shard[userId]] : (shard[userId] ? [shard[userId]] : []);
  
  while (list.length <= slotIndex) list.push(null);
  list[slotIndex] = token;
  while (list.length > 0 && list[list.length - 1] === null) list.pop();

  if (list.length === 0) {
    delete shard[userId];
  } else {
    shard[userId] = list.length === 1 ? list[0] : list;
  }
  writeShard(shardIdx, shard);
}

function clearTokens(userId) {
  if (!userId) return;
  const shardIdx = getShardIndexForUser(userId);
  const shard = readShard(shardIdx);
  if (shard[userId] !== undefined) {
    delete shard[userId];
    writeShard(shardIdx, shard);
  }
}

// Auto-initialize shards on load
initShards();

module.exports = {
  loadTokens,
  getToken,
  getTokenList,
  saveToken,
  setTokenSlot,
  clearTokens,
  initShards,
  SHARD_COUNT,
};
