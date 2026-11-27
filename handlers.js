// ╔══════════════════════════════════════════════════════════════╗
// ║                       HANDLERS                              ║
// ║  interactionCreate · all UI component + modal builders      ║
// ╚══════════════════════════════════════════════════════════════╝

const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder,
  SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const {
  ALLOWED_ROLE_ID, BOOSTER_ROLE_ID, LOG_CHANNEL_ID, SESSION_MINUTES, isPremium, hasAccess,
  QUEST_EMBED_TITLE, QUEST_EMBED_NOTICE, QUEST_EMBED_FOOTER, QUEST_EMBED_BANNER,
  STATUS_EMBED_TITLE, STATUS_EMBED_FOOTER,
  MAX_TOKENS, GUIDES, GUIDE_VIDEOS, MSG,
  tag, mint, rose, peach,
} = require("./config");

const {
  runningInstances, getToken, getTokenList, setTokenSlot, saveToken, clearTokens, cleanupInstance,
  loadTokens, validateToken, spawnInstance, sanitizeToken, getStats, fetchAvailableQuests,
} = require("./instances");
const { addAdConfig, clearAds, hasClaimedBonus, recordBonusClaim } = require("./adsTracker");
const { setRating, getRatings } = require("./ratingsStore");

let getQuestData, QUEST_DB;
try {
  const qdb = require("./dist/src/questDb");
  getQuestData = qdb.getQuestData;
  QUEST_DB = qdb.QUEST_DB;
} catch (_) {
  const qdb = require("./src/questDb");
  getQuestData = qdb.getQuestData;
  QUEST_DB = qdb.QUEST_DB;
}

const { buildUserEmbed } = require("./embeds.js");
const { getInvite, createInvite } = require("./personalInvites");


const RUN_DURATION_MS = SESSION_MINUTES * 60 * 1000;
const { STAFF_LOG_CHANNEL_ID, STAFF_ROLE_ID } = require("./config");

// ╔══════════════════════════════════════════════════════════════╗
// ║                       MODALS                                ║
// ╚══════════════════════════════════════════════════════════════╝

function buildTokenModal() {
  return new ModalBuilder().setCustomId("token_modal").setTitle("Enter Your Token")
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("token_input").setLabel("Your Discord Token")
        .setStyle(TextInputStyle.Short).setPlaceholder("Paste your token here...").setRequired(true)
    ));
}

function buildSlotModal(slot) {
  return new ModalBuilder()
    .setCustomId(`slot_modal:${slot}`)
    .setTitle(`Token Slot ${slot + 1}`)
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("token_input")
        .setLabel(`Paste token for slot ${slot + 1}`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Your Discord token...")
        .setRequired(true)
    ));
}

function buildStaffModal() {
  return new ModalBuilder()
    .setCustomId("staff_apply_modal")
    .setTitle("Staff Application")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("staff_name").setLabel("Name").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("staff_experience").setLabel("Experience").setStyle(TextInputStyle.Paragraph).setPlaceholder("Tell us your staff/mod/admin experience.").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("staff_active_time").setLabel("Active Time").setStyle(TextInputStyle.Short).setPlaceholder("Example: 4 hours daily, evenings IST").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("staff_timezone").setLabel("Timezone").setStyle(TextInputStyle.Short).setPlaceholder("Example: IST").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("staff_reason").setLabel("Why should we pick you?").setStyle(TextInputStyle.Paragraph).setRequired(true)
      )
    );
}

function buildStaffLogMessage(interaction) {
  const user = interaction.user;
  const userName = interaction.fields.getTextInputValue("staff_name");
  const experience = interaction.fields.getTextInputValue("staff_experience");
  const activeTime = interaction.fields.getTextInputValue("staff_active_time");
  const timezone = interaction.fields.getTextInputValue("staff_timezone");
  const reason = interaction.fields.getTextInputValue("staff_reason");

  return {
    content: `**Staff Application** — from ${user.displayName}\n**user :** ${user.displayName} (\`${user.id}\`)\n**name :** ${userName}\n**experience :** ${experience}\n**active time :** ${activeTime}\n**timezone :** ${timezone}\n**reason :** ${reason}`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`staff_add:${user.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`staff_reject:${user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

function buildAdModal() {
  return new ModalBuilder()
    .setCustomId("ads_setup_modal")
    .setTitle("Set Up Ad")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("ad_server_name").setLabel("Server Name").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("ad_server_details").setLabel("Server Details").setStyle(TextInputStyle.Paragraph).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("ad_server_link").setLabel("Server Link").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("ad_banner_link").setLabel("Banner Link (optional)").setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("ad_server_id")
          .setLabel("Server ID (optional — for +2 quest bonus)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Leave empty for a normal display-only ad")
          .setRequired(false)
      )
    );
}

function buildAdComponents(adConfig, countdown, userId) {
  const container = new ContainerBuilder();

  if (adConfig) {
    let bonusNote = "";
    if (adConfig.serverId) {
      const { hasClaimedBonus } = require("./adsTracker");
      const claimed = hasClaimedBonus(userId, adConfig.serverId);
      bonusNote = claimed
        ? `\n\n✦ *+2 bonus quests claimed!*`
        : `\n\n✦ *Join this server to get **+2 bonus quests** today!*`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${adConfig.serverName}**\n${adConfig.serverDetails}${bonusNote}\n\n*Skipping in ${countdown}...*`)
    ).addSeparatorComponents(new SeparatorBuilder());

    let bannerUrl = adConfig.bannerLink;
    if (bannerUrl && !bannerUrl.startsWith("http")) bannerUrl = "https://" + bannerUrl;
    if (bannerUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl))
      );
    }

    let linkUrl = adConfig.serverLink;
    if (linkUrl && !linkUrl.startsWith("http")) linkUrl = "https://" + linkUrl;
    if (linkUrl) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel(" Ticket").setStyle(ButtonStyle.Link).setURL(linkUrl)
        )
      );
    }
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✦ **Advertise Here**\nIf you want to advertise here or apply for staff, create ticket in the server.\n\n*Skipping in ${countdown}...*`)
    ).addSeparatorComponents(new SeparatorBuilder());

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(" Ticket").setStyle(ButtonStyle.Link).setURL("https://discord.com/channels/1517465560579838072/1575803402128986142")
      )
    );
  }

  return [container];
}

