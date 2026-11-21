const { BOOSTER_ROLE_ID, BOOSTER_ALT_ROLE_ID } = require("./config");
const { getAllAlts, removeBoosterAlt } = require("./boosterTracker");

async function checkBoosterAlts(client) {
  const alts = getAllAlts();
  const altIds = Object.keys(alts);
  if (altIds.length === 0) return;

  for (const altId of altIds) {
    const data = alts[altId];
    
    // Handle both new format (object) and old format (string)
    const boosterId = typeof data === "string" ? data : data.boosterId;
    const guildId = typeof data === "string" ? null : data.guildId;

    const guildsToCheck = guildId 
      ? [client.guilds.cache.get(guildId)].filter(Boolean) 
      : Array.from(client.guilds.cache.values());

    for (const guild of guildsToCheck) {
      try {
        const boosterMember = await guild.members.fetch(boosterId).catch(() => null);
        const altMember = await guild.members.fetch(altId).catch(() => null);

        let shouldRemove = false;

        if (!boosterMember) {
          shouldRemove = true;
        } else if (!boosterMember.roles.cache.has(BOOSTER_ROLE_ID)) {
          shouldRemove = true;
        }

        if (shouldRemove) {
          console.log(`[booster-alts] Booster ${boosterId} lost boost or left. Removing alt role from ${altId}`);
          if (altMember && altMember.roles.cache.has(BOOSTER_ALT_ROLE_ID)) {
            await altMember.roles.remove(BOOSTER_ALT_ROLE_ID).catch(() => null);
          }
          removeBoosterAlt(altId);
          break;
        }
      } catch (e) {
        console.error(`[booster-alts] Error checking alt ${altId}: ${e.message}`);
      }
    }
  }
}

module.exports = { checkBoosterAlts };
