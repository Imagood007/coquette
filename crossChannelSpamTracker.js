const SPAM_CHANNELS = new Set(
  process.env.SPAM_CHANNELS
    ? process.env.SPAM_CHANNELS.split(",").map((s) => s.trim())
    : []
);

const userMessages = new Map();

async function checkCrossChannelSpam(message) {
  // Only track messages in the specific listed channels
  if (!SPAM_CHANNELS.has(message.channel.id)) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const history = userMessages.get(userId);
  history.push({
    messageId: message.id,
    channelId: message.channel.id,
    timestamp: now,
    messageObj: message
  });

  // Keep only messages from the last 3 seconds
  const recent3s = history.filter(h => now - h.timestamp <= 3000);
  userMessages.set(userId, recent3s);

  const uniqueChannels = new Set(recent3s.map(h => h.channelId));

  // "rember message should be send in within 3 sec in all channel then delete his messsage"
  // Trigger if they managed to hit at least 2 of the listed channels within 3 seconds
  if (uniqueChannels.size >= 2) {
    console.log(`[anti-spam] ${message.author.tag} blasted multiple monitored channels in 3s. Deleting.`);
    
    // Delete all their messages in this 3-second window
    for (const h of recent3s) {
      if (h.messageObj.deletable) {
        h.messageObj.delete().catch(() => {});
      }
    }
    
    // Clear history to avoid re-triggering repeatedly for the same blast
    userMessages.delete(userId);
  }
}

// Memory cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of userMessages.entries()) {
    const recent = history.filter(h => now - h.timestamp <= 3000);
    if (recent.length === 0) {
      userMessages.delete(userId);
    } else {
      userMessages.set(userId, recent);
    }
  }
}, 60000);

module.exports = { checkCrossChannelSpam };
