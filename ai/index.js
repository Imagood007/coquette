const { AI_SYSTEM_PROMPT, GEMINI_API_KEY: CONFIG_GEMINI_KEY } = require("../config");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || CONFIG_GEMINI_KEY || "";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
const activeConversations = new Map();

async function askGemini(conversation) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    return "AI service is currently not configured. Set GEMINI_API_KEY to enable chat.";
  }
  // Convert standard conversation format to Gemini format
  const contents = conversation.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: AI_SYSTEM_PROMPT }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1200,
      }
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return content || "Sorry, I couldn't process that.";
}

function getConversation(userId) {
  if (!activeConversations.has(userId)) {
    activeConversations.set(userId, []);
  }
  return activeConversations.get(userId);
}

function resetConversation(userId) {
  activeConversations.delete(userId);
}

async function handleChat(userId, userMessage) {
  const conversation = getConversation(userId);
  conversation.push({ role: "user", content: userMessage });

  const reply = await askGemini(conversation);
  conversation.push({ role: "assistant", content: reply });

  if (conversation.length > 20) {
    // Splice oldest user/assistant pair
    conversation.splice(0, 2);
  }

  return reply;
}

module.exports = { handleChat, resetConversation };
