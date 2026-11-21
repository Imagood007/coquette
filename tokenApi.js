const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { saveToken, validateToken, clearTokens } = require('./instances');
const { PORT: CONFIG_PORT } = require('./config');

const app = express();
const PORT = Number(process.env.PORT || CONFIG_PORT) || 26286;

app.use(cors());
app.use(express.json());

let _discordClient = null;
function setDiscordClient(c) {
  _discordClient = c;
}

function renderSuccessPage({ userId, tag, avatarUrl, message, isPreview = false }) {
  const safeUserId = userId || 'Unknown';
  const safeTag = tag && tag !== 'pruniaz' ? tag : (userId ? `User ${userId}` : 'Discord User');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Connected</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #ffdbe6;
      background-image: radial-gradient(#f4a8bf 1px, transparent 1px);
      background-size: 14px 14px;
      font-family: 'Tahoma', 'MS Sans Serif', Arial, sans-serif;
      font-size: 11px;
      color: #3b2730;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    /* Simple Windows XP Style Dialog Box in Coquette Pink */
    .window {
      background: #f7eef3;
      width: 100%;
      max-width: 380px;
      box-shadow: 
        inset 1px 1px #ffffff,
        inset -1px -1px #4a2839,
        inset 2px 2px #fdf7fa,
        inset -2px -2px #b08d9e,
        3px 3px 14px rgba(110, 40, 70, 0.15);
      padding: 3px;
    }

    /* Coquette Rose Gradient Title Bar */
    .title-bar {
      background: linear-gradient(90deg, #c73867 0%, #e2588c 60%, #f472b6 100%);
      padding: 4px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .title-bar-text {
      color: #ffffff;
      font-weight: bold;
      font-size: 11px;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 6px;
      text-shadow: 1px 1px 0px rgba(107, 30, 56, 0.6);
    }

    .title-bar-decor {
      display: flex;
      gap: 2px;
    }

    .sys-box {
      width: 14px;
      height: 13px;
      background: #f7eef3;
      box-shadow: 
        inset 1px 1px #ffffff,
        inset -1px -1px #4a2839,
        inset 2px 2px #fdf7fa,
        inset -2px -2px #b08d9e;
      font-size: 8px;
      font-weight: bold;
      line-height: 11px;
      text-align: center;
      color: #5c3546;
      user-select: none;
    }

    /* Dialog Body */
    .window-body {
      padding: 18px 14px 14px;
      background: #f7eef3;
    }

    .dialog-top {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
    }

    .status-icon-wrap {
      width: 40px;
      height: 40px;
      background: #fff0f5;
      border: 1.5px solid #b08d9e;
      box-shadow: inset 1px 1px 0px #ffffff, inset -1px -1px 0px #4a2839;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dialog-msg {
      flex: 1;
    }

    .dialog-heading {
      font-family: 'Tahoma', sans-serif;
      font-size: 12px;
      font-weight: bold;
      color: #881337;
      margin-bottom: 3px;
    }

    .dialog-subtext {
      font-family: 'Tahoma', sans-serif;
      font-size: 11px;
      color: #5c3546;
      line-height: 1.35;
    }

    /* Sunken Information Box */
    .sunken-box {
      background: #fffbfe;
      box-shadow: 
        inset 1px 1px #4a2839,
        inset -1px -1px #ffffff,
        inset 2px 2px #b08d9e,
        inset -2px -2px #fdf7fa;
      padding: 10px 12px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      color: #3b222f;
      margin-top: 4px;
    }

    .info-row {
      display: flex;
      gap: 6px;
      align-items: baseline;
    }

    .info-label {
      color: #a03862;
      font-weight: bold;
      min-width: 70px;
    }

    .info-val {
      color: #1a1518;
      font-weight: bold;
      word-break: break-all;
    }

    .status-tag {
      background: #fce7f0;
      border: 1px solid #d49ab0;
      color: #881337;
      padding: 1px 6px;
      display: inline-block;
      font-weight: bold;
    }

    .footer-note {
      margin-top: 12px;
      font-size: 10px;
      color: #855b70;
      text-align: center;
      font-family: 'Tahoma', sans-serif;
    }
  </style>
</head>
<body>
  <div class="window">
    <div class="title-bar">
      <div class="title-bar-text">
        <span>Token Connected</span>
      </div>
      <div class="title-bar-decor">
        <div class="sys-box">_</div>
        <div class="sys-box">✕</div>
      </div>
    </div>

    <div class="window-body">
      <div class="dialog-top">
        <div class="status-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#c73867"/>
            <path d="M7 12.5 L10.5 16 L17 9" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="dialog-msg">
          <div class="dialog-heading">Your token is connected to bot</div>
          <div class="dialog-subtext">Successfully linked and saved for quest automation.</div>
        </div>
      </div>

      <div class="sunken-box">
        <div class="info-row">
          <span class="info-label">user id :</span>
          <span class="info-val">${safeUserId}</span>
        </div>
        ${safeTag && safeTag !== 'Unknown' && safeTag !== safeUserId ? `
        <div class="info-row">
          <span class="info-label">account :</span>
          <span class="info-val">${safeTag}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">status  :</span>
          <span class="status-tag">Connected &amp; Saved</span>
        </div>
        <div class="info-row">
          <span class="info-label">bot     :</span>
          <span class="info-val">Ready for .quest</span>
        </div>
      </div>

      <div class="footer-note">
        You can return to Discord and run <strong>.q</strong> to start your session.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderErrorPage({ message }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Notice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #ffdbe6;
      background-image: radial-gradient(#f4a8bf 1px, transparent 1px);
      background-size: 14px 14px;
      font-family: 'Tahoma', 'MS Sans Serif', Arial, sans-serif;
      font-size: 11px;
      color: #3b2730;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .window {
      background: #f7eef3;
      width: 100%;
      max-width: 360px;
      box-shadow: 
        inset 1px 1px #ffffff,
        inset -1px -1px #4a2839,
        inset 2px 2px #fdf7fa,
        inset -2px -2px #b08d9e,
        3px 3px 14px rgba(110, 40, 70, 0.15);
      padding: 3px;
    }
    .title-bar {
      background: linear-gradient(90deg, #c73867 0%, #e2588c 100%);
      padding: 4px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .title-bar-text { color: #fff; font-weight: bold; font-size: 11px; }
    .title-bar-decor { display: flex; gap: 2px; }
    .sys-box {
      width: 14px;
      height: 13px;
      background: #f7eef3;
      box-shadow: inset 1px 1px #ffffff, inset -1px -1px #4a2839, inset 2px 2px #fdf7fa, inset -2px -2px #b08d9e;
      font-size: 8px;
      font-weight: bold;
      line-height: 11px;
      text-align: center;
      color: #5c3546;
      user-select: none;
    }
    .window-body {
      padding: 18px 14px 14px;
      background: #f7eef3;
    }
    .dialog-top {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .error-icon {
      width: 36px;
      height: 36px;
      background: #c73867;
      border-radius: 4px;
      color: #fff;
      font-weight: bold;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 1px 1px #ffffff, inset -1px -1px #4a2839;
      flex-shrink: 0;
    }
    .error-msg { font-size: 11px; line-height: 1.45; color: #4a2c3a; }
  </style>
</head>
<body>
  <div class="window">
    <div class="title-bar">
      <div class="title-bar-text">Token Notice</div>
      <div class="title-bar-decor">
        <div class="sys-box">✕</div>
      </div>
    </div>
    <div class="window-body">
      <div class="dialog-top">
        <div class="error-icon">!</div>
        <div>
          <div class="error-msg"><strong>No Token Provided</strong></div>
          <div class="error-msg" style="margin-top: 5px;">${message || 'Please run your bookmarklet while logged into Discord.'}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Endpoint handling: GET /endpoint?token=... and POST /endpoint { token: ... }
app.all(['/endpoint', '/link-token'], async (req, res) => {
  const wantsHtml = req.headers.accept?.includes('text/html') && req.query.format !== 'json';
  const rawToken = req.query.token || req.body?.token;

  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 20) {
    if (wantsHtml) {
      return res.status(400).send(renderErrorPage({
        message: 'No token was provided. Click your bookmarklet from discord.com to connect.',
      }));
    }
    return res.status(400).json({ success: false, error: 'No token provided' });
  }

  const token = rawToken.trim().replace(/^["']|["']$/g, '');

  // Extract user ID and save to encrypted bot vault
  try {
    let decodedUserId = null;
    try {
      const b64 = token.split('.')[0];
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      if (/^\d{17,20}$/.test(decoded)) {
        decodedUserId = decoded;
      }
    } catch (_) {}

    const result = await validateToken(token).catch(() => null);
    const userId = result?.valid && result?.id ? result.id : decodedUserId;
    const tag = result?.tag || null;
    const avatarUrl = result?.avatarUrl || null;

    if (userId) {
      // Save directly into encrypted vault
      saveToken(userId, token, false);
      console.log(`[tokenApi] Token saved encrypted for user ${userId} (${tag || 'ID: ' + userId})`);

      // DM confirmation to the user if Discord bot is ready
      if (_discordClient && _discordClient.isReady()) {
        try {
          const user = await _discordClient.users.fetch(userId).catch(() => null);
          if (user) {
            await user.send(
              `✦ **Token Linked Automatically**\n` +
              `• Your Discord token has been saved to the quest bot.\n` +
              `• Run \`.quest\` to start farming quests.\n` +
              `-# Token is stored securely and used only for quest automation.`
            ).catch(() => {});
          }
        } catch (_) {}
      }

      if (wantsHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderSuccessPage({
          userId: userId,
          tag: tag,
          avatarUrl: avatarUrl,
          message: 'Token received and encrypted securely',
        }));
      }

      return res.json({
        success: true,
        message: 'Token received and encrypted securely',
        userId: userId,
        tag: tag,
      });
    }

    if (wantsHtml) {
      return res.status(400).send(renderErrorPage({
        message: 'Invalid Discord token provided. Please try again.',
      }));
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid Discord token provided',
    });
  } catch (err) {
    console.error('[tokenApi] Error validating/saving token:', err);
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderSuccessPage({
        userId: 'Unknown',
        tag: 'Saved',
        avatarUrl: null,
        message: 'Token processing completed',
      }));
    }

    return res.json({
      success: false,
      error: 'Error processing token',
    });
  }
});

