/**
 * Nexora Bots - Type Definitions
 * Complete type system for bot management, flows, and executions
 */

// ============================================
// Core Bot Types
// ============================================

export type BotMode = 'simple' | 'advanced';
export type BotStatus = 'enabled' | 'disabled';
export type ExecutionStatus = 'success' | 'failed' | 'timeout' | 'running';

export interface Bot {
  id: string;
  serverId: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  mode: BotMode;
  status: BotStatus;
  flow: BotFlow | null;        // For simple mode
  code: string | null;         // For advanced mode
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  executionCount: number;
  lastExecutedAt: string | null;
}

export interface BotFlow {
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================
// Flow Node & Edge Types (React Flow compatible)
// ============================================

export type NodeCategory = 'trigger' | 'action' | 'logic';

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  style?: React.CSSProperties;
  className?: string;
  sourcePosition?: Position;
  targetPosition?: Position;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier';
  animated?: boolean;
  style?: React.CSSProperties;
  label?: string;
  labelStyle?: React.CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: React.CSSProperties;
  markerEnd?: MarkerType;
}

export type Position = 'left' | 'right' | 'top' | 'bottom';
export type MarkerType = 'arrow' | 'arrowclosed' | 'circle' | 'diamond';

// ============================================
// Node Types Registry
// ============================================

export type TriggerNodeType =
  | 'message_create'
  | 'member_join'
  | 'command'
  | 'scheduled'
  | 'webhook'
  | 'reaction_add'
  | 'voice_join'
  | 'channel_create'
  | 'role_update'
  | 'message_update'
  | 'message_delete';

export type ActionNodeType =
  | 'send_message'
  | 'send_embed'
  | 'add_role'
  | 'remove_role'
  | 'timeout_member'
  | 'kick_member'
  | 'ban_member'
  | 'create_channel'
  | 'delete_channel'
  | 'send_dm'
  | 'webhook_call'
  | 'run_code'
  | 'delay'
  | 'log_audit'
  | 'reply_message'
  | 'edit_message'
  | 'delete_message'
  | 'pin_message';

export type LogicNodeType =
  | 'condition'
  | 'parallel'
  | 'delay'
  | 'switch';

export type NodeType = TriggerNodeType | ActionNodeType | LogicNodeType;

export const NODE_CATEGORIES: Record<NodeType, NodeCategory> = {
  // Triggers
  message_create: 'trigger',
  member_join: 'trigger',
  command: 'trigger',
  scheduled: 'trigger',
  webhook: 'trigger',
  reaction_add: 'trigger',
  voice_join: 'trigger',
  channel_create: 'trigger',
  role_update: 'trigger',
  message_update: 'trigger',
  message_delete: 'trigger',
  // Actions
  send_message: 'action',
  send_embed: 'action',
  add_role: 'action',
  remove_role: 'action',
  timeout_member: 'action',
  kick_member: 'action',
  ban_member: 'action',
  create_channel: 'action',
  delete_channel: 'action',
  send_dm: 'action',
  webhook_call: 'action',
  run_code: 'action',
  log_audit: 'action',
  reply_message: 'action',
  edit_message: 'action',
  delete_message: 'action',
  pin_message: 'action',
  // Logic
  condition: 'logic',
  parallel: 'logic',
  delay: 'logic',
  switch: 'logic',
};

// ============================================
// Node Data Structures
// ============================================

export interface BaseNodeData {
  label: string;
  description?: string;
  category: NodeCategory;
  icon?: string;
  color?: string;
  disabled?: boolean;
  error?: string;
}

export interface TriggerNodeData extends BaseNodeData {
  category: 'trigger';
  triggerType: TriggerNodeType;
  config: TriggerConfig;
  outputs: NodeOutput[];
}

export interface ActionNodeData extends BaseNodeData {
  category: 'action';
  actionType: ActionNodeType;
  config: ActionConfig;
  inputs: NodeInput[];
  outputs: NodeOutput[];
}

export interface LogicNodeData extends BaseNodeData {
  category: 'logic';
  logicType: LogicNodeType;
  config: LogicConfig;
  inputs: NodeInput[];
  outputs: NodeOutput[];
}

