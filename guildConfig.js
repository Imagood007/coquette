// guildConfig.js — multi-guild configuration storage & helpers
const fs = require("fs");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");

const CONFIG_PATH = path.join(__dirname, "database", "guild-configs.json");
const { MAIN_SERVER_ID, OWNER_ROLE_ID, OWNER_ID, ALLOWED_ROLE_ID: MAIN_DEFAULT_ACCESS_ROLE } = require("./config");
const MAIN_DEFAULT_QUEST_CHANNEL = "";

function loadConfigs() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    console.error("[guildConfig] load error:", err.message);
    return {};
  }
}

function saveConfigs(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[guildConfig] save error:", err.message);
  }
}

function getGuildConfig(guildId) {
  const configs = loadConfigs();
  const cfg = configs[guildId] || {};

  if (guildId === MAIN_SERVER_ID) {
    return {
      questChannelId: cfg.questChannelId || MAIN_DEFAULT_QUEST_CHANNEL,
      questAccessRoleId: cfg.questAccessRoleId || MAIN_DEFAULT_ACCESS_ROLE,
      ...cfg,
    };
  }

  return {
    questChannelId: cfg.questChannelId || null,
    questAccessRoleId: cfg.questAccessRoleId || null,
    ...cfg,
  };
}

function setGuildConfig(guildId, updates) {
  const configs = loadConfigs();
  configs[guildId] = {
    ...(configs[guildId] || {}),
    ...updates,
    updatedAt: Date.now(),
  };
  saveConfigs(configs);
  return configs[guildId];
}

function resetGuildConfig(guildId) {
  const configs = loadConfigs();
  if (configs[guildId]) {
    delete configs[guildId];
    saveConfigs(configs);
    return true;
  }
  return false;
}

function getQuestChannelId(guildId) {
  const cfg = getGuildConfig(guildId);
  return cfg.questChannelId || null;
}

function getQuestAccessRoleId(guildId) {
  const cfg = getGuildConfig(guildId);
  return cfg.questAccessRoleId || null;
}

function isGuildAdmin(member) {
  if (!member) return false;
  const OWNER_ID = "806113872620421140";
  const memberId = member.id || member.user?.id;
  if (memberId === OWNER_ID) return true;
  if (member.guild?.ownerId === memberId) return true;
  return (
    member.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    member.permissions?.has?.(PermissionFlagsBits.ManageGuild)
  );
}

function memberHasRole(member, roleId) {
  if (!member || !roleId) return false;
  if (member.roles?.cache) {
    if (member.roles.cache.has(roleId)) return true;
  }
  if (Array.isArray(member.roles)) {
    if (member.roles.includes(roleId)) return true;
  }
  if (Array.isArray(member._roles)) {
    if (member._roles.includes(roleId)) return true;
  }
  return false;
}

function hasGuildAccess(member) {
  if (!member) return false;
  const memberId = member.id || member.user?.id;

  // Bot owner has access everywhere
  if (OWNER_ID && memberId === OWNER_ID) return true;
  if (OWNER_ROLE_ID && memberHasRole(member, OWNER_ROLE_ID)) return true;

  const guild = member.guild;
  const guildId = guild?.id;

  // Main server: check booster, premium, or allowed role list
  if (!guildId || guildId === MAIN_SERVER_ID) {
    const { ALLOWED_ROLE_IDS, isPremium } = require("./config");
    return ALLOWED_ROLE_IDS.some((id) => memberHasRole(member, id)) || isPremium(member);
  }

  // Other servers:
  // Server owners and administrators have default access
  if (guild?.ownerId === member.id) return true;
  if (
    member.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    member.permissions?.has?.(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  // Check configured quest access role in this server
  const roleId = getQuestAccessRoleId(guildId);
  if (roleId) {
    return memberHasRole(member, roleId);
  }

  return false;
}

module.exports = {
  MAIN_SERVER_ID,
  getGuildConfig,
  setGuildConfig,
  resetGuildConfig,
  getQuestChannelId,
  getQuestAccessRoleId,
  isGuildAdmin,
  memberHasRole,
  hasGuildAccess,
};
