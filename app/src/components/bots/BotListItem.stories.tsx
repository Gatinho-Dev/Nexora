/**
 * Nexora Bots - BotListItem Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BotListItem } from './BotListItem';
import { Bot, BotMode, BotStatus } from '@/types/bots';

const meta: Meta<typeof BotListItem> = {
  title: 'Bots/BotListItem',
  component: BotListItem,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    bot: { control: 'object' },
    onEdit: { action: 'edit' },
    onDuplicate: { action: 'duplicate' },
    onDelete: { action: 'delete' },
    onToggleStatus: { action: 'toggleStatus' },
    onViewExecutions: { action: 'viewExecutions' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockBot: Bot = {
  id: 'bot-123',
  serverId: 'server-456',
  name: 'Welcome Bot',
  description: 'Automatically welcomes new members and assigns roles',
  avatarUrl: null,
  mode: 'simple',
  status: 'enabled',
  flow: null,
  code: null,
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-20T14:22:00Z',
  createdBy: 'user-789',
  executionCount: 1247,
  lastExecutedAt: '2024-01-25T08:15:00Z',
};

export const Default: Story = {
  args: {
    bot: mockBot,
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
};

export const AdvancedMode: Story = {
  args: {
    bot: { ...mockBot, mode: 'advanced', name: 'Auto-Mod Bot' },
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
};

export const Disabled: Story = {
  args: {
    bot: { ...mockBot, status: 'disabled', name: 'Inactive Bot' },
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
};

export const WithAvatar: Story = {
  args: {
    bot: { ...mockBot, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=welcome-bot' },
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
};

export const LongDescription: Story = {
  args: {
    bot: {
      ...mockBot,
      description: 'This bot handles multiple automation tasks including welcoming new members, assigning roles based on reactions, logging moderation actions, and responding to custom commands. It also includes scheduled tasks for daily announcements.',
    },
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
};

export const Deleting: Story = {
  args: {
    bot: mockBot,
    onEdit: (bot) => console.log('Edit:', bot.name),
    onDuplicate: (bot) => console.log('Duplicate:', bot.name),
    onDelete: (bot) => console.log('Delete:', bot.name),
    onToggleStatus: (bot, enabled) => console.log('Toggle:', bot.name, enabled),
    onViewExecutions: (bot) => console.log('View Executions:', bot.name),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
};