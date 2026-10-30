/**
 * Nexora Bots - Node Definitions
 * Complete registry of all available node types for the visual flow editor
 */

import type {
  NodeDefinition,
  NodeType,
  NodeCategory,
  NodeInput,
  NodeOutput,
  ConfigField,
  SelectOption,
  TriggerNodeType,
  ActionNodeType,
  LogicNodeType,
} from './bot';

import { NODE_CATEGORIES } from './bot';

import { colors } from '@/styles/design-tokens';

// ============================================
// Helper Functions
// ============================================

const createTriggerNode = (
  type: TriggerNodeType,
  label: string,
  description: string,
  icon: string,
  color: string,
  outputs: NodeOutput[],
  configFields: ConfigField[]
): NodeDefinition => ({
  type,
  category: 'trigger',
  label,
  description,
  icon,
  color,
  defaultData: {
    label,
    category: 'trigger',
    triggerType: type,
    config: {},
    outputs,
  },
  inputs: [],
  outputs,
  configSchema: configFields,
});

const createActionNode = (
  type: ActionNodeType,
  label: string,
  description: string,
  icon: string,
  color: string,
  inputs: NodeInput[],
  outputs: NodeOutput[],
  configFields: ConfigField[]
): NodeDefinition => ({
  type,
  category: 'action',
  label,
  description,
  icon,
  color,
  defaultData: {
    label,
    category: 'action',
    actionType: type,
    config: {},
    inputs,
    outputs,
  },
  inputs,
  outputs,
  configSchema: configFields,
});

const createLogicNode = (
  type: LogicNodeType,
  label: string,
  description: string,
  icon: string,
  color: string,
  inputs: NodeInput[],
  outputs: NodeOutput[],
  configFields: ConfigField[]
): NodeDefinition => ({
  type,
  category: 'logic',
  label,
  description,
  icon,
  color,
  defaultData: {
    label,
    category: 'logic',
    logicType: type,
    config: {},
    inputs,
    outputs,
  },
  inputs,
  outputs,
  configSchema: configFields,
});

// ============================================
// Common Inputs/Outputs
// ============================================

const executionOutput: NodeOutput = {
  id: 'execution',
  name: 'Execution',
  type: 'execution',
  description: 'Triggers the next node in the flow',
};

const messageInput: NodeInput = {
  id: 'message',
  name: 'Message',
  type: 'message',
  required: false,
  description: 'The message that triggered this flow',
};

const guildInput: NodeInput = {
  id: 'guild',
  name: 'Guild',
  type: 'object',
  required: false,
  description: 'The guild/server context',
};

const userInput: NodeInput = {
  id: 'user',
  name: 'User',
  type: 'user',
  required: false,
  description: 'The user who triggered this flow',
};

const channelInput: NodeInput = {
  id: 'channel',
  name: 'Channel',
  type: 'channel',
  required: false,
  description: 'The channel where the trigger occurred',
};

// ============================================
// Channel/Role/User Selectors
// ============================================

const channelSelectField: ConfigField = {
  key: 'channelId',
  label: 'Channel',
  type: 'channel',
  required: true,
  description: 'Select the target channel',
};

const channelSelectOptionalField: ConfigField = {
  key: 'channelId',
  label: 'Channel (optional)',
  type: 'channel',
  required: false,
  description: 'Leave empty to use trigger channel',
};

const roleSelectField: ConfigField = {
  key: 'roleId',
  label: 'Role',
  type: 'role',
  required: true,
  description: 'Select the target role',
};

const userSelectField: ConfigField = {
  key: 'userId',
  label: 'User',
  type: 'user',
  required: true,
  description: 'Select the target user',
};

const userSelectOptionalField: ConfigField = {
  key: 'userId',
  label: 'User (optional)',
  type: 'user',
  required: false,
  description: 'Leave empty to use trigger user',
};

// ============================================
// Trigger Nodes
// ============================================

export const triggerNodes: NodeDefinition[] = [
  createTriggerNode(
    'message_create',
    'Message Created',
    'Triggers when a message is sent in a channel',
    'MessageSquare',
    '#3ba55c',
    [executionOutput, messageInput, guildInput, userInput, channelInput],
    [
      {
        key: 'channelIds',
        label: 'Channels',
        type: 'multiselect',
        required: false,
        description: 'Specific channels to listen to (empty = all)',
        options: [],
      },
      {
        key: 'keyword',
        label: 'Keyword',
        type: 'text',
        required: false,
        description: 'Message must contain this keyword',
        placeholder: 'e.g., hello, help, ping',
      },
      {
        key: 'regex',
        label: 'Regex Pattern',
        type: 'text',
        required: false,
        description: 'Message must match this regex pattern',
        placeholder: '^!command\\s+(.+)$',
      },
      {
        key: 'authorId',
        label: 'Author ID',
        type: 'user',
        required: false,
        description: 'Only trigger for specific user',
      },
      {
        key: 'ignoreBots',
        label: 'Ignore Bots',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Do not trigger on bot messages',
      },
      {
        key: 'ignoreSelf',
        label: 'Ignore Self',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Do not trigger on bot\'s own messages',
      },
      {
        key: 'extraCondition',
        label: 'Extra Condition (JS)',
        type: 'code',
        required: false,
        description: 'Additional JavaScript condition (return true/false)',
        placeholder: 'event.message.content.length > 10',
      },
    ]
  ),

  createTriggerNode(
    'member_join',
    'Member Joined',
    'Triggers when a new member joins the server',
    'UserPlus',
    '#3ba55c',
    [executionOutput, guildInput, userInput],
    [
      {
        key: 'roleIds',
        label: 'Required Roles',
        type: 'multiselect',
        required: false,
        description: 'Only trigger if member has these roles',
        options: [],
      },
      {
        key: 'requireRole',
        label: 'Must Have Role',
        type: 'role',
        required: false,
        description: 'Member must have this role to trigger',
      },
    ]
  ),

  createTriggerNode(
    'command',
    'Slash Command',
    'Triggers when a slash command is used',
    'Slash',
    '#3ba55c',
    [executionOutput, guildInput, userInput, channelInput],
    [
      {
        key: 'commandName',
        label: 'Command Name',
        type: 'text',
        required: true,
        description: 'The slash command name',
        placeholder: 'ping',
      },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        required: true,
        description: 'Command description shown in Discord',
        placeholder: 'Check bot latency',
      },
      {
        key: 'aliases',
        label: 'Aliases',
        type: 'text',
        required: false,
        description: 'Alternative names (comma-separated)',
        placeholder: 'p, latency',
      },
      {
        key: 'options',
        label: 'Options',
        type: 'json',
        required: false,
        description: 'Command options in JSON format',
        placeholder: '[{"name": "user", "type": "user", "description": "Target user", "required": false}]',
      },
    ]
  ),

  createTriggerNode(
    'scheduled',
    'Scheduled',
    'Triggers on a cron schedule',
    'Clock',
    '#3ba55c',
    [executionOutput, guildInput],
    [
      {
        key: 'cronExpression',
        label: 'Cron Expression',
        type: 'cron',
        required: true,
        description: 'Cron expression (e.g., 0 * * * * for hourly)',
        placeholder: '0 * * * *',
      },
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'select',
        required: false,
        defaultValue: 'UTC',
        description: 'Timezone for the schedule',
        options: [
          { value: 'UTC', label: 'UTC' },
          { value: 'America/New_York', label: 'Eastern Time' },
          { value: 'America/Los_Angeles', label: 'Pacific Time' },
          { value: 'Europe/London', label: 'London' },
          { value: 'Europe/Paris', label: 'Paris' },
          { value: 'Asia/Tokyo', label: 'Tokyo' },
        ],
      },
    ]
  ),

  createTriggerNode(
    'webhook',
    'Webhook Received',
    'Triggers when an HTTP request is received',
    'Webhook',
    '#3ba55c',
    [executionOutput],
    [
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        type: 'text',
        required: true,
        description: 'URL path for this webhook',
        placeholder: '/webhook/github',
      },
      {
        key: 'secret',
        label: 'Secret',
        type: 'text',
        required: false,
        description: 'Optional secret for signature verification',
        placeholder: 'optional-secret-key',
      },
    ]
  ),

  createTriggerNode(
    'reaction_add',
    'Reaction Added',
    'Triggers when a reaction is added to a message',
    'Heart',
    '#3ba55c',
    [executionOutput, messageInput, guildInput, userInput, channelInput],
    [
      {
        key: 'emoji',
        label: 'Emoji',
        type: 'text',
        required: false,
        description: 'Specific emoji to listen for (empty = any)',
        placeholder: '✅ or :custom_emoji:',
      },
      {
        key: 'messageId',
        label: 'Message ID',
        type: 'text',
        required: false,
        description: 'Specific message ID (empty = any message)',
        placeholder: '123456789012345678',
      },
    ]
  ),

  createTriggerNode(
    'voice_join',
    'Voice Channel Join',
    'Triggers when a user joins a voice channel',
    'Mic',
    '#3ba55c',
    [executionOutput, guildInput, userInput, channelInput],
    [
      {
        key: 'voiceChannelIds',
        label: 'Voice Channels',
        type: 'multiselect',
        required: false,
        description: 'Specific voice channels (empty = all)',
        options: [],
      },
    ]
  ),

  createTriggerNode(
    'channel_create',
    'Channel Created',
    'Triggers when a channel is created',
    'Hash',
    '#3ba55c',
    [executionOutput, guildInput, userInput],
    [
      {
        key: 'channelType',
        label: 'Channel Type',
        type: 'select',
        required: false,
        description: 'Filter by channel type',
        options: [
          { value: 'text', label: 'Text Channel' },
          { value: 'voice', label: 'Voice Channel' },
          { value: 'category', label: 'Category' },
          { value: 'forum', label: 'Forum' },
        ],
      },
    ]
  ),

  createTriggerNode(
    'role_update',
    'Role Updated',
    'Triggers when a role is updated',
    'UserCog',
    '#3ba55c',
    [executionOutput, guildInput, userInput],
    []
  ),

  createTriggerNode(
    'message_update',
    'Message Updated',
    'Triggers when a message is edited',
    'MessageSquareDiff',
    '#3ba55c',
    [executionOutput, messageInput, guildInput, userInput, channelInput],
    [
      {
        key: 'ignoreBots',
        label: 'Ignore Bots',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ]
  ),

  createTriggerNode(
    'message_delete',
    'Message Deleted',
    'Triggers when a message is deleted',
    'Trash2',
    '#3ba55c',
    [executionOutput, messageInput, guildInput, userInput, channelInput],
    [
      {
        key: 'ignoreBots',
        label: 'Ignore Bots',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ]
  ),
];

// ============================================
// Action Nodes
// ============================================

export const actionNodes: NodeDefinition[] = [
  createActionNode(
    'send_message',
    'Send Message',
    'Sends a message to a channel',
    'Send',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      channelSelectOptionalField,
      {
        key: 'content',
        label: 'Message Content',
        type: 'textarea',
        required: true,
        description: 'Message text (supports variables like {user}, {channel})',
        placeholder: 'Hello {user}! Welcome to {guild.name}',
      },
      {
        key: 'embeds',
        label: 'Embeds',
        type: 'json',
        required: false,
        description: 'Array of embed objects',
        placeholder: '[{"title": "Welcome", "description": "Thanks for joining!", "color": 5814782}]',
      },
      {
        key: 'replyToMessageId',
        label: 'Reply to Message ID',
        type: 'text',
        required: false,
        description: 'Message ID to reply to',
        placeholder: '123456789012345678',
      },
    ]
  ),

  createActionNode(
    'send_embed',
    'Send Embed',
    'Sends a rich embed message',
    'FileText',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      channelSelectOptionalField,
      {
        key: 'embed',
        label: 'Embed Configuration',
        type: 'json',
        required: true,
        description: 'Full embed object',
        placeholder: '{"title": "Title", "description": "Description", "color": 5814782, "fields": [{"name": "Field", "value": "Value", "inline": true}]}',
      },
    ]
  ),

  createActionNode(
    'add_role',
    'Add Role',
    'Adds a role to a member',
    'UserCheck',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      roleSelectField,
      userSelectOptionalField,
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for adding the role (shown in audit log)',
        placeholder: 'Auto-role for new members',
      },
    ]
  ),

  createActionNode(
    'remove_role',
    'Remove Role',
    'Removes a role from a member',
    'UserX',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      roleSelectField,
      userSelectOptionalField,
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for removing the role',
        placeholder: 'Role expired',
      },
    ]
  ),

  createActionNode(
    'timeout_member',
    'Timeout Member',
    'Times out a member for a duration',
    'ClockAlert',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      userSelectField,
      {
        key: 'duration',
        label: 'Duration (minutes)',
        type: 'number',
        required: true,
        description: 'Timeout duration in minutes (max 40320 = 28 days)',
        defaultValue: 10,
      },
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for timeout',
        placeholder: 'Spamming',
      },
    ]
  ),

  createActionNode(
    'kick_member',
    'Kick Member',
    'Kicks a member from the server',
    'UserMinus',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      userSelectField,
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for kick',
        placeholder: 'Rule violation',
      },
    ]
  ),

  createActionNode(
    'ban_member',
    'Ban Member',
    'Bans a member from the server',
    'Ban',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      { ...userSelectField, key: 'banUserId' },
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for ban',
        placeholder: 'Severe rule violation',
      },
      {
        key: 'deleteMessageSeconds',
        label: 'Delete Messages (seconds)',
        type: 'number',
        required: false,
        defaultValue: 0,
        description: 'Seconds of messages to delete (0-604800)',
      },
    ]
  ),

  createActionNode(
    'create_channel',
    'Create Channel',
    'Creates a new channel',
    'PlusSquare',
    '#5865f2',
    [messageInput, guildInput, userInput],
    [executionOutput, channelInput],
    [
      {
        key: 'name',
        label: 'Channel Name',
        type: 'text',
        required: true,
        description: 'Name of the new channel',
        placeholder: 'welcome-chat',
      },
      {
        key: 'type',
        label: 'Channel Type',
        type: 'select',
        required: true,
        defaultValue: 'text',
        description: 'Type of channel to create',
        options: [
          { value: 'text', label: 'Text Channel' },
          { value: 'voice', label: 'Voice Channel' },
          { value: 'category', label: 'Category' },
          { value: 'forum', label: 'Forum Channel' },
        ],
      },
      {
        key: 'parentId',
        label: 'Parent Category',
        type: 'channel',
        required: false,
        description: 'Category to create channel in',
      },
      {
        key: 'topic',
        label: 'Topic',
        type: 'text',
        required: false,
        description: 'Channel topic (text channels only)',
        placeholder: 'Welcome channel for new members',
      },
      {
        key: 'nsfw',
        label: 'NSFW',
        type: 'boolean',
        required: false,
        defaultValue: false,
        description: 'Mark channel as NSFW',
      },
    ]
  ),

  createActionNode(
    'delete_channel',
    'Delete Channel',
    'Deletes a channel',
    'MinusSquare',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      channelSelectField,
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for deletion',
        placeholder: 'Cleanup old channel',
      },
    ]
  ),

  createActionNode(
    'send_dm',
    'Send DM',
    'Sends a direct message to a user',
    'Mail',
    '#5865f2',
    [messageInput, guildInput, userInput],
    [executionOutput],
    [
      userSelectField,
      {
        key: 'dmContent',
        label: 'Message Content',
        type: 'textarea',
        required: true,
        description: 'DM text content',
        placeholder: 'Hello! This is a private message.',
      },
      {
        key: 'dmEmbeds',
        label: 'Embeds',
        type: 'json',
        required: false,
        description: 'Array of embed objects',
        placeholder: '[{"title": "DM Title", "description": "Content"}]',
      },
    ]
  ),

  createActionNode(
    'webhook_call',
    'Webhook Call',
    'Makes an HTTP request to a webhook URL',
    'Globe',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput, { id: 'response', name: 'Response', type: 'object', description: 'HTTP response data' }],
    [
      {
        key: 'url',
        label: 'Webhook URL',
        type: 'text',
        required: true,
        description: 'Target webhook URL',
        placeholder: 'https://api.example.com/webhook',
      },
      {
        key: 'method',
        label: 'HTTP Method',
        type: 'select',
        required: true,
        defaultValue: 'POST',
        description: 'HTTP method to use',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      {
        key: 'headers',
        label: 'Headers',
        type: 'json',
        required: false,
        description: 'HTTP headers as JSON object',
        placeholder: '{"Authorization": "Bearer token", "Content-Type": "application/json"}',
      },
      {
        key: 'body',
        label: 'Request Body',
        type: 'json',
        required: false,
        description: 'Request body as JSON',
        placeholder: '{"key": "value", "user": "{user.id}"}',
      },
    ]
  ),

  createActionNode(
    'run_code',
    'Run Code',
    'Executes custom JavaScript code',
    'Terminal',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput, { id: 'result', name: 'Result', type: 'object', description: 'Code execution result' }],
    [
      {
        key: 'code',
        label: 'JavaScript Code',
        type: 'code',
        required: true,
        description: 'Code to execute. Available: event, client, utils, context',
        placeholder: 'const result = await utils.fetch("https://api.example.com");\nreturn { data: result };',
      },
      {
        key: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        required: false,
        defaultValue: 5000,
        description: 'Maximum execution time in milliseconds',
      },
    ]
  ),

  createActionNode(
    'delay',
    'Delay',
    'Pauses execution for specified time',
    'Timer',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'milliseconds',
        label: 'Delay (milliseconds)',
        type: 'number',
        required: true,
        defaultValue: 1000,
        description: 'Time to wait before continuing',
      },
    ]
  ),

  createActionNode(
    'log_audit',
    'Log to Audit',
    'Logs an entry to the server audit log',
    'FileText',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'action',
        label: 'Action Name',
        type: 'text',
        required: true,
        description: 'Name of the action being logged',
        placeholder: 'auto_mod_action',
      },
      {
        key: 'details',
        label: 'Details',
        type: 'json',
        required: false,
        description: 'Additional details as JSON',
        placeholder: '{"rule": "spam", "count": 5}',
      },
    ]
  ),

  createActionNode(
    'reply_message',
    'Reply to Message',
    'Replies to a specific message',
    'Send',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'messageId',
        label: 'Message ID to Reply',
        type: 'text',
        required: true,
        description: 'ID of the message to reply to',
        placeholder: '123456789012345678',
      },
      {
        key: 'content',
        label: 'Reply Content',
        type: 'textarea',
        required: true,
        description: 'Reply message content',
        placeholder: 'This is a reply!',
      },
      {
        key: 'embeds',
        label: 'Embeds',
        type: 'json',
        required: false,
        description: 'Array of embed objects',
      },
    ]
  ),

  createActionNode(
    'edit_message',
    'Edit Message',
    'Edits a previously sent message',
    'MessageSquareDiff',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'messageId',
        label: 'Message ID to Edit',
        type: 'text',
        required: true,
        description: 'ID of the message to edit',
        placeholder: '123456789012345678',
      },
      {
        key: 'content',
        label: 'New Content',
        type: 'textarea',
        required: false,
        description: 'New message content (leave empty to keep)',
        placeholder: 'Updated message content',
      },
      {
        key: 'embeds',
        label: 'New Embeds',
        type: 'json',
        required: false,
        description: 'New embeds array (leave empty to keep)',
      },
    ]
  ),

  createActionNode(
    'delete_message',
    'Delete Message',
    'Deletes a message',
    'Trash2',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'messageId',
        label: 'Message ID to Delete',
        type: 'text',
        required: true,
        description: 'ID of the message to delete',
        placeholder: '123456789012345678',
      },
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for deletion',
        placeholder: 'Cleanup',
      },
    ]
  ),

  createActionNode(
    'pin_message',
    'Pin Message',
    'Pins or unpins a message',
    'Zap',
    '#5865f2',
    [messageInput, guildInput, userInput, channelInput],
    [executionOutput],
    [
      {
        key: 'messageId',
        label: 'Message ID',
        type: 'text',
        required: true,
        description: 'ID of the message to pin/unpin',
        placeholder: '123456789012345678',
      },
      {
        key: 'pin',
        label: 'Pin',
        type: 'boolean',
        required: true,
        defaultValue: true,
        description: 'Pin (true) or unpin (false)',
      },
      {
        key: 'reason',
        label: 'Reason',
        type: 'text',
        required: false,
        description: 'Reason for pinning',
        placeholder: 'Important announcement',
      },
    ]
  ),
];

// ============================================
// Logic Nodes
// ============================================

export const logicNodes: NodeDefinition[] = [
  createLogicNode(
    'condition',
    'Condition (If/Else)',
    'Branches flow based on a condition',
    'SwitchCamera',
    '#faa61a',
    [messageInput, guildInput, userInput, channelInput, { id: 'input', name: 'Input', type: 'execution', required: true, description: 'Flow input' }],
    [
      { id: 'true', name: 'True', type: 'execution', description: 'Flow continues if condition is true' },
      { id: 'false', name: 'False', type: 'execution', description: 'Flow continues if condition is false' },
    ],
    [
      {
        key: 'expression',
        label: 'Condition Expression',
        type: 'code',
        required: true,
        description: 'JavaScript expression that returns true/false. Available: event, context, vars',
        placeholder: 'event.message.content.includes("spam") || vars.warningCount > 3',
      },
      {
        key: 'trueLabel',
        label: 'True Label',
        type: 'text',
        required: false,
        defaultValue: 'Yes',
        description: 'Label for true branch',
      },
      {
        key: 'falseLabel',
        label: 'False Label',
        type: 'text',
        required: false,
        defaultValue: 'No',
        description: 'Label for false branch',
      },
    ]
  ),

  createLogicNode(
    'parallel',
    'Parallel',
    'Runs multiple branches simultaneously',
    'GitBranch',
    '#faa61a',
    [{ id: 'input', name: 'Input', type: 'execution', required: true, description: 'Flow input' }],
    [
      { id: 'output', name: 'Output', type: 'execution', description: 'Continues after all branches complete' },
    ],
    [
      {
        key: 'branches',
        label: 'Branches',
        type: 'json',
        required: true,
        description: 'Array of parallel branch configurations',
        placeholder: '[{"id": "branch1", "label": "Branch 1", "nodes": []}, {"id": "branch2", "label": "Branch 2", "nodes": []}]',
      },
    ]
  ),

  createLogicNode(
    'switch',
    'Switch',
    'Routes flow based on a value',
    'SwitchCamera',
    '#faa61a',
    [{ id: 'input', name: 'Input', type: 'execution', required: true, description: 'Flow input' }],
    [
      { id: 'default', name: 'Default', type: 'execution', description: 'Default case when no match' },
    ],
    [
      {
        key: 'value',
        label: 'Switch Value',
        type: 'text',
        required: true,
        description: 'Expression to evaluate (available: event, context, vars)',
        placeholder: 'event.message.content.split(" ")[0]',
      },
      {
        key: 'cases',
        label: 'Cases',
        type: 'json',
        required: true,
        description: 'Array of case configurations',
        placeholder: '[{"value": "!ping", "label": "Ping Command", "nodes": []}, {"value": "!pong", "label": "Pong Command", "nodes": []}]',
      },
      {
        key: 'defaultCase',
        label: 'Default Case Label',
        type: 'text',
        required: false,
        defaultValue: 'Default',
        description: 'Label for default case',
      },
    ]
  ),

  createLogicNode(
    'delay',
    'Delay',
    'Pauses execution for specified time',
    'Timer',
    '#faa61a',
    [{ id: 'input', name: 'Input', type: 'execution', required: true, description: 'Flow input' }],
    [
      { id: 'output', name: 'Output', type: 'execution', description: 'Continues after delay' },
    ],
    [
      {
        key: 'milliseconds',
        label: 'Delay (milliseconds)',
        type: 'number',
        required: true,
        defaultValue: 1000,
        description: 'Time to wait before continuing',
      },
    ]
  ),
];

// ============================================
// All Nodes Registry
// ============================================

export const allNodeDefinitions: NodeDefinition[] = [
  ...triggerNodes,
  ...actionNodes,
  ...logicNodes,
];

// ============================================
// Node Categories for Palette
// ============================================

export const nodeCategories = [
  {
    id: 'trigger',
    label: 'Triggers',
    description: 'Events that start a flow',
    color: '#3ba55c',
    icon: 'Zap',
    nodes: triggerNodes,
  },
  {
    id: 'action',
    label: 'Actions',
    description: 'Operations that perform tasks',
    color: '#5865f2',
    icon: 'Send',
    nodes: actionNodes,
  },
  {
    id: 'logic',
    label: 'Logic',
    description: 'Flow control and branching',
    color: '#faa61a',
    icon: 'GitBranch',
    nodes: logicNodes,
  },
];

// ============================================
// Lookup Helpers
// ============================================

export const nodeDefinitionsMap: Record<NodeType, NodeDefinition> = {};

allNodeDefinitions.forEach((def) => {
  nodeDefinitionsMap[def.type] = def;
});

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return nodeDefinitionsMap[type];
}

export function getNodesByCategory(category: NodeCategory): NodeDefinition[] {
  return allNodeDefinitions.filter((n) => n.category === category);
}

export function getNodeColor(type: NodeType): string {
  const def = nodeDefinitionsMap[type];
  return def?.color || colors.node.trigger.border;
}

export function getNodeCategory(type: NodeType): NodeCategory {
  return NODE_CATEGORIES[type] || 'trigger';
}