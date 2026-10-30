/**
 * Nexora Bots - NodePalette Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NodePalette } from './NodePalette';
import { allNodeDefinitions, nodeCategories } from '@/types/bots';
import { useState } from 'react';

const meta: Meta<typeof NodePalette> = {
  title: 'Flow/NodePalette',
  component: NodePalette,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    onDragStart: { action: 'dragStart' },
    searchQuery: { control: 'text' },
    onSearchChange: { action: 'searchChange' },
    categories: { control: 'object' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '280px', height: '600px', minWidth: '280px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: '',
    onSearchChange: (query) => console.log('Search:', query),
    categories: nodeCategories,
  },
};

export const WithSearch: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: 'message',
    onSearchChange: (query) => console.log('Search:', query),
    categories: nodeCategories,
  },
};

export const TriggerCategoryOnly: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: '',
    onSearchChange: (query) => console.log('Search:', query),
    categories: [nodeCategories[0]], // Only triggers
  },
};

export const ActionCategoryOnly: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: '',
    onSearchChange: (query) => console.log('Search:', query),
    categories: [nodeCategories[1]], // Only actions
  },
};

export const LogicCategoryOnly: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: '',
    onSearchChange: (query) => console.log('Search:', query),
    categories: [nodeCategories[2]], // Only logic
  },
};

// Interactive demo with search state
export const Interactive: Story = {
  render: () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [lastDragged, setLastDragged] = useState<string | null>(null);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '280px' }}>
        <div style={{ padding: '16px', background: '#25272b', borderRadius: '8px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', color: '#b9bbbe' }}>Search Query:</div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type to filter nodes..."
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#1e1f22',
              border: '1px solid #3e4147',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ padding: '16px', background: '#25272b', borderRadius: '8px' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', color: '#b9bbbe' }}>Last Dragged:</div>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#5865f2' }}>
            {lastDragged || 'None'}
          </div>
        </div>

        <NodePalette
          onDragStart={(event, node) => {
            console.log('Drag start:', node.label);
            setLastDragged(node.label);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={nodeCategories}
        />
      </div>
    );
  },
};

// All nodes flat list
export const AllNodesFlat: Story = {
  args: {
    onDragStart: (event, node) => console.log('Drag start:', node.label),
    searchQuery: '',
    onSearchChange: (query) => console.log('Search:', query),
    categories: [
      {
        id: 'all',
        label: 'All Nodes',
        description: 'All available nodes',
        color: '#5865f2',
        icon: 'Grid',
        nodes: allNodeDefinitions,
      },
    ],
  },
};