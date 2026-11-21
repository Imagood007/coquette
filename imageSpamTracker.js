async function checkImageSpam(message) {
  // Only count image attachments in the current message
  const imageCount = message.attachments.filter(a => a.contentType && a.contentType.startsWith("image/")).size;
  
  // If a user sends a "bunch" of 4 or more images in a single message (Discord's 4-image grid), delete it
  if (imageCount >= 4) {
    if (message.deletable) {
      message.delete().catch(() => {});
      console.log(`[anti-spam] Deleted a 4+ image bunch from ${message.author.tag}`);
    }
  }
}

module.exports = { checkImageSpam };