// After countdown — show Skip button; bonus ads also show "Claim +2 Quests" button.
// Automatically shows "✓ Claimed" if the user has already claimed this ad's bonus.
function buildAdSkipComponents(adConfig, userId, adMsgId) {
  const container = new ContainerBuilder();

  if (adConfig) {
    // Auto-detect claimed state
    const claimed = adConfig.serverId ? hasClaimedBonus(userId, adConfig.serverId) : false;

    const bonusNote = adConfig.serverId
      ? claimed
        ? `\n\n✦ *+2 bonus quests claimed!*`
        : `\n\n✦ **Claim +2 Quests** to get 2 extra quests today!*`
      : "";

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${adConfig.serverName}**\n${adConfig.serverDetails}${bonusNote}`)
    ).addSeparatorComponents(new SeparatorBuilder());

    let bannerUrl = adConfig.bannerLink;
    if (bannerUrl && !bannerUrl.startsWith("http")) bannerUrl = "https://" + bannerUrl;
    if (bannerUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl))
      );
    }

    const buttons = [];

    let linkUrl = adConfig.serverLink;
    if (linkUrl && !linkUrl.startsWith("http")) linkUrl = "https://" + linkUrl;
    if (linkUrl) {
      buttons.push(new ButtonBuilder().setLabel("Join Server").setStyle(ButtonStyle.Link).setURL(linkUrl));
    }

    if (adConfig.serverId) {
      if (claimed) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId("noop_claimed")
            .setLabel("✓ Claimed")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );
      } else {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`btn_ad_claim:${userId}:${adConfig.serverId}:${adMsgId}`)
            .setLabel("Claim +2 Quests")
            .setStyle(ButtonStyle.Success)
        );
      }
    }

    buttons.push(
      new ButtonBuilder()
        .setCustomId(`btn_ad_skip:${userId}:${adMsgId}`)
        .setLabel("Skip →")
        .setStyle(ButtonStyle.Secondary)
    );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`✦ **Advertise Here**\nIf you want to advertise here open ticket.`)
    ).addSeparatorComponents(new SeparatorBuilder());

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("ticket")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.com/channels/1517465560579838072/1575803402128986142"),
        new ButtonBuilder()
          .setCustomId(`btn_ad_skip:${userId}:${adMsgId}`)
          .setLabel("Skip →")
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return [container];
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                    UI BUILDERS                              ║
// ╚══════════════════════════════════════════════════════════════╝

function buildAddTokenComponents(userId) {
  const list        = getTokenList(userId);
  const running     = [...runningInstances.entries()].find(([, v]) => v.userId === userId);
  const activeIndex = running ? running[1].tokenIndex : -1;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `♡ **token slots** — ${list.filter(Boolean).length}/${MAX_TOKENS} used\n-# click a slot to set or update its token`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder());

  for (let i = 0; i < MAX_TOKENS; i++) {
    const token     = list[i] ?? null;
    const isActive  = i === activeIndex;
    const preview   = token ? `\`${token.slice(0, 6)}••••••••${token.slice(-4)}\`` : "*empty*";
    const statusTxt = isActive ? "♡ running" : token ? "· saved" : "· empty";

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**slot ${i + 1}** — ${preview}\n-# ${statusTxt}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`btn_slot:${i}:${userId}`)
            .setLabel(token ? `update slot ${i + 1}` : `set slot ${i + 1}`)
            .setStyle(token ? ButtonStyle.Secondary : ButtonStyle.Primary)
        )
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# tokens run in order: slot 1 → slot 2 → slot 3`)
    );

  return [container];
}