export type NodeData = TriggerNodeData | ActionNodeData | LogicNodeData;

// ============================================
// Node Configuration Types
// ============================================

export interface NodeInput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'channel' | 'role' | 'user' | 'message' | 'execution';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  options?: SelectOption[];
}

export interface NodeOutput {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'channel' | 'role' | 'user' | 'message' | 'execution';
  description?: string;
}

export interface SelectOption {
  value: string | number | boolean;
  label: string;
  description?: string;
}

// Trigger Configurations
export interface TriggerConfig {
  // message_create
  channelIds?: string[];
  keyword?: string;
  regex?: string;
  authorId?: string;
  ignoreBots?: boolean;
  ignoreSelf?: boolean;

  // member_join
  roleIds?: string[];
  requireRole?: string[];

  // command
  commandName?: string;
  aliases?: string[];
  description?: string;
  options?: CommandOption[];

  // scheduled
  cronExpression?: string;
  timezone?: string;

  // webhook
  webhookPath?: string;
  secret?: string;

  // reaction_add
  emoji?: string;
  messageId?: string;

  // voice_join
  voiceChannelIds?: string[];

  // channel_create
  channelType?: 'text' | 'voice' | 'category' | 'forum';

  // Common
  extraCondition?: string; // JavaScript expression
}

export interface CommandOption {
  name: string;
  description: string;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'user' | 'channel' | 'role' | 'mentionable';
  required: boolean;
  choices?: { name: string; value: string | number }[];
  autocomplete?: boolean;
}

// Action Configurations
export interface ActionConfig {
  // send_message / reply_message / edit_message
  channelId?: string;
  content?: string;
  embeds?: EmbedConfig[];
  components?: ComponentConfig[];
  replyToMessageId?: string;
  messageId?: string;

  // send_embed
  embed?: EmbedConfig;

  // add_role / remove_role
  roleId?: string;
  userId?: string;
  roleReason?: string;

  // timeout_member
  duration?: number; // milliseconds
  timeoutReason?: string;

  // kick_member / ban_member
  banUserId?: string;
  banReason?: string;
  deleteMessageSeconds?: number;

  // create_channel
  name?: string;
  type?: 'text' | 'voice' | 'category' | 'forum';
  parentId?: string;
  topic?: string;
  nsfw?: boolean;

  // send_dm
  dmUserId?: string;
  dmContent?: string;
  dmEmbeds?: EmbedConfig[];

  // webhook_call
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;

  // run_code
  code?: string;
  timeout?: number;

  // delay
  milliseconds?: number;

  // log_audit
  action?: string;
  details?: Record<string, unknown>;
}

export interface EmbedConfig {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: boolean;
  footer?: { text: string; iconUrl?: string };
  author?: { name: string; url?: string; iconUrl?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: EmbedField[];
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface ComponentConfig {
  type: 'button' | 'select' | 'action_row';
  components?: ComponentConfig[];
  // Button
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  label?: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  customId?: string;
  url?: string;
  disabled?: boolean;
  // Select
  placeholder?: string;
  options?: SelectMenuOption[];
  minValues?: number;
  maxValues?: number;
}

export interface SelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  default?: boolean;
}

// Logic Configurations
export interface LogicConfig {
  // condition
  expression?: string; // JavaScript expression returning boolean
  trueLabel?: string;
  falseLabel?: string;

  // parallel
  branches?: ParallelBranch[];

  // switch
  value?: string;
  cases?: SwitchCase[];
  defaultCase?: string;

  // delay
  milliseconds?: number;
}

export interface ParallelBranch {
  id: string;
  label: string;
  nodes: FlowNode[];
}

export interface SwitchCase {
  value: string;
  label: string;
  nodes: FlowNode[];
}

// ============================================
// Node Definitions for Palette
// ============================================

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultData: Partial<NodeData>;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  configSchema: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'multiselect' | 'channel' | 'role' | 'user' | 'code' | 'cron' | 'json';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  options?: SelectOption[];
  placeholder?: string;
  validation?: (value: unknown) => string | null;
  dependsOn?: string; // Field key this depends on
  showWhen?: (values: Record<string, unknown>) => boolean;
}

// ============================================
// Execution Types
// ============================================

export interface BotExecution {
  id: string;
  botId: string;
  serverId: string;
  status: ExecutionStatus;
  trigger: ExecutionTrigger;
  context: ExecutionContext;
  result: ExecutionResult;
  error: ExecutionError | null;
  startedAt: string;
  completedAt: string | null;
  duration: number; // milliseconds
}

export interface ExecutionTrigger {
  type: TriggerNodeType;
  data: Record<string, unknown>;
  userId?: string;
  channelId?: string;
  guildId?: string;
}

export interface ExecutionContext {
  variables: Record<string, unknown>;
  user?: { id: string; username: string; avatar: string | null };
  channel?: { id: string; name: string; type: number };
  guild?: { id: string; name: string; icon: string | null };
  message?: { id: string; content: string; authorId: string };
}

export interface ExecutionResult {
  nodesExecuted: number;
  actionsPerformed: ActionResult[];
  finalOutput?: Record<string, unknown>;
}

export interface ActionResult {
  nodeId: string;
  nodeType: NodeType;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  duration: number;
}

export interface ExecutionError {
  nodeId: string;
  message: string;
  stack?: string;
  code?: string;
}

// ============================================
// API Response Types
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BotListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BotStatus;
  mode?: BotMode;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'executionCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ExecutionListParams {
  page?: number;
  pageSize?: number;
  status?: ExecutionStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'startedAt' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// UI State Types
// ============================================

export interface BotEditorState {
  mode: BotMode;
  basicInfo: {
    name: string;
    description: string;
    avatarUrl: string | null;
  };
  flow: BotFlow | null;
  code: string;
  validationErrors: ValidationError[];
  isDirty: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FlowEditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  history: HistoryState;
  clipboard: FlowNode[];
}

export interface HistoryState {
  past: { nodes: FlowNode[]; edges: FlowEdge[] }[];
  future: { nodes: FlowNode[]; edges: FlowEdge[] }[];
  maxSize: number;
}

// ============================================
// Component Props Types
// ============================================

export interface BotListItemProps {
  bot: Bot;
  onEdit: (bot: Bot) => void;
  onDuplicate: (bot: Bot) => void;
  onDelete: (bot: Bot) => void;
  onToggleStatus: (bot: Bot, enabled: boolean) => void;
  onViewExecutions: (bot: Bot) => void;
}

export interface BotFlowEditorProps {
  initialFlow?: BotFlow;
  readOnly?: boolean;
  onChange: (flow: BotFlow) => void;
  onValidate: (errors: ValidationError[]) => void;
  availableNodes: NodeDefinition[];
}

export interface NodeConfigSidebarProps {
  node: FlowNode | null;
  nodeDefinition: NodeDefinition | null;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  validationErrors?: Record<string, string>;
}

export interface FlowToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onCenter: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onAlign: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  zoom: number;
}

export interface BotExecutionsTabProps {
  botId: string;
  serverId: string;
}

export interface ExecutionDetailModalProps {
  execution: BotExecution | null;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type NodeConfigMap = Record<NodeType, NodeDefinition>;

// ============================================
// Event Types (for WebSocket/real-time)
// ============================================

export interface BotEvent {
  type: 'bot.created' | 'bot.updated' | 'bot.deleted' | 'bot.status_changed' | 'execution.started' | 'execution.completed' | 'execution.failed';
  payload: Bot | BotExecution;
  timestamp: string;
}

export interface BotEventHandlers {
  onBotCreated?: (bot: Bot) => void;
  onBotUpdated?: (bot: Bot) => void;
  onBotDeleted?: (botId: string) => void;
  onBotStatusChanged?: (botId: string, status: BotStatus) => void;
  onExecutionStarted?: (execution: BotExecution) => void;
  onExecutionCompleted?: (execution: BotExecution) => void;
  onExecutionFailed?: (execution: BotExecution) => void;
}