import {
  bigint,
  boolean,
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Additive schema for Nexora's advanced communication package.
 *
 * These tables deliberately extend stable core entities by id instead of
 * rewriting them. That keeps old clients and partially migrated TiDB
 * deployments compatible while newer clients opt into richer behaviour.
 */

export const channelAdvancedSettings = mysqlTable(
  "channel_advanced_settings",
  {
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).primaryKey(),
    slowModeSeconds: int("slowModeSeconds").default(0).notNull(),
    forumView: mysqlEnum("forumView", ["list", "cards", "compact"])
      .default("list")
      .notNull(),
    forumRequireTag: boolean("forumRequireTag").default(false).notNull(),
    forumAutoArchiveHours: int("forumAutoArchiveHours"),
    stageTopic: varchar("stageTopic", { length: 180 }),
    priorityAttenuation: int("priorityAttenuation").default(50).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    slowModeIdx: index("cas_slow_mode_idx").on(table.slowModeSeconds),
  })
);

export const forumTags = mysqlTable(
  "forum_tags",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    name: varchar("name", { length: 32 }).notNull(),
    color: varchar("color", { length: 16 }).default("#7383FF").notNull(),
    emoji: varchar("emoji", { length: 64 }),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    channelNameUniq: uniqueIndex("ft_channel_name_uniq").on(
      table.channelId,
      table.name
    ),
    channelPositionIdx: index("ft_channel_position_idx").on(
      table.channelId,
      table.position
    ),
  })
);

export const forumPosts = mysqlTable(
  "forum_posts",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["OPEN", "CLOSED", "LOCKED", "ARCHIVED"])
      .default("OPEN")
      .notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    replyCount: int("replyCount").default(0).notNull(),
    lastParticipantId: bigint("lastParticipantId", {
      mode: "number",
      unsigned: true,
    }),
    closedAt: timestamp("closedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    messageUniq: uniqueIndex("fp_message_uniq").on(table.messageId),
    activityIdx: index("fp_channel_activity_idx").on(
      table.channelId,
      table.updatedAt
    ),
    popularityIdx: index("fp_channel_popularity_idx").on(
      table.channelId,
      table.replyCount
    ),
  })
);

export const forumPostTags = mysqlTable(
  "forum_post_tags",
  {
    id: serial("id").primaryKey(),
    postId: bigint("postId", { mode: "number", unsigned: true }).notNull(),
    tagId: bigint("tagId", { mode: "number", unsigned: true }).notNull(),
  },
  table => ({
    postTagUniq: uniqueIndex("fpt_post_tag_uniq").on(table.postId, table.tagId),
    tagIdx: index("fpt_tag_idx").on(table.tagId, table.postId),
  })
);

export const announcementPublications = mysqlTable(
  "announcement_publications",
  {
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).primaryKey(),
    sourceChannelId: bigint("sourceChannelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    publishedByUserId: bigint("publishedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    propagatedCount: int("propagatedCount").default(0).notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  },
  table => ({
    channelIdx: index("ap_channel_idx").on(
      table.sourceChannelId,
      table.publishedAt
    ),
  })
);

export const serverEventDetails = mysqlTable("server_event_details", {
  eventId: bigint("eventId", { mode: "number", unsigned: true }).primaryKey(),
  imageUrl: varchar("imageUrl", { length: 800 }),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  locationType: mysqlEnum("locationType", [
    "voice",
    "stage",
    "external",
    "physical",
  ])
    .default("physical")
    .notNull(),
  location: varchar("location", { length: 300 }),
  externalUrl: varchar("externalUrl", { length: 800 }),
  recurrenceRule: varchar("recurrenceRule", { length: 300 }),
  endedAt: timestamp("endedAt"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const serverEventInterests = mysqlTable(
  "server_event_interests",
  {
    id: serial("id").primaryKey(),
    eventId: bigint("eventId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    reminderMinutes: int("reminderMinutes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    eventUserUniq: uniqueIndex("sei_event_user_uniq").on(
      table.eventId,
      table.userId
    ),
    userIdx: index("sei_user_idx").on(table.userId, table.eventId),
  })
);

export const stageSessions = mysqlTable(
  "stage_sessions",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    topic: varchar("topic", { length: 180 }).notNull(),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    status: mysqlEnum("status", ["ACTIVE", "ENDED"])
      .default("ACTIVE")
      .notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    endedAt: timestamp("endedAt"),
  },
  table => ({
    activeIdx: index("sts_channel_status_idx").on(
      table.channelId,
      table.status
    ),
  })
);

export const stageParticipants = mysqlTable(
  "stage_participants",
  {
    id: serial("id").primaryKey(),
    sessionId: bigint("sessionId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["AUDIENCE", "SPEAKER", "MODERATOR"])
      .default("AUDIENCE")
      .notNull(),
    requestState: mysqlEnum("requestState", [
      "NONE",
      "PENDING",
      "ACCEPTED",
      "REJECTED",
    ])
      .default("NONE")
      .notNull(),
    muted: boolean("muted").default(false).notNull(),
    requestedAt: timestamp("requestedAt"),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    sessionUserUniq: uniqueIndex("stp_session_user_uniq").on(
      table.sessionId,
      table.userId
    ),
    requestIdx: index("stp_session_request_idx").on(
      table.sessionId,
      table.requestState
    ),
  })
);

export const userTimeouts = mysqlTable(
  "user_timeouts",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    moderatorUserId: bigint("moderatorUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    reason: varchar("reason", { length: 500 }),
    startsAt: timestamp("startsAt").defaultNow().notNull(),
    endsAt: timestamp("endsAt"),
    clearedAt: timestamp("clearedAt"),
  },
  table => ({
    activeIdx: index("ut_server_user_idx").on(
      table.serverId,
      table.userId,
      table.endsAt
    ),
  })
);

export const inviteAdvancedSettings = mysqlTable("invite_advanced_settings", {
  inviteId: bigint("inviteId", { mode: "number", unsigned: true }).primaryKey(),
  defaultChannelId: bigint("defaultChannelId", {
    mode: "number",
    unsigned: true,
  }),
  temporaryMembership: boolean("temporaryMembership").default(false).notNull(),
  pausedAt: timestamp("pausedAt"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const onboardingConfigs = mysqlTable("onboarding_configs", {
  serverId: bigint("serverId", { mode: "number", unsigned: true }).primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  welcomeTitle: varchar("welcomeTitle", { length: 120 }),
  welcomeMessage: text("welcomeMessage"),
  coverImageUrl: varchar("coverImageUrl", { length: 800 }),
  requireRules: boolean("requireRules").default(true).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const onboardingQuestions = mysqlTable(
  "onboarding_questions",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    prompt: varchar("prompt", { length: 240 }).notNull(),
    options: json("options")
      .$type<
        Array<{
          id: string;
          label: string;
          description?: string;
          roleIds?: number[];
          channelIds?: number[];
          interests?: string[];
        }>
      >()
      .notNull(),
    required: boolean("required").default(false).notNull(),
    multiple: boolean("multiple").default(false).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    serverPositionIdx: index("oq_server_position_idx").on(
      table.serverId,
      table.position
    ),
  })
);

export const onboardingAnswers = mysqlTable(
  "onboarding_answers",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    answers: json("answers").$type<Record<string, string[]>>().notNull(),
    interests: json("interests").$type<string[]>().notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    serverUserUniq: uniqueIndex("oa_server_user_uniq").on(
      table.serverId,
      table.userId
    ),
  })
);

export const serverGuides = mysqlTable("server_guides", {
  serverId: bigint("serverId", { mode: "number", unsigned: true }).primaryKey(),
  welcomeMessage: text("welcomeMessage"),
  rules: json("rules").$type<string[]>().notNull(),
  resources: json("resources")
    .$type<Array<{ label: string; url: string }>>()
    .notNull(),
  recommendedChannelIds: json("recommendedChannelIds")
    .$type<number[]>()
    .notNull(),
  tasks: json("tasks")
    .$type<Array<{ id: string; label: string; channelId?: number }>>()
    .notNull(),
  faq: json("faq")
    .$type<Array<{ question: string; answer: string }>>()
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userCustomStatuses = mysqlTable("user_custom_status", {
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
  text: varchar("text", { length: 128 }),
  emoji: varchar("emoji", { length: 64 }),
  presence: mysqlEnum("presence", ["online", "idle", "dnd", "invisible"])
    .default("online")
    .notNull(),
  expiresAt: timestamp("expiresAt"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const soundboardSounds = mysqlTable(
  "soundboard_sounds",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    emoji: varchar("emoji", { length: 64 }),
    volume: int("volume").default(100).notNull(),
    durationMs: int("durationMs").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ serverIdx: index("sbs_server_idx").on(table.serverId, table.id) })
);

export const soundboardFavorites = mysqlTable(
  "soundboard_favorites",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    soundId: bigint("soundId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userSoundUniq: uniqueIndex("sbf_user_sound_uniq").on(
      table.userId,
      table.soundId
    ),
  })
);

export const audioClips = mysqlTable(
  "audio_clips",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    fileId: bigint("fileId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    startMs: int("startMs").default(0).notNull(),
    endMs: int("endMs").notNull(),
    volume: int("volume").default(100).notNull(),
    waveform: json("waveform").$type<number[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userIdx: index("ac_user_idx").on(table.userId, table.id) })
);

export const voicePrioritySettings = mysqlTable(
  "voice_priority_settings",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    attenuation: int("attenuation").default(50).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    serverUserUniq: uniqueIndex("vps_server_user_uniq").on(
      table.serverId,
      table.userId
    ),
  })
);

export const channelPinnedMessages = mysqlTable(
  "channel_pinned_messages",
  {
    id: serial("id").primaryKey(),
    channelId: bigint("channelId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    pinnedByUserId: bigint("pinnedByUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    channelMessageUniq: uniqueIndex("cpm_channel_message_uniq").on(
      table.channelId,
      table.messageId
    ),
    channelIdx: index("cpm_channel_idx").on(table.channelId, table.id),
  })
);

export const savedMessageFolders = mysqlTable(
  "saved_message_folders",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 16 }).default("#7383FF").notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userPositionIdx: index("smf_user_position_idx").on(
      table.userId,
      table.position
    ),
  })
);

export const savedMessages = mysqlTable(
  "saved_messages",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    messageId: bigint("messageId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    folderId: bigint("folderId", { mode: "number", unsigned: true }),
    tags: json("tags").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userMessageUniq: uniqueIndex("sm_user_message_uniq").on(
      table.userId,
      table.messageId
    ),
    userFolderIdx: index("sm_user_folder_idx").on(
      table.userId,
      table.folderId,
      table.id
    ),
  })
);

export const threadSubscriptions = mysqlTable(
  "thread_subscriptions",
  {
    id: serial("id").primaryKey(),
    threadId: bigint("threadId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    level: mysqlEnum("level", ["all", "mentions", "none"])
      .default("all")
      .notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    threadUserUniq: uniqueIndex("ts_thread_user_uniq").on(
      table.threadId,
      table.userId
    ),
    userIdx: index("ts_user_idx").on(table.userId, table.threadId),
  })
);

export const messageForwards = mysqlTable("message_forwards", {
  messageId: bigint("messageId", {
    mode: "number",
    unsigned: true,
  }).primaryKey(),
  sourceMessageId: bigint("sourceMessageId", {
    mode: "number",
    unsigned: true,
  }),
  forwardedByUserId: bigint("forwardedByUserId", {
    mode: "number",
    unsigned: true,
  }).notNull(),
  sourceSnapshot: json("sourceSnapshot")
    .$type<{
      authorName: string;
      authorAvatar?: string | null;
      content: string;
      originLabel: string;
      createdAt: string;
    }>()
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const scheduledMessages = mysqlTable(
  "scheduled_messages",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    channelId: bigint("channelId", { mode: "number", unsigned: true }),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }),
    content: text("content").notNull(),
    attachmentIds: json("attachmentIds").$type<number[]>().notNull(),
    scheduledFor: timestamp("scheduledFor").notNull(),
    timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
    state: mysqlEnum("state", [
      "PENDING",
      "PROCESSING",
      "SENT",
      "FAILED",
      "CANCELLED",
    ])
      .default("PENDING")
      .notNull(),
    sentMessageId: bigint("sentMessageId", { mode: "number", unsigned: true }),
    failureReason: varchar("failureReason", { length: 500 }),
    attempts: int("attempts").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    dueIdx: index("sched_state_due_idx").on(table.state, table.scheduledFor),
    userIdx: index("sched_user_idx").on(table.userId, table.id),
  })
);

export const userProfileDetails = mysqlTable("user_profile_details", {
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
  displayName: varchar("displayName", { length: 64 }),
  pronouns: varchar("pronouns", { length: 64 }),
  location: varchar("location", { length: 120 }),
  website: varchar("website", { length: 500 }),
  about: text("about"),
  privacy: json("privacy")
    .$type<
      Record<string, "everyone" | "friends" | "mutual_servers" | "nobody">
    >()
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const profileFields = mysqlTable(
  "profile_fields",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    label: varchar("label", { length: 40 }).notNull(),
    value: varchar("value", { length: 300 }).notNull(),
    visibility: mysqlEnum("visibility", [
      "everyone",
      "friends",
      "mutual_servers",
      "nobody",
    ])
      .default("everyone")
      .notNull(),
    position: int("position").default(0).notNull(),
  },
  table => ({
    userPositionIdx: index("pf_user_position_idx").on(
      table.userId,
      table.position
    ),
  })
);

export const userNotes = mysqlTable(
  "user_notes",
  {
    id: serial("id").primaryKey(),
    authorUserId: bigint("authorUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    targetUserId: bigint("targetUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    encryptedContent: text("encryptedContent").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    authorTargetUniq: uniqueIndex("un_author_target_uniq").on(
      table.authorUserId,
      table.targetUserId
    ),
  })
);

export const userFavorites = mysqlTable(
  "user_favorites",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    targetType: mysqlEnum("targetType", [
      "server",
      "channel",
      "dm",
      "thread",
    ]).notNull(),
    targetId: bigint("targetId", { mode: "number", unsigned: true }).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    targetUniq: uniqueIndex("uf_user_target_uniq").on(
      table.userId,
      table.targetType,
      table.targetId
    ),
    positionIdx: index("uf_user_position_idx").on(table.userId, table.position),
  })
);

export const serverFolders = mysqlTable(
  "server_folders",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 16 }).default("#7383FF").notNull(),
    position: int("position").default(0).notNull(),
    collapsed: boolean("collapsed").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userPositionIdx: index("sf_user_position_idx").on(
      table.userId,
      table.position
    ),
  })
);

export const serverFolderItems = mysqlTable(
  "server_folder_items",
  {
    id: serial("id").primaryKey(),
    folderId: bigint("folderId", { mode: "number", unsigned: true }).notNull(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    position: int("position").default(0).notNull(),
  },
  table => ({
    folderServerUniq: uniqueIndex("sfi_folder_server_uniq").on(
      table.folderId,
      table.serverId
    ),
    folderPositionIdx: index("sfi_folder_position_idx").on(
      table.folderId,
      table.position
    ),
  })
);

export const userServerOrder = mysqlTable(
  "server_order",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    position: int("position").default(0).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    userServerUniq: uniqueIndex("uso_user_server_uniq").on(
      table.userId,
      table.serverId
    ),
    userPositionIdx: index("uso_user_position_idx").on(
      table.userId,
      table.position
    ),
  })
);

export const serverInsights = mysqlTable(
  "server_insights",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    day: timestamp("day").notNull(),
    membersTotal: int("membersTotal").default(0).notNull(),
    activeMembers: int("activeMembers").default(0).notNull(),
    newMembers: int("newMembers").default(0).notNull(),
    returningMembers: int("returningMembers").default(0).notNull(),
    messages: int("messages").default(0).notNull(),
    activeChannels: int("activeChannels").default(0).notNull(),
    voiceParticipants: int("voiceParticipants").default(0).notNull(),
    events: int("events").default(0).notNull(),
    inviteSources: json("inviteSources")
      .$type<Record<string, number>>()
      .notNull(),
    hourlyActivity: json("hourlyActivity").$type<number[]>().notNull(),
  },
  table => ({
    serverDayUniq: uniqueIndex("si_server_day_uniq").on(
      table.serverId,
      table.day
    ),
  })
);

export const communitySettings = mysqlTable("community_settings", {
  serverId: bigint("serverId", { mode: "number", unsigned: true }).primaryKey(),
  rulesChannelId: bigint("rulesChannelId", { mode: "number", unsigned: true }),
  announcementChannelId: bigint("announcementChannelId", {
    mode: "number",
    unsigned: true,
  }),
  spamProtectionEnabled: boolean("spamProtectionEnabled")
    .default(true)
    .notNull(),
  minimumModerationEnabled: boolean("minimumModerationEnabled")
    .default(true)
    .notNull(),
  enabledAt: timestamp("enabledAt"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const qrLoginSessions = mysqlTable(
  "qr_login_sessions",
  {
    id: char("id", { length: 36 }).primaryKey(),
    tokenHash: char("tokenHash", { length: 64 }).notNull(),
    desktopSessionId: varchar("desktopSessionId", { length: 32 }),
    approvedByUserId: bigint("approvedByUserId", {
      mode: "number",
      unsigned: true,
    }),
    status: mysqlEnum("status", [
      "PENDING",
      "APPROVED",
      "CONSUMED",
      "EXPIRED",
      "REJECTED",
    ])
      .default("PENDING")
      .notNull(),
    deviceSummary: varchar("deviceSummary", { length: 160 }).notNull(),
    browser: varchar("browser", { length: 40 }).notNull(),
    approximateLocation: varchar("approximateLocation", { length: 120 }),
    partialIp: varchar("partialIp", { length: 64 }),
    expiresAt: timestamp("expiresAt").notNull(),
    approvedAt: timestamp("approvedAt"),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tokenUniq: uniqueIndex("qls_token_uniq").on(table.tokenHash),
    expiryIdx: index("qls_expiry_idx").on(table.expiresAt, table.status),
  })
);

export const passkeys = mysqlTable(
  "passkeys",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    credentialId: varchar("credentialId", { length: 512 }).notNull(),
    publicKey: text("publicKey").notNull(),
    counter: bigint("counter", { mode: "number", unsigned: true })
      .default(0)
      .notNull(),
    transports: json("transports").$type<string[]>().notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    deviceType: varchar("deviceType", { length: 32 }),
    backedUp: boolean("backedUp").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
  },
  table => ({
    credentialUniq: uniqueIndex("pk_credential_uniq").on(table.credentialId),
    userIdx: index("pk_user_idx").on(table.userId, table.id),
  })
);

export const webauthnChallenges = mysqlTable(
  "webauthn_challenges",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    challengeHash: char("challengeHash", { length: 64 }).notNull(),
    purpose: mysqlEnum("purpose", ["register", "authenticate"]).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    expiryIdx: index("wc_expiry_idx").on(table.expiresAt, table.purpose),
  })
);

export const totpSettings = mysqlTable("totp_settings", {
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
  encryptedSecret: text("encryptedSecret").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  lastUsedStep: bigint("lastUsedStep", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const backupCodes = mysqlTable(
  "backup_codes",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    codeHash: varchar("codeHash", { length: 180 }).notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userIdx: index("bc_user_idx").on(table.userId, table.usedAt) })
);

export const trustedDevices = mysqlTable(
  "trusted_devices",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    sessionId: varchar("sessionId", { length: 32 }).notNull(),
    trustedAt: timestamp("trustedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
  },
  table => ({
    sessionUniq: uniqueIndex("td_session_uniq").on(table.sessionId),
    userIdx: index("td_user_idx").on(table.userId, table.trustedAt),
  })
);

export const userBlocks = mysqlTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    blockedUserId: bigint("blockedUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    pairUniq: uniqueIndex("ub_pair_uniq").on(table.userId, table.blockedUserId),
    blockedIdx: index("ub_blocked_idx").on(table.blockedUserId, table.userId),
  })
);

export const userRestrictions = mysqlTable(
  "user_restrictions",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    restrictedUserId: bigint("restrictedUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    filterMessages: boolean("filterMessages").default(true).notNull(),
    muteCalls: boolean("muteCalls").default(true).notNull(),
    muteNotifications: boolean("muteNotifications").default(true).notNull(),
    hidePresence: boolean("hidePresence").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    pairUniq: uniqueIndex("ur_pair_uniq").on(
      table.userId,
      table.restrictedUserId
    ),
  })
);

export const messageRequests = mysqlTable(
  "message_requests",
  {
    id: serial("id").primaryKey(),
    ownerUserId: bigint("ownerUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    category: mysqlEnum("category", [
      "friends",
      "mutual_servers",
      "unknown",
      "suspicious",
    ]).notNull(),
    riskScore: int("riskScore").default(0).notNull(),
    reasons: json("reasons").$type<string[]>().notNull(),
    state: mysqlEnum("state", ["PENDING", "ACCEPTED", "IGNORED", "SPAM"])
      .default("PENDING")
      .notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    ownerConversationUniq: uniqueIndex("mr_owner_conversation_uniq").on(
      table.ownerUserId,
      table.conversationId
    ),
  })
);

export const securityEvents = mysqlTable(
  "security_events",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"])
      .default("info")
      .notNull(),
    device: varchar("device", { length: 120 }),
    browser: varchar("browser", { length: 40 }),
    os: varchar("os", { length: 40 }),
    approximateLocation: varchar("approximateLocation", { length: 120 }),
    partialIp: varchar("partialIp", { length: 64 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    acknowledgedAt: timestamp("acknowledgedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userIdx: index("sec_user_idx").on(table.userId, table.id) })
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    requesterUserId: bigint("requesterUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    assigneeUserId: bigint("assigneeUserId", {
      mode: "number",
      unsigned: true,
    }),
    category: mysqlEnum("category", [
      "account",
      "moderation",
      "report",
      "bug",
      "billing",
      "security",
      "ban",
    ]).notNull(),
    priority: mysqlEnum("priority", ["LOW", "NORMAL", "HIGH", "URGENT"])
      .default("NORMAL")
      .notNull(),
    status: mysqlEnum("status", [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_USER",
      "RESOLVED",
      "CLOSED",
    ])
      .default("OPEN")
      .notNull(),
    subject: varchar("subject", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    requesterIdx: index("ticket_requester_idx").on(
      table.requesterUserId,
      table.id
    ),
    queueIdx: index("ticket_queue_idx").on(
      table.status,
      table.priority,
      table.id
    ),
  })
);

export const ticketMessages = mysqlTable(
  "ticket_messages",
  {
    id: serial("id").primaryKey(),
    ticketId: bigint("ticketId", { mode: "number", unsigned: true }).notNull(),
    authorUserId: bigint("authorUserId", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    content: text("content").notNull(),
    attachmentIds: json("attachmentIds").$type<number[]>().notNull(),
    internal: boolean("internal").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ ticketIdx: index("tm_ticket_idx").on(table.ticketId, table.id) })
);

export const banAppeals = mysqlTable(
  "ban_appeals",
  {
    id: serial("id").primaryKey(),
    serverId: bigint("serverId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    banId: bigint("banId", { mode: "number", unsigned: true }).notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    explanation: text("explanation").notNull(),
    evidence: json("evidence").$type<string[]>().notNull(),
    status: mysqlEnum("status", ["PENDING", "UPHELD", "REDUCED", "REMOVED"])
      .default("PENDING")
      .notNull(),
    reviewedByUserId: bigint("reviewedByUserId", {
      mode: "number",
      unsigned: true,
    }),
    resolution: varchar("resolution", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  table => ({
    userIdx: index("ba_user_idx").on(table.userId, table.id),
    queueIdx: index("ba_server_status_idx").on(
      table.serverId,
      table.status,
      table.id
    ),
  })
);

export const userPreferences = mysqlTable("user_preferences", {
  userId: bigint("userId", { mode: "number", unsigned: true }).primaryKey(),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  version: int("version").default(1).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const devicePreferences = mysqlTable(
  "device_preferences",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    deviceId: varchar("deviceId", { length: 96 }).notNull(),
    data: json("data").$type<Record<string, unknown>>().notNull(),
    version: int("version").default(1).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    userDeviceUniq: uniqueIndex("dp_user_device_uniq").on(
      table.userId,
      table.deviceId
    ),
  })
);

export const cachedSyncState = mysqlTable(
  "cached_sync_state",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    scope: varchar("scope", { length: 64 }).notNull(),
    version: int("version").default(1).notNull(),
    checksum: char("checksum", { length: 64 }).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    userScopeUniq: uniqueIndex("css_user_scope_uniq").on(
      table.userId,
      table.scope
    ),
  })
);

export type ForumPost = typeof forumPosts.$inferSelect;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