async function buildQuestComponents(userId, member = null) {
  const token = getToken(userId);
  const hasToken = !!token;
  const QUEST_EMBED_DESC = "farm discord quests · session runs `16mins`";

  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${QUEST_EMBED_TITLE}**`),
          new TextDisplayBuilder().setContent(QUEST_EMBED_DESC),
          new TextDisplayBuilder().setContent(QUEST_EMBED_NOTICE),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(QUEST_EMBED_BANNER).setDescription("banner"))
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (!hasToken) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("♡ link your account to start automating quests"),
          new TextDisplayBuilder().setContent("-# your token will be saved for future sessions"),
        )
        .setButtonAccessory(
          new ButtonBuilder().setCustomId(`btn_link_token:${userId}`).setLabel("Link Token").setStyle(ButtonStyle.Primary)
        )
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(QUEST_EMBED_FOOTER));
    return [container];
  }

  // Token is linked — fetch available quests
  const questFetch = await fetchAvailableQuests(token);
  if (!questFetch.ok && questFetch.status === 401) {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("✗ **token invalid or expired**\n-# please update your token to view available quests")
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`btn_update_token:${userId}`).setLabel("Update Token").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`btn_remove_token:${userId}`).setLabel("Remove Token").setStyle(ButtonStyle.Danger),
        )
      );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(QUEST_EMBED_FOOTER));
    return [container];
  }

  const availableQuests = questFetch.quests || [];

  if (availableQuests.length === 0) {
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("✦ **no available quests to do**\n-# all quests on this account are completed or expired")
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`btn_update_token:${userId}`).setLabel("Update Token").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`btn_remove_token:${userId}`).setLabel("Remove Token").setStyle(ButtonStyle.Danger),
        )
      );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(QUEST_EMBED_FOOTER));
    return [container];
  }

  // Check daily limits for regular users
  const { isUnlimitedEnabled } = require("./unlimitedState");
  const isBooster = member ? isPremium(member) : false;
  const hasUnlimitedQuests = isBooster || isUnlimitedEnabled();

  let limitReached = false;
  let quotaSubtitle = `-# ${availableQuests.length} quest${availableQuests.length === 1 ? "" : "s"} available · unlimited access`;

  if (!hasUnlimitedQuests) {
    const { canStartQuest, getRemainingQuests, getDailyLimit, getCooldownRemaining } = require("./dailyTracker");
    const limit = getDailyLimit(userId);
    const remaining = getRemainingQuests(userId);

    if (!canStartQuest(userId) || remaining <= 0) {
      limitReached = true;
      const cd = getCooldownRemaining(userId);
      const hours = Math.floor(cd / 3600000);
      const minutes = Math.ceil((cd % 3600000) / 60000);
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      quotaSubtitle = `-# daily limit reached (${limit}/${limit} used) · resets in ${timeStr}`;
    } else {
      quotaSubtitle = `-# ${availableQuests.length} quest${availableQuests.length === 1 ? "" : "s"} available · ${remaining}/${limit} daily runs remaining`;
    }
  }

  const maxAllowed = Math.min(2, availableQuests.length);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`quest_select:${userId}`)
    .setPlaceholder(limitReached ? "Daily limit reached" : "✦ Select quests to do (up to 2)...")
    .setMinValues(1)
    .setMaxValues(limitReached ? 1 : maxAllowed)
    .setDisabled(limitReached);

  for (const q of availableQuests.slice(0, 25)) {
    const d = getQuestData(q);
    const questId = String(q.id || q.config?.id || "unknown");
    const mins = Math.ceil(d.duration / 60);
    const desc = `↳ ${d.reward} · ~${mins} min`.slice(0, 100);
    selectMenu.addOptions({
      label: `✦ ${d.name || questId}`.slice(0, 100),
      value: questId.slice(0, 100),
      description: desc,
    });
  }

  container
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `♡ **select quests to do** (max 2)\n${quotaSubtitle}\n-# ✦ quests work in batch of 2 quests for safety`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(selectMenu)
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_update_token:${userId}`).setLabel("Update Token").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`btn_remove_token:${userId}`).setLabel("Remove Token").setStyle(ButtonStyle.Danger),
      )
    );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(QUEST_EMBED_FOOTER));
  return [container];
}

function buildGuideComponents() {
  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**__HOW TO FIND YOUR TOKEN__**\n-# pick your platform below")
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("btn_guide_pc").setLabel("ᝰ.ᐟ  PC").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("btn_guide_android").setLabel("⨾𓍢ִ໋Android").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("btn_guide_ios").setLabel(".✦ ݁˖  iOS").setStyle(ButtonStyle.Secondary),
        )
      ),
  ];
}

function buildStatusComponents(quests, userAvatarUrl = null) {
  const done    = quests.filter(q => q.status === "done").length;
  const total   = quests.length;
  const running = quests.some(q => q.status === "running");
  const visible = quests.slice(0, 5);

  const container = new ContainerBuilder();

  const titleContent = `${STATUS_EMBED_TITLE}\n` +
    (running
      ? `-# ♡ in progress  ·  ${done} of ${total} complete`
      : `-# ✦ all done  ·  ${done}/${total} completed`);

  if (userAvatarUrl) {
    const header = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(titleContent))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl).setDescription("user avatar"));
    container.addSectionComponents(header);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleContent));
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  for (const [i, q] of visible.entries()) {
    const isDone = q.status === "done" || (q.percent != null && q.percent >= 100);
    const icon   = isDone ? "✦" : q.status === "running" ? "♡" : "✗";
    const reward = q.reward && q.reward !== "Unknown" ? q.reward : "—";
    let details = `↳ ${reward}`;
    if (isDone) {
      const target = q.secondsNeeded || 900;
      details += `  ·  ✦ ${target}/${target}s (100%)  ·  done`;
    } else if (q.status === "running" && q.secondsNeeded) {
      const cur = q.current || 0;
      const target = q.secondsNeeded;
      const pct = q.percent != null ? q.percent : Math.min(100, Math.floor((cur / target) * 100));
      const secLeft = Math.max(0, target - cur);
      const minsLeft = Math.ceil(secLeft / 60);
      const timeLeftStr = q.timeLeft || (minsLeft > 1 ? `~${minsLeft} min left` : secLeft > 0 ? `~${secLeft}s left` : "almost done");
      details += `  ·  ♡ ${cur}/${target}s (${pct}%)  ·  ${timeLeftStr}`;
    }

    const label  = isDone
      ? "✓ done"
      : q.status === "running"
        ? (q.percent != null ? `♡ ${q.percent}%` : "♡ running")
        : "✗ failed";

    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${icon} **${q.name}**\n-# ${details}`))
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`noop_${i}_${q.name.replace(/\s/g, "_").slice(0, 15)}`)
            .setLabel(label).setStyle(ButtonStyle.Secondary).setDisabled(true)
        )
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${STATUS_EMBED_FOOTER}  ·  ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      )
    );

  return [container];
}

function buildNoticeComponents(title, desc = null) {
  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${QUEST_EMBED_TITLE}**`),
          new TextDisplayBuilder().setContent(title)
        )
    );
  if (desc) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc));
  }
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(QUEST_EMBED_FOOTER));
  return [container];
}

async function sendSessionNotice(interaction, title, desc = null) {
  const components = buildNoticeComponents(title, desc);
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.update({
        components,
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    try {
      const fallbackText = `${title}${desc ? `\n${desc}` : ""}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: fallbackText });
      } else {
        await interaction.reply({ content: fallbackText, flags: 64 });
      }
    } catch (_) {}
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                    SESSION STARTER                          ║
// ╚══════════════════════════════════════════════════════════════╝

async function startSession(token, userId, interaction, selectedQuestIds = null) {
  const client    = interaction.client;
  const isBooster = isPremium(interaction.member);
  const { isUnlimitedEnabled } = require("./unlimitedState");
  const hasUnlimitedQuests = isBooster || isUnlimitedEnabled();

  const selectedList = Array.isArray(selectedQuestIds)
    ? selectedQuestIds
    : selectedQuestIds
      ? [selectedQuestIds]
      : [];
  const isBulk = selectedList.length === 0 || selectedList.includes("all");
  const specificQuestIds = isBulk ? [] : selectedList.filter(id => id && id !== "all").slice(0, 2);
  const isSingleQuest = specificQuestIds.length === 1;

  let targetDesc = "";
  if (isBulk) {
    targetDesc = "all available quests (batch of 2)";
  } else if (isSingleQuest) {
    const qName = QUEST_DB?.[specificQuestIds[0]]?.name || "selected quest";
    targetDesc = `quest: ${qName}`;
  } else {
    const names = specificQuestIds.map(id => QUEST_DB?.[id]?.name || id).join(" + ");
    targetDesc = `2 quests: ${names}`;
  }

  await sendSessionNotice(interaction, "♡ **Validating your token...**", `-# target: ${targetDesc}`);

  const check = await validateToken(token);
  if (!check.valid) {
    console.error(tag("session") + rose(` invalid token for ${userId}`));
    await sendSessionNotice(interaction, "✗ **Invalid token**", "-# please re-link your token with .addtoken");
    return;
  }
  if (runningInstances.has(token)) {
    await sendSessionNotice(interaction, "✦ **Session already running**", "-# finishes in ~16 min, or type .stop to end session");
    return;
  }

  let bulkRuns = 2; // default if somehow limits fail

  if (!hasUnlimitedQuests) {
    const { QUEST_ROLE_4 } = require("./config");
    const { canStartQuest, getCooldownRemaining, getDailyLimit, applyRoleBonus, getRemainingQuests } = require("./dailyTracker");
    
    // Check if user is in any ad server
    const { getAllAdServerIds } = require("./adsTracker");
    const adServers = getAllAdServerIds();
    const inAnyAdServer = check.guilds.some(g => adServers.includes(g.id));
    
    const { memberHasRole } = require("./guildConfig");
    let hasRole = memberHasRole(interaction.member, QUEST_ROLE_4);
    let roleBonus = 0;

    // Grant or revoke role based on server membership safely
    try {
      let guildMember = interaction.member?.roles?.add
        ? interaction.member
        : await interaction.guild?.members?.fetch(userId).catch(() => null);

      if (guildMember?.roles?.add) {
        if (inAnyAdServer && !hasRole) {
          await guildMember.roles.add(QUEST_ROLE_4).catch(() => {});
          hasRole = true;
        } else if (!inAnyAdServer && hasRole) {
          await guildMember.roles.remove(QUEST_ROLE_4).catch(() => {});
          hasRole = false;
        }
      }
    } catch (_) {}

    if (hasRole) {
      roleBonus = 2;
      applyRoleBonus(userId, roleBonus);
    } else {
      applyRoleBonus(userId, 0); // reset if they lost it
    }

    const remaining = getRemainingQuests(userId, roleBonus);
    const neededRuns = isBulk ? 1 : specificQuestIds.length;

    if (!canStartQuest(userId) || remaining < neededRuns) {
      const cd = getCooldownRemaining(userId);
      const hours = Math.floor(cd / 3600000);
      const minutes = Math.ceil((cd % 3600000) / 60000);
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      const limit = getDailyLimit(userId);
      if (remaining <= 0) {
        await sendSessionNotice(
          interaction,
          `✦ **Daily limit reached** (${limit}/${limit} used)`,
          `-# daily runs reset in **${timeStr}**`
        );
        return;
      } else {
        await sendSessionNotice(
          interaction,
          `✦ **Insufficient daily runs**`,
          `-# you selected ${neededRuns} quests, but only have **${remaining}** run left today (resets in ${timeStr})`
        );
        return;
      }
    }

    if (isBulk) {
      bulkRuns = remaining;
    } else {
      bulkRuns = specificQuestIds.length;
    }
  } else {
    bulkRuns = isBulk ? Infinity : specificQuestIds.length;
  }

  const tokenList     = isBooster ? getTokenList(userId).filter(Boolean) : [token];
  const tokenIndex    = Math.max(0, tokenList.indexOf(token));

  // Dynamic run duration based on runs (batch of 2)
  let totalMs = RUN_DURATION_MS;
  if (!isBulk) {
    let maxDur = 900;
    for (const id of specificQuestIds) {
      const dur = QUEST_DB?.[id]?.duration || 900;
      if (dur > maxDur) maxDur = dur;
    }
    totalMs = (maxDur + 60) * 1000;
  } else if (!hasUnlimitedQuests) {
    const batches = Math.ceil(bulkRuns / 2);
    totalMs = batches * 20 * 60 * 1000; // 20 min per batch of 2
  }
  const finishTimeStr = new Date(Date.now() + totalMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (!hasUnlimitedQuests) {
    const { recordQuestUsed } = require("./dailyTracker");
    if (!isBulk) {
      for (let i = 0; i < specificQuestIds.length; i++) recordQuestUsed(userId);
    } else {
      for (let i = 0; i < bulkRuns; i++) recordQuestUsed(userId);
    }
  }

  let startDesc;
  if (isBulk) {
    startDesc = `-# running ${hasUnlimitedQuests ? "all" : bulkRuns} quests in batches of 2 · ends at ~${finishTimeStr}`;
  } else if (isSingleQuest) {
    const qName = QUEST_DB?.[specificQuestIds[0]]?.name || "selected quest";
    startDesc = `-# running: **${qName}** · ends at ~${finishTimeStr}`;
  } else {
    const names = specificQuestIds.map(id => QUEST_DB?.[id]?.name || id).join(" & ");
    startDesc = `-# running 2 quests (**${names}**) in batch · ends at ~${finishTimeStr}`;
  }

  await sendSessionNotice(interaction, "✦ **Session started!**", startDesc);
  console.log(tag("session") + mint(` ✓ started for ${userId} · ${isBulk ? (hasUnlimitedQuests ? "Infinity" : bulkRuns + " runs (batch of 2)") : specificQuestIds.join(",") + " (batch)"} · ends ${finishTimeStr}`));

  let embedMessageId = null;
  try {
    const msg = await interaction.channel.send(buildUserEmbed(check, finishTimeStr));
    embedMessageId = msg.id;
  } catch (e) { console.error(tag("session") + rose(` placeholder failed: ${e.message}`)); }

  spawnInstance(
    token,
    userId,
    interaction.channelId,
    client,
    embedMessageId,
    tokenList,
    tokenIndex,
    bulkRuns,
    isBulk ? null : specificQuestIds
  );
}

// ╔══════════════════════════════════════════════════════════════╗
// ║                  INTERACTION HANDLER                        ║
// ╚══════════════════════════════════════════════════════════════╝

async function handleInteraction(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      const { customId, values } = interaction;
      if (customId.startsWith("quest_select:")) {
        const ownerId = customId.split(":")[1];
        if (interaction.user.id !== ownerId) {
          await interaction.reply({ content: MSG.not_your_session, flags: 64 });
          return;
        }

        // Immediately acknowledge the dropdown interaction so Discord client doesn't time out
        await interaction.deferUpdate();

        const token = getToken(ownerId);
        if (!token) {
          await sendSessionNotice(interaction, "✗ **No token linked**", "-# please link your token first with .addtoken");
          return;
        }

        if (runningInstances.has(token)) {
          await sendSessionNotice(interaction, "✦ **Session already running**", "-# finishes in ~16 min, or type .stop to end session");
          return;
        }

        const selectedQuestIds = values;
        await startSession(token, ownerId, interaction, selectedQuestIds);
        return;
      }
      return;
    }

    if (interaction.isButton()) {
      const { customId } = interaction;

      // ── setup buttons ──────────────────────────────────────────
      if (customId.startsWith("btn_setup_")) {
        const { isGuildAdmin, resetGuildConfig } = require("./guildConfig");
        const { buildSetupPanel } = require("./commands/setup");

        if (!isGuildAdmin(interaction.member)) {
          await interaction.reply({ content: MSG.no_permission, flags: 64 });
          return;
        }

        if (customId === "btn_setup_channel") {
          const modal = new ModalBuilder()
            .setCustomId("modal_setup_channel")
            .setTitle("Set Quest Channel")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("channel_input")
                  .setLabel("Channel ID or #mention")
                  .setPlaceholder("#channel or 1475091302298157228")
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            );
          await interaction.showModal(modal);
          return;
        }

        if (customId === "btn_setup_role") {
          const modal = new ModalBuilder()
            .setCustomId("modal_setup_role")
            .setTitle("Set Quest Access Role")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("role_input")
                  .setLabel("Role ID or @role mention")
                  .setPlaceholder("@role or 1479758634530373714")
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            );
          await interaction.showModal(modal);
          return;
        }

        if (customId === "btn_setup_reset") {
          resetGuildConfig(interaction.guild.id);
          const panel = buildSetupPanel(interaction.guild, "Server configuration has been reset.");
          await interaction.update({
            components: panel.components,
          }).catch(async () => {
            await interaction.reply({ content: "Server configuration has been reset.", flags: 64 });
          });
          return;
        }
        return;
      }

      // ── vouch / rate button ───────────────────────────────────
      if (customId.startsWith("btn_rate:")) {
        const parts   = customId.split(":");
        const staffId = parts[1];
        const stars   = parseInt(parts[2], 10);

        if (interaction.user.id === staffId) {
          await interaction.reply({ content: "You can't rate yourself.", flags: 64 });
          return;
        }

        const staffMember = await interaction.guild.members.fetch(staffId).catch(() => null);
        if (!staffMember) {
          await interaction.reply({ content: "Couldn't find that staff member.", flags: 64 });
          return;
        }

        setRating(staffId, interaction.user.id, interaction.user.tag, stars);

        const { average, total, percentage } = getRatings(staffId);
        const starBar = "✦".repeat(stars) + "✧".repeat(5 - stars);

        const thankContainer = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**✦ Thank you for rating!**\n\n` +
              `You gave **${staffMember.displayName}** — ${starBar}  **${stars} / 5 stars**`
            )
          );

        await interaction.update({
          components: [thankContainer],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      if (customId === "btn_personal_invite_link") {
        try {
          let entry = await getInvite(interaction.user.id);
          let existing = entry?.active;
          if (existing) {
            const { MAIN_SERVER_ID } = require("./inviteHelper");
            const liveInvite = await interaction.client.fetchInvite(entry.inviteCode).catch(() => null);
            if (!liveInvite || liveInvite.guild?.id !== MAIN_SERVER_ID) {
              entry = null;
              existing = false;
            }
          }
          if (!entry) {
            const { createPersonalInvite } = require("./inviteHelper");
            const invite = await createPersonalInvite(interaction.guild, interaction.channelId, interaction.user);
            entry = await createInvite(interaction.user.id, invite.code, `https://discord.gg/${invite.code}`);
          }
          await interaction.reply({
            content: `${existing ? "You already have an active personal invite:" : "Your personal invite is ready:"}\n${entry.inviteURL}\n\nJoins: ${entry.joins}/${entry.maxJoins}\nAccess is granted automatically after 2 people join.`,
            flags: 64,
          });
        } catch (error) {
          console.error(`personal invite button failed: ${error.message}`);
          if (error.code === 30016) {
            await interaction.reply({ content: "The server reached Discord's maximum invite limit (1,000). Please try again in a moment.", flags: 64 });
          } else {
            await interaction.reply({ content: `I couldn't create an invite: ${error.message}`, flags: 64 });
          }
        }
        return;
      }

      // guide video — no role gate
      if (customId === "btn_no_access_guide") {
        await interaction.reply({ content: "https://cdn.discordapp.com/attachments/1475091249793994875/1504532438125379724/Screen_Recording_20260514_224301.mp4?ex=6a094ec6&is=6a07fd46&hm=244e976d600cfb81148b6a31da79fa4f71245645e75b3e2db074dcdda9a1918d&", flags: 64 });
        return;
      }

      // staff application — no role gate
      if (customId === "staff_apply_open") {
        await interaction.showModal(buildStaffModal());
        return;
      }

      if (customId.startsWith("staff_add:")) {
        if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
          await interaction.reply({ content: "No permission.", flags: 64 });
          return;
        }
        const userId = customId.split(":")[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) { await interaction.reply({ content: "Couldn't find that member.", flags: 64 }); return; }
        await member.roles.add(STAFF_ROLE_ID);
        await interaction.update({ content: `${member} added to staff.`, components: [] });
        return;
      }

      if (customId.startsWith("staff_reject:")) {
        if (!interaction.member?.roles?.cache?.has(STAFF_ROLE_ID)) {
          await interaction.reply({ content: "No permission.", flags: 64 });
          return;
        }
        const userId = customId.split(":")[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const target = member ? `${member}` : `<@${userId}>`;
        await interaction.update({ content: `${target} rejected.`, components: [] });
        return;
      }

      if (customId === "btn_ads_setup") {
        if (interaction.user.id !== OWNER_ID && interaction.user.id !== "806113872620421140") {
          await interaction.reply({ content: "You don't have permission.", flags: 64 });
          return;
        }
        await interaction.showModal(buildAdModal());
        return;
      }

      if (customId === "btn_ads_clear") {
        if (interaction.user.id !== OWNER_ID && interaction.user.id !== "806113872620421140") {
          await interaction.reply({ content: "You don't have permission.", flags: 64 });
          return;
        }
        clearAds();
        await interaction.reply({ content: "Ad configuration cleared successfully! Only default ad will show.", flags: 64 });
        return;
      }

      // Skip ad — show quest session components
      if (customId.startsWith("btn_ad_skip:")) {
        const parts = customId.split(":");
        const ownerId = parts[1];
        if (interaction.user.id !== ownerId) {
          await interaction.reply({ content: "This isn't your session.", flags: 64 });
          return;
        }
        await interaction.deferUpdate();
        const components = await buildQuestComponents(ownerId, interaction.member);
        await interaction.editReply({
          components,
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Claim +2 bonus quests after joining advertised server
      if (customId.startsWith("btn_ad_claim:")) {
        const parts = customId.split(":");
        const ownerId = parts[1];
        const serverId = parts[2];
        const adMsgId = parts[3];

        if (interaction.user.id !== ownerId) {
          await interaction.reply({ content: "This isn't your session.", flags: 64 });
          return;
        }

        // One claim per server per user
        if (hasClaimedBonus(ownerId, serverId)) {
          await interaction.reply({ content: "You've already claimed the bonus for this ad. Click **Skip →** to start your quest.", flags: 64 });
          return;
        }

        // ── Verify server membership via user's token ────────────
        const userToken = getToken(ownerId);
        if (!userToken) {
          await interaction.reply({
            content: "You need to link your token first before claiming the bonus. Run `.q` to get started.",
            flags: 64,
          });
          return;
        }

        // Call Discord API with the user's own token to check guild membership
        let isInServer = false;
        try {
          const res = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
            headers: { Authorization: userToken },
          });
          if (res.ok) {
            const guilds = await res.json();
            isInServer = Array.isArray(guilds) && guilds.some(g => g.id === serverId);
          }
        } catch {}

        if (!isInServer) {
          await interaction.reply({
            content: "You need to **join the advertised server** first!\nClick **Join Server** above, join the server, then click **Claim +2 Quests** again.",
            flags: 64,
          });
          return;
        }
        // ── End verification ────────────────────────────────────

        // Grant bonus — give them the role
        const { QUEST_ROLE_4 } = require("./config");
        if (interaction.member && !interaction.member.roles.cache.has(QUEST_ROLE_4)) {
          await interaction.member.roles.add(QUEST_ROLE_4).catch(() => {});
        }

        const { applyRoleBonus, getRemainingQuests, recordQuestUsed, getDailyLimit } = require("./dailyTracker");
        applyRoleBonus(ownerId, 2);
        recordBonusClaim(ownerId, serverId);

        const newLimit = getDailyLimit(ownerId);
        const remaining = getRemainingQuests(ownerId, 2); // how many quests they still haven't used


        // Show ✓ Claimed on the ad message
        const { getAdByServerId } = require("./adsTracker");
        const fullAdConfig = getAdByServerId(serverId);
        if (fullAdConfig) {
          await interaction.update({
            components: buildAdSkipComponents(fullAdConfig, ownerId, adMsgId),
            flags: MessageFlags.IsComponentsV2,
          });
        } else {
          const claimedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("noop_claimed").setLabel("✓ Claimed").setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId(`btn_ad_skip:${ownerId}:${adMsgId}`).setLabel("Skip →").setStyle(ButtonStyle.Secondary)
          );
          const updatedComponents = [...interaction.message.components];
          if (updatedComponents.length > 0) updatedComponents[updatedComponents.length - 1] = claimedRow;
          await interaction.update({ components: updatedComponents });
        }

        if (remaining <= 0) {
          await interaction.followUp({ content: "**+2 bonus quests claimed!** You've already used all your quests today — they'll reset in 24h.", flags: 64 });
          return;
        }

        // Auto-run all remaining quests in bulk using the user's token
        const check = await validateToken(userToken);
        if (!check.valid) {
          await interaction.followUp({ content: `**+2 bonus quests granted!** You now have **${newLimit}** quests today. Your token appears invalid — re-link it and use **.q** to run them.`, flags: 64 });
          return;
        }
        if (runningInstances.has(userToken)) {
          await interaction.followUp({ content: `**+2 bonus quests granted!** You already have a session running — it will use your new quota automatically.`, flags: 64 });
          return;
        }

        // Record all remaining quest uses at once so the count hits the new limit
        for (let i = 0; i < remaining; i++) recordQuestUsed(ownerId);

        const finishTimeStr = new Date(Date.now() + (remaining * 20 * 60 * 1000)).toLocaleTimeString();
        console.log(tag("session") + mint(` bonus auto-start for ${ownerId} · ${remaining} runs`));

        // Notify user — no quest panel sent (it would show "limit reached" if clicked)
        await interaction.followUp({ content: `**+2 bonus quests unlocked!** Auto-starting **${remaining}** quest session${remaining > 1 ? "s" : ""} for you now \nEstimated finish: **${finishTimeStr}**`, flags: 64 });

        spawnInstance(userToken, ownerId, interaction.channelId, interaction.client, null, [userToken], 0, remaining);

        return;
      }



      // slot buttons — booster only
      if (customId.startsWith("btn_slot:")) {
        const [, slotStr, ownerId] = customId.split(":");
        if (interaction.user.id !== ownerId) { await interaction.reply({ content: MSG.not_your_session, flags: 64 }); return; }
        if (!isPremium(interaction.member)) { await interaction.reply({ content: MSG.booster_only, flags: 64 }); return; }
        await interaction.showModal(buildSlotModal(parseInt(slotStr, 10)));
        return;
      }

      // noop disabled buttons
      if (customId.startsWith("noop_")) { await interaction.deferUpdate(); return; }

      // guide buttons — no role gate (anyone can access)
      if (["btn_guide_pc", "btn_guide_android", "btn_guide_ios"].includes(customId)) {
        const key = customId.replace("btn_guide_", "");
        await interaction.reply({ content: `${GUIDES[key]}\n${GUIDE_VIDEOS[key]}`, flags: 64 });
        return;
      }

      // remaining buttons need access
      if (!hasAccess(interaction.member)) {
        await interaction.reply({ content: MSG.no_access_button, flags: 64 });
        return;
      }

      const ownerId = customId.split(":")[1];
      if (
        (customId.startsWith("btn_start:") || customId.startsWith("btn_link_token:") || customId.startsWith("btn_update_token:") || customId.startsWith("btn_remove_token:"))
        && interaction.user.id !== ownerId
      ) {
        await interaction.reply({ content: MSG.not_your_session, flags: 64 });
        return;
      }

      if (customId.startsWith("btn_start:")) {
        const token = getToken(ownerId);
        if (!token) {
          await interaction.reply({ content: "No token linked. Click Link Token first.", flags: 64 });
          return;
        }
        await interaction.deferUpdate();
        await startSession(token, ownerId, interaction);
        return;
      }

      if (customId.startsWith("btn_link_token:") || customId.startsWith("btn_update_token:")) {
        await interaction.showModal(buildTokenModal());
        return;
      }

      if (customId.startsWith("btn_remove_token:")) {
        clearTokens(ownerId);
        try { cleanupInstance(ownerId); } catch (_) {}
        try {
          const components = await buildQuestComponents(ownerId, interaction.member);
          await interaction.update({
            components,
          });
          await interaction.followUp({ content: "♡ **Token removed.** Your saved token has been deleted from the bot.", flags: 64 }).catch(() => {});
        } catch (_) {
          await interaction.reply({ content: "♡ **Token removed.** Your saved token has been deleted from the bot.", flags: 64 });
        }
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      // setup modals
      if (interaction.customId === "modal_setup_channel") {
        const { isGuildAdmin, setGuildConfig } = require("./guildConfig");
        const { buildSetupPanel, resolveChannel } = require("./commands/setup");

        if (!isGuildAdmin(interaction.member)) {
          await interaction.reply({ content: MSG.no_permission, flags: 64 });
          return;
        }

        const raw = interaction.fields.getTextInputValue("channel_input");
        const ch = await resolveChannel(interaction.guild, raw);
        if (!ch) {
          await interaction.reply({ content: "Could not find that text channel in this server.", flags: 64 });
          return;
        }

        setGuildConfig(interaction.guild.id, { questChannelId: ch.id });
        const notice = `Quest channel updated to #${ch.name} (\`${ch.id}\`).`;
        const panel = buildSetupPanel(interaction.guild, notice);
        await interaction.reply({
          components: panel.components,
          flags: panel.flags,
          allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        }).catch(async () => {
          await interaction.reply({
            content: `✦ **${notice}**`,
            flags: 64,
          });
        });
        return;
      }

      if (interaction.customId === "modal_setup_role") {
        const { isGuildAdmin, setGuildConfig } = require("./guildConfig");
        const { buildSetupPanel, resolveRole } = require("./commands/setup");

        if (!isGuildAdmin(interaction.member)) {
          await interaction.reply({ content: MSG.no_permission, flags: 64 });
          return;
        }

        const raw = interaction.fields.getTextInputValue("role_input");
        const role = await resolveRole(interaction.guild, raw);
        if (!role) {
          await interaction.reply({ content: "Could not find that role in this server.", flags: 64 });
          return;
        }

        setGuildConfig(interaction.guild.id, { questAccessRoleId: role.id });
        const notice = `Quest access role updated to @${role.name} (\`${role.id}\`).`;
        const panel = buildSetupPanel(interaction.guild, notice);
        await interaction.reply({
          components: panel.components,
          flags: panel.flags,
          allowedMentions: { parse: [], users: [], roles: [], repliedUser: false },
        }).catch(async () => {
          await interaction.reply({
            content: `✦ **${notice}**`,
            flags: 64,
          });
        });
        return;
      }

      // staff application modal
      if (interaction.customId === "staff_apply_modal") {
        await interaction.deferReply({ flags: 64 });
        try {
          const logChannel = await interaction.client.channels.fetch(STAFF_LOG_CHANNEL_ID).catch(() => null);
          if (!logChannel) {
            await interaction.editReply({ content: "Staff log channel not found." });
            return;
          }
          await logChannel.send(buildStaffLogMessage(interaction));
          await interaction.editReply({ content: "Staff application sent." });
        } catch (e) {
          console.error(`[staff] modal error: ${e.message}`, e.stack);
          await interaction.editReply({ content: "Something went wrong. Try again." }).catch(() => {});
        }
        return;
      }

      if (interaction.customId === "ads_setup_modal") {
        const serverName = interaction.fields.getTextInputValue("ad_server_name");
        const serverDetails = interaction.fields.getTextInputValue("ad_server_details");
        const serverLink = interaction.fields.getTextInputValue("ad_server_link");
        const bannerLink = interaction.fields.getTextInputValue("ad_banner_link") || null;
        const serverId = interaction.fields.getTextInputValue("ad_server_id")?.trim() || null;
        
        addAdConfig({ serverName, serverDetails, serverLink, bannerLink, serverId });
        
        const bonusNote = serverId
          ? ` — **+2 quest bonus** enabled (Server ID: \`${serverId}\`)`
          : " — display-only ad";
        await interaction.reply({ content: `Ad added to rotation successfully!${bonusNote}`, flags: 64 });
        return;
      }

      // slot modal
      if (interaction.customId.startsWith("slot_modal:")) {
        const slot   = parseInt(interaction.customId.split(":")[1], 10);
        const token  = interaction.fields.getTextInputValue("token_input").trim();
        const userId = interaction.user.id;

        await interaction.deferReply({ flags: 64 });
        await interaction.editReply({ content: MSG.validating });

        const check = await validateToken(token);
        if (!check.valid) { await interaction.editReply({ content: MSG.invalid_token }); return; }

        const allTokens = Object.entries(loadTokens())
          .flatMap(([uid, v]) => uid === userId ? [] : (Array.isArray(v) ? v : [v]));
        if (allTokens.includes(token)) {
          await interaction.editReply({ content: " That token is already saved by another user." });
          return;
        }

        setTokenSlot(userId, slot, token, true);
        console.log(tag("addtoken") + mint(` ${userId} set slot ${slot + 1} · ${check.tag}`));
        await interaction.editReply({ content: ` **Slot ${slot + 1}** saved! (${check.tag})\n-# Use \`.addtoken\` to update other slots.` });
        return;
      }

      // regular token modal — only save token, no session start
      if (interaction.customId === "token_modal") {
        if (!hasAccess(interaction.member)) {
          await interaction.reply({ content: MSG.no_access_button, flags: 64 });
          return;
        }

        const token     = interaction.fields.getTextInputValue("token_input").trim();
        const userId    = interaction.user.id;
        const isUpdate  = !!getToken(userId);

        await interaction.deferReply({ flags: 64 });
        await interaction.editReply({ content: MSG.validating });

        const check = await validateToken(token);
        if (!check.valid) { await interaction.editReply({ content: MSG.invalid_token }); return; }

        saveToken(userId, token, false);
        await interaction.editReply({ content: ` token ${isUpdate ? "updated" : "saved"} as **${check.tag}**\n-# now do .quest again to start your session` });
        console.log(tag("token") + mint(` ✓ ${isUpdate ? "updated" : "saved"} for ${userId} · ${check.tag}${isBooster ? " [booster]" : ""}`));
        return;
      }
    }

  } catch (e) {
    if (e.code === 10062) return;
    console.error(tag("interaction") + rose(` error: ${e.message}`));
  }
}

module.exports = {
  handleInteraction,
  buildQuestComponents,
  buildGuideComponents,
  buildStatusComponents,
  buildAddTokenComponents,
  buildAdComponents,
  buildAdSkipComponents,
};
