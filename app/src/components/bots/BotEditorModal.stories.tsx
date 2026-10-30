/**
 * Nexora Bots - BotEditorModal Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BotEditorModal } from './BotEditorModal';
import { Bot, BotMode } from '@/types/bots';
import { useState } from 'react';

const meta: Meta<typeof BotEditorModal> = {
  title: 'Bots/BotEditorModal',
  component: BotEditorModal,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    bot: { control: 'object' },
    isOpen: { control: 'boolean' },
    onClose: { action: 'close' },
    onSave: { action: 'save' },
    availableNodes: { control: 'object' },
    saving: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', minWidth: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockBot: Bot = {
  id: 'bot-123',
  serverId: 'server-456',
  name: 'Welcome Bot',
  description: 'Automatically welcomes new members and assigns the "Member" role.',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=welcome-bot',
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

const advancedCode = `import { BotContext, BotHandler } from 'nexora-bots';

interface ModConfig {
  bannedWords: string[];
  maxWarnings: number;
}

const handler: BotHandler<ModConfig> = async (context, config) => {
  const { event, client, utils, log, vars } = context;

  if (event.type === 'message_create') {
    const message = event.data;
    const content = message.content.toLowerCase();

    for (const word of config.bannedWords) {
      if (content.includes(word.toLowerCase())) {
        await client.deleteMessage(message.channel_id, message.id);
        await client.timeoutMember(message.guild_id, message.author_id, 600000, 'Banned word: ' + word);
        log.warn('Deleted message from ' + message.author_id + ': banned word "' + word + '"');
        return;
      }
    }
  }
};

export default handler;`;

const mockAdvancedBot: Bot = {
  ...mockBot,
  id: 'bot-456',
  name: 'Auto-Mod Bot',
  description: 'Advanced moderation bot with custom TypeScript logic.',
  mode: 'advanced',
  code: advancedCode,
};

export const CreateSimple: Story = {
  args: {
    bot: null,
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => {
      console.log('Save bot:', data);
      await new Promise((r) => setTimeout(r, 1000));
    },
    availableNodes: [],
    saving: false,
  },
};

export const CreateAdvanced: Story = {
  args: {
    bot: null,
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => {
      console.log('Save bot:', data);
      await new Promise((r) => setTimeout(r, 1000));
    },
    availableNodes: [],
    saving: false,
  },
};

export const EditSimple: Story = {
  args: {
    bot: mockBot,
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => {
      console.log('Save bot:', data);
      await new Promise((r) => setTimeout(r, 1000));
    },
    availableNodes: [],
    saving: false,
  },
};

export const EditAdvanced: Story = {
  args: {
    bot: mockAdvancedBot,
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => {
      console.log('Save bot:', data);
      await new Promise((r) => setTimeout(r, 1000));
    },
    availableNodes: [],
    saving: false,
  },
};

export const Saving: Story = {
  args: {
    bot: mockBot,
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => {
      console.log('Save bot:', data);
      await new Promise((r) => setTimeout(r, 3000));
    },
    availableNodes: [],
    saving: true,
  },
};

export const WithValidationError: Story = {
  args: {
    bot: { ...mockBot, name: '' },
    isOpen: true,
    onClose: () => console.log('Close'),
    onSave: async (data) => console.log('Save bot:', data),
    availableNodes: [],
    saving: false,
  },
};

// Interactive demo
export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    const [bot, setBot] = useState<Bot | null>(mockBot);
    const [saving, setSaving] = useState(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', background: '#25272b', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px', color: '#fff', fontSize: '14px' }}>Modal Controls</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setIsOpen(true)}
              style={{ padding: '8px 16px', background: '#5865f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Open Create
            </button>
            <button
              onClick={() => { setBot(mockBot); setIsOpen(true); }}
              style={{ padding: '8px 16px', background: '#3ba55c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Open Edit (Simple)
            </button>
            <button
              onClick={() => { setBot(mockAdvancedBot); setIsOpen(true); }}
              style={{ padding: '8px 16px', background: '#faa61a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Open Edit (Advanced)
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{ padding: '8px 16px', background: '#ed4245', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Close
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={saving}
                onChange={(e) => setSaving(e.target.checked)}
              />
              Saving
            </label>
          </div>
        </div>

        <BotEditorModal
          bot={bot}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSave={async (data) => {
            setSaving(true);
            console.log('Save:', data);
            await new Promise((r) => setTimeout(r, 1500));
            setSaving(false);
            setIsOpen(false);
          }}
          availableNodes={[]}
          saving={saving}
        />
      </div>
    );
  },
};