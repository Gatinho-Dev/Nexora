/**
 * Nexora Bots - BotExecutionsTab Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BotExecutionsTab, ExecutionDetailModal } from './BotExecutionsTab';
import { BotExecution, ExecutionStatus } from '@/types/bots';
import { useState } from 'react';

const meta: Meta<typeof BotExecutionsTab> = {
  title: 'Bots/BotExecutionsTab',
  component: BotExecutionsTab,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    botId: { control: 'text' },
    serverId: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '600px', minWidth: '800px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockExecutions: BotExecution[] = [
  {
    id: 'exec-1',
    botId: 'bot-123',
    serverId: 'server-456',
    status: 'success',
    trigger: {
      type: 'message_create',
      data: { content: '!ping', author: { id: 'user-1', username: 'Alice' } },
      userId: 'user-1',
      channelId: 'channel-1',
      guildId: 'guild-1',
    },
    context: {
      user: { id: 'user-1', username: 'Alice', avatar: null },
      channel: { id: 'channel-1', name: 'general', type: 0 },
      guild: { id: 'guild-1', name: 'Test Server', icon: null },
      message: { id: 'msg-1', content: '!ping', authorId: 'user-1' },
      variables: { warningCount: 0 },
    },
    result: {
      nodesExecuted: 3,
      actionsPerformed: [
        { nodeId: 'action-1', nodeType: 'send_message', success: true, output: { messageId: 'msg-2' }, duration: 45 },
        { nodeId: 'action-2', nodeType: 'add_role', success: true, output: { roleId: 'role-1' }, duration: 32 },
      ],
    },
    error: null,
    startedAt: '2024-01-25T10:30:00.123Z',
    completedAt: '2024-01-25T10:30:00.456Z',
    duration: 333,
  },
  {
    id: 'exec-2',
    botId: 'bot-123',
    serverId: 'server-456',
    status: 'failed',
    trigger: {
      type: 'message_create',
      data: { content: 'spam spam spam', author: { id: 'user-2', username: 'Bob' } },
      userId: 'user-2',
      channelId: 'channel-1',
      guildId: 'guild-1',
    },
    context: {
      user: { id: 'user-2', username: 'Bob', avatar: null },
      channel: { id: 'channel-1', name: 'general', type: 0 },
      guild: { id: 'guild-1', name: 'Test Server', icon: null },
      message: { id: 'msg-3', content: 'spam spam spam', authorId: 'user-2' },
      variables: { warningCount: 2 },
    },
    result: {
      nodesExecuted: 2,
      actionsPerformed: [
        { nodeId: 'action-1', nodeType: 'timeout_member', success: false, error: 'Missing permissions: TIMEOUT_MEMBERS', duration: 12 },
      ],
    },
    error: {
      nodeId: 'action-1',
      message: 'Missing permissions: TIMEOUT_MEMBERS',
      stack: 'Error: Missing permissions: TIMEOUT_MEMBERS\n    at BotHandler.execute (handler.ts:45)\n    at FlowExecutor.executeNode (executor.ts:123)',
      code: 'MISSING_PERMISSIONS',
    },
    startedAt: '2024-01-25T10:25:00.000Z',
    completedAt: '2024-01-25T10:25:00.089Z',
    duration: 89,
  },
  {
    id: 'exec-3',
    botId: 'bot-123',
    serverId: 'server-456',
    status: 'timeout',
    trigger: {
      type: 'scheduled',
      data: {},
      guildId: 'guild-1',
    },
    context: {
      guild: { id: 'guild-1', name: 'Test Server', icon: null },
      variables: {},
    },
    result: {
      nodesExecuted: 1,
      actionsPerformed: [
        { nodeId: 'action-1', nodeType: 'run_code', success: false, error: 'Execution timeout after 30000ms', duration: 30000 },
      ],
    },
    error: {
      nodeId: 'action-1',
      message: 'Execution timeout after 30000ms',
      code: 'TIMEOUT',
    },
    startedAt: '2024-01-25T09:00:00.000Z',
    completedAt: '2024-01-25T09:00:30.000Z',
    duration: 30000,
  },
  {
    id: 'exec-4',
    botId: 'bot-123',
    serverId: 'server-456',
    status: 'success',
    trigger: {
      type: 'member_join',
      data: { user: { id: 'user-3', username: 'Charlie' } },
      userId: 'user-3',
      guildId: 'guild-1',
    },
    context: {
      user: { id: 'user-3', username: 'Charlie', avatar: null },
      guild: { id: 'guild-1', name: 'Test Server', icon: null },
      variables: {},
    },
    result: {
      nodesExecuted: 4,
      actionsPerformed: [
        { nodeId: 'action-1', nodeType: 'send_message', success: true, output: { messageId: 'msg-4' }, duration: 28 },
        { nodeId: 'action-2', nodeType: 'add_role', success: true, output: { roleId: 'role-member' }, duration: 35 },
        { nodeId: 'action-3', nodeType: 'send_dm', success: true, output: { dmChannelId: 'dm-1' }, duration: 42 },
      ],
    },
    error: null,
    startedAt: '2024-01-25T08:15:00.000Z',
    completedAt: '2024-01-25T08:15:00.234Z',
    duration: 234,
  },
  {
    id: 'exec-5',
    botId: 'bot-123',
    serverId: 'server-456',
    status: 'running',
    trigger: {
      type: 'webhook',
      data: { payload: { action: 'deploy', repo: 'my-app' } },
      guildId: 'guild-1',
    },
    context: {
      guild: { id: 'guild-1', name: 'Test Server', icon: null },
      variables: { deployId: 'deploy-123' },
    },
    result: {
      nodesExecuted: 0,
      actionsPerformed: [],
    },
    error: null,
    startedAt: '2024-01-25T10:31:00.000Z',
    completedAt: null,
    duration: 0,
  },
];

export const Default: Story = {
  args: {
    botId: 'bot-123',
    serverId: 'server-456',
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <style jsx global>{`
          /* Mock the API call to return our mock data */
        `}</style>
      </div>
    ),
  ],
};

export const WithExecutions: Story = {
  args: {
    botId: 'bot-123',
    serverId: 'server-456',
  },
  decorators: [
    (Story) => (
      <ExecutionWrapper executions={mockExecutions}>
        <Story />
      </ExecutionWrapper>
    ),
  ],
};

export const Empty: Story = {
  args: {
    botId: 'bot-new',
    serverId: 'server-456',
  },
  decorators: [
    (Story) => (
      <ExecutionWrapper executions={[]}>
        <Story />
      </ExecutionWrapper>
    ),
  ],
};

export const WithFilter: Story = {
  args: {
    botId: 'bot-123',
    serverId: 'server-456',
  },
  decorators: [
    (Story) => (
      <ExecutionWrapper executions={mockExecutions}>
        <Story />
      </ExecutionWrapper>
    ),
  ],
};

// ExecutionDetailModal stories
const detailMeta: Meta<typeof ExecutionDetailModal> = {
  title: 'Bots/ExecutionDetailModal',
  component: ExecutionDetailModal,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    execution: { control: 'object' },
    isOpen: { control: 'boolean' },
    onClose: { action: 'close' },
  },
};

export const DetailSuccess: Story = {
  args: {
    execution: mockExecutions[0],
    isOpen: true,
    onClose: () => console.log('Close'),
  },
};

export const DetailFailed: Story = {
  args: {
    execution: mockExecutions[1],
    isOpen: true,
    onClose: () => console.log('Close'),
  },
};

export const DetailTimeout: Story = {
  args: {
    execution: mockExecutions[2],
    isOpen: true,
    onClose: () => console.log('Close'),
  },
};

export const DetailRunning: Story = {
  args: {
    execution: mockExecutions[4],
    isOpen: true,
    onClose: () => console.log('Close'),
  },
};

// Wrapper component to mock the API
function ExecutionWrapper({ children, executions }: { children: React.ReactNode; executions: BotExecution[] }) {
  // In a real story, we'd mock the API call
  // For now, we just render the children
  return <>{children}</>;
}