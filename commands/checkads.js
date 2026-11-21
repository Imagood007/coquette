const { QUEST_ROLE_4, OWNER_ID } = require("../config");
const { getAllAdServerIds } = require("../adsTracker");
const { loadTokens } = require("../instances");

module.exports = {
  name: "checkads",
  aliases: [],
  description: "Verify ad server memberships for all users and update roles",
  guildOnly: true,
  async execute(message, args, { client }) {
    if (message.author.id !== OWNER_ID && message.author.id !== "806113872620421140") {
      return message.reply("Only the bot owner can use this command.");
    }
    
    // Load tokens from encrypted shards
    const tokens = loadTokens();
    
    const userIds = Object.keys(tokens);
    if (!userIds.length) return message.reply("No users found.");
    
    const adServers = getAllAdServerIds();
    if (!adServers.length) return message.reply("No ad servers currently active. Add some using `.ads` first.");
    
    await message.reply(`Starting ad server check for **${userIds.length}** users...\nThis will check their tokens against active ad servers and update their roles. ETA: **${(userIds.length * 0.3).toFixed(1)}s**`);
    
    let added = 0;
    let removed = 0;
    let errors = 0;
    let skipped = 0;
    
    const guild = message.guild;
    
    for (const userId of userIds) {
      try {
        let val = tokens[userId];
        let token = Array.isArray(val) ? val[0] : val;
        if (!token) {
          skipped++;
          continue;
        }
        
        // Fetch user's guilds using their token
        const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
          headers: { Authorization: token }
        });
        
        if (!res.ok) {
          errors++;
          continue;
        }
        
        const guilds = await res.json();
        const inAnyAdServer = Array.isArray(guilds) && guilds.some(g => adServers.includes(g.id));
        
        // Fetch member from the main guild
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const hasRole = member.roles.cache.has(QUEST_ROLE_4);
          if (inAnyAdServer && !hasRole) {
            await member.roles.add(QUEST_ROLE_4).catch(()=>{});
            added++;
          } else if (!inAnyAdServer && hasRole) {
            await member.roles.remove(QUEST_ROLE_4).catch(()=>{});
            removed++;
          } else {
            skipped++; // no change needed
          }
        } else {
          skipped++; // user not in the main guild
        }
        
        // Sleep 300ms to respect Discord rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        errors++;
      }
    }
    
    await message.channel.send(`Done **Ad Check Complete**\n- Roles Granted: **${added}**\n- Roles Revoked: **${removed}**\n- No Change: **${skipped}**\n- Errors/Invalid Tokens: **${errors}**`);
  }
};