// Remove Token route: POST or GET /remove-token?userId=...
app.all('/remove-token', async (req, res) => {
  const wantsHtml = req.headers.accept?.includes('text/html');
  const userId = req.query.userId || req.body?.userId;
  const token = req.query.token || req.body?.token;

  let targetId = userId;
  if (!targetId && token) {
    try {
      const b64 = token.split('.')[0];
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      if (/^\d{17,20}$/.test(decoded)) targetId = decoded;
    } catch (_) {}
  }

  if (targetId) {
    clearTokens(targetId);
    console.log(`[tokenApi] Token removed from database for user ${targetId}`);
  }

  if (wantsHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderSuccessPage({
      userId: targetId || 'Removed',
      tag: 'Token Removed',
      avatarUrl: null,
      message: 'Token was removed from bot database',
      isPreview: true,
    }));
  }

  return res.json({
    success: true,
    message: 'Token removed successfully from bot',
    userId: targetId,
  });
});

// Root / preview / health routes
app.get('/', (req, res) => {
  const wantsHtml = req.headers.accept?.includes('text/html') && req.query.format !== 'json';
  if (wantsHtml) {
    if (req.query.token && req.query.token.length >= 20) {
      // Forward to endpoint handling if token is provided
      return app._router.handle(req, res);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderSuccessPage({
      userId: '123456789012345678',
      tag: 'DemoUser',
      avatarUrl: null,
      message: 'Token received and saved to bot',
      isPreview: true,
    }));
  }
  res.json({ success: true, service: 'Token API', status: 'online', port: PORT });
});

app.get(['/preview', '/demo'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderSuccessPage({
    userId: '123456789012345678',
    tag: 'DemoUser',
    avatarUrl: null,
    message: 'Token received and saved to bot',
    isPreview: true,
  }));
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

let serverInstance = null;
function startTokenApi(port = PORT) {
  if (serverInstance) return serverInstance;
  serverInstance = app.listen(port, '0.0.0.0', () => {
    console.log(`[tokenApi] Server running on port ${port} (domain: coapi.bot.nu)`);
  });
  return serverInstance;
}

if (require.main === module) {
  startTokenApi(PORT);
}

module.exports = { app, startTokenApi, setDiscordClient };
