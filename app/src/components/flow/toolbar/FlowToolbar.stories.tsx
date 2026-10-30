/**
 * Nexora Bots - FlowToolbar Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { FlowToolbar, KeyboardShortcutsModal } from './FlowToolbar';
import { useState } from 'react';

const meta: Meta<typeof FlowToolbar> = {
  title: 'Flow/FlowToolbar',
  component: FlowToolbar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    onZoomIn: { action: 'zoomIn' },
    onZoomOut: { action: 'zoomOut' },
    onFitView: { action: 'fitView' },
    onCenter: { action: 'center' },
    onUndo: { action: 'undo' },
    onRedo: { action: 'redo' },
    onDelete: { action: 'delete' },
    onAlignHorizontal: { action: 'alignHorizontal' },
    onAlignVertical: { action: 'alignVertical' },
    onExport: { action: 'export' },
    onImport: { action: 'import' },
    onToggleGrid: { action: 'toggleGrid' },
    onToggleMinimap: { action: 'toggleMinimap' },
    onOpenSettings: { action: 'openSettings' },
    onShowHelp: { action: 'showHelp' },
    canUndo: { control: 'boolean' },
    canRedo: { control: 'boolean' },
    hasSelection: { control: 'boolean' },
    zoom: { control: { type: 'range', min: 0.1, max: 3, step: 0.1 } },
    gridEnabled: { control: 'boolean' },
    minimapEnabled: { control: 'boolean' },
    validationErrors: { control: 'number' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', minWidth: '800px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onZoomIn: () => console.log('Zoom in'),
    onZoomOut: () => console.log('Zoom out'),
    onFitView: () => console.log('Fit view'),
    onCenter: () => console.log('Center'),
    onUndo: () => console.log('Undo'),
    onRedo: () => console.log('Redo'),
    onDelete: () => console.log('Delete'),
    onAlignHorizontal: () => console.log('Align horizontal'),
    onAlignVertical: () => console.log('Align vertical'),
    onExport: () => console.log('Export'),
    onImport: (file) => console.log('Import:', file.name),
    onToggleGrid: () => console.log('Toggle grid'),
    onToggleMinimap: () => console.log('Toggle minimap'),
    onOpenSettings: () => console.log('Open settings'),
    onShowHelp: () => console.log('Show help'),
    canUndo: true,
    canRedo: false,
    hasSelection: true,
    zoom: 1,
    gridEnabled: true,
    minimapEnabled: true,
    validationErrors: 0,
  },
};

export const WithHistory: Story = {
  args: {
    ...Default.args,
    canUndo: true,
    canRedo: true,
  },
};

export const NoSelection: Story = {
  args: {
    ...Default.args,
    hasSelection: false,
    canUndo: false,
    canRedo: false,
  },
};

export const WithValidationErrors: Story = {
  args: {
    ...Default.args,
    validationErrors: 3,
  },
};

export const ReadOnly: Story = {
  args: {
    ...Default.args,
    canUndo: false,
    canRedo: false,
    hasSelection: false,
  },
};

export const ZoomedOut: Story = {
  args: {
    ...Default.args,
    zoom: 0.5,
  },
};

export const ZoomedIn: Story = {
  args: {
    ...Default.args,
    zoom: 2,
  },
};

export const GridDisabled: Story = {
  args: {
    ...Default.args,
    gridEnabled: false,
  },
};

export const MinimapDisabled: Story = {
  args: {
    ...Default.args,
    minimapEnabled: false,
  },
};

// Interactive demo
export const Interactive: Story = {
  render: () => {
    const [state, setState] = useState({
      canUndo: true,
      canRedo: false,
      hasSelection: true,
      zoom: 1,
      gridEnabled: true,
      minimapEnabled: true,
      validationErrors: 0,
    });

    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', background: '#25272b', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px', color: '#fff', fontSize: '14px' }}>Toolbar State Controls</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={state.canUndo}
                onChange={(e) => setState({ ...state, canUndo: e.target.checked })}
              />
              Can Undo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={state.canRedo}
                onChange={(e) => setState({ ...state, canRedo: e.target.checked })}
              />
              Can Redo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={state.hasSelection}
                onChange={(e) => setState({ ...state, hasSelection: e.target.checked })}
              />
              Has Selection
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={state.gridEnabled}
                onChange={(e) => setState({ ...state, gridEnabled: e.target.checked })}
              />
              Grid Enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              <input
                type="checkbox"
                checked={state.minimapEnabled}
                onChange={(e) => setState({ ...state, minimapEnabled: e.target.checked })}
              />
              Minimap Enabled
            </label>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              Zoom:
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={state.zoom}
                onChange={(e) => setState({ ...state, zoom: parseFloat(e.target.value) })}
                style={{ width: '120px' }}
              />
              <span style={{ width: '40px', fontFamily: 'monospace' }}>{(state.zoom * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b9bbbe' }}>
              Validation Errors:
              <input
                type="number"
                min="0"
                max="10"
                value={state.validationErrors}
                onChange={(e) => setState({ ...state, validationErrors: parseInt(e.target.value) })}
                style={{ width: '60px', padding: '4px 8px', background: '#1e1f22', border: '1px solid #3e4147', borderRadius: '4px', color: '#fff' }}
              />
            </div>
          </div>
        </div>

        <FlowToolbar
          onZoomIn={() => console.log('Zoom in')}
          onZoomOut={() => console.log('Zoom out')}
          onFitView={() => console.log('Fit view')}
          onCenter={() => console.log('Center')}
          onUndo={() => console.log('Undo')}
          onRedo={() => console.log('Redo')}
          onDelete={() => console.log('Delete')}
          onAlignHorizontal={() => console.log('Align horizontal')}
          onAlignVertical={() => console.log('Align vertical')}
          onExport={() => console.log('Export')}
          onImport={(file) => console.log('Import:', file.name)}
          onToggleGrid={() => setState({ ...state, gridEnabled: !state.gridEnabled })}
          onToggleMinimap={() => setState({ ...state, minimapEnabled: !state.minimapEnabled })}
          onOpenSettings={() => console.log('Open settings')}
          onShowHelp={() => setShortcutsOpen(true)}
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          hasSelection={state.hasSelection}
          zoom={state.zoom}
          gridEnabled={state.gridEnabled}
          minimapEnabled={state.minimapEnabled}
          validationErrors={state.validationErrors}
        />

        <KeyboardShortcutsModal
          isOpen={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </div>
    );
  },
};