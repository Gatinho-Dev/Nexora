/**
 * Nexora Bots - Flow Toolbar
 * Top toolbar with zoom, fit view, undo/redo, alignment, export/import
 */

import React, { memo } from 'react';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

interface FlowToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onCenter: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onAlignHorizontal: () => void;
  onAlignVertical: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onToggleGrid: () => void;
  onToggleMinimap: () => void;
  onOpenSettings: () => void;
  onShowHelp: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  zoom: number;
  gridEnabled: boolean;
  minimapEnabled: boolean;
  validationErrors: number;
}

export const FlowToolbar = memo(function FlowToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onCenter,
  onUndo,
  onRedo,
  onDelete,
  onAlignHorizontal,
  onAlignVertical,
  onExport,
  onImport,
  onToggleGrid,
  onToggleMinimap,
  onOpenSettings,
  onShowHelp,
  canUndo,
  canRedo,
  hasSelection,
  zoom,
  gridEnabled,
  minimapEnabled,
  validationErrors,
}: FlowToolbarProps) {
  const zoomPercentage = Math.round(zoom * 100);

  const ToolbarButton = ({
    onClick,
    disabled,
    children,
    title,
    active = false,
    className = '',
  }: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
    active?: boolean;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative p-2 rounded-lg transition-all duration-fast ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-text-tertiary'
          : active
          ? 'bg-primary-500/20 text-primary-500 border border-primary-500/30'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
      } ${className}`}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );

  const ToolbarGroup = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`flex items-center gap-1 ${className}`}>{children}</div>
  );

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-surface-border mx-1" aria-hidden="true" />
  );

  return (
    <div className="flex items-center gap-2 h-10 px-3 bg-surface-secondary border-b border-surface-border">
      {/* View Controls */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={onZoomOut}
          title="Zoom Out (Ctrl+-)"
          disabled={zoom <= 0.1}
        >
          {renderIcon('Minus', 18)}
        </ToolbarButton>
        <div className="px-2 text-xs font-mono text-text-secondary min-w-[48px] text-center">
          {zoomPercentage}%
        </div>
        <ToolbarButton
          onClick={onZoomIn}
          title="Zoom In (Ctrl+=)"
          disabled={zoom >= 3}
        >
          {renderIcon('Plus', 18)}
        </ToolbarButton>
        <ToolbarButton onClick={onFitView} title="Fit View (Shift+1)">
          {renderIcon('Maximize2', 18)}
        </ToolbarButton>
        <ToolbarButton onClick={onCenter} title="Center View (Home)">
          {renderIcon('Home', 18)}
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarDivider />

      {/* History Controls */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          {renderIcon('Undo2', 18)}
        </ToolbarButton>
        <ToolbarButton
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        >
          {renderIcon('Redo2', 18)}
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarDivider />

      {/* Selection Controls */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete Selected (Del / Backspace)"
        >
          {renderIcon('Trash2', 18)}
        </ToolbarButton>
        <ToolbarButton
          onClick={onAlignHorizontal}
          disabled={!hasSelection}
          title="Align Horizontally"
        >
          {renderIcon('AlignHorizontalDistributeCenter', 18)}
        </ToolbarButton>
        <ToolbarButton
          onClick={onAlignVertical}
          disabled={!hasSelection}
          title="Align Vertically"
        >
          {renderIcon('AlignVerticalDistributeCenter', 18)}
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarDivider />

      {/* View Options */}
      <ToolbarGroup>
        <ToolbarButton
          onClick={onToggleGrid}
          active={gridEnabled}
          title="Toggle Grid (G)"
        >
          {renderIcon('Grid', 18)}
        </ToolbarButton>
        <ToolbarButton
          onClick={onToggleMinimap}
          active={minimapEnabled}
          title="Toggle Minimap (M)"
        >
          {renderIcon('Layers', 18)}
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarDivider />

      {/* File Operations */}
      <ToolbarGroup>
        <ToolbarButton onClick={onExport} title="Export Flow (JSON)">
          {renderIcon('Download', 18)}
        </ToolbarButton>
        <ToolbarButton onClick={() => document.getElementById('flow-import')?.click()} title="Import Flow (JSON)">
          {renderIcon('Upload', 18)}
        </ToolbarButton>
        <input
          id="flow-import"
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </ToolbarGroup>

      <ToolbarDivider />

      {/* Validation Status */}
      {validationErrors > 0 && (
        <ToolbarGroup>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-danger-500/15 text-danger-500 border border-danger-500/30"
            title={`${validationErrors} validation error(s)`}
          >
            {renderIcon('AlertCircle', 14)}
            <span className="text-xs font-medium">{validationErrors}</span>
          </button>
        </ToolbarGroup>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Side */}
      <ToolbarGroup>
        <ToolbarButton onClick={onShowHelp} title="Keyboard Shortcuts (?)">
          {renderIcon('HelpCircle', 18)}
        </ToolbarButton>
        <ToolbarButton onClick={onOpenSettings} title="Settings">
          {renderIcon('Settings', 18)}
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  );
});

// ============================================
// Keyboard Shortcuts Modal
// ============================================

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal = memo(function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: ['Space'], action: 'Pan canvas (hold + drag)' },
      { keys: ['Shift', '1'], action: 'Fit view' },
      { keys: ['Home'], action: 'Center view' },
      { keys: ['+', '='], action: 'Zoom in' },
      { keys: ['-'], action: 'Zoom out' },
      { keys: ['G'], action: 'Toggle grid' },
      { keys: ['M'], action: 'Toggle minimap' },
    ]},
    { category: 'Editing', items: [
      { keys: ['Ctrl', 'Z'], action: 'Undo' },
      { keys: ['Ctrl', 'Y'], action: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo (alternative)' },
      { keys: ['Del', 'Backspace'], action: 'Delete selected' },
      { keys: ['Ctrl', 'D'], action: 'Duplicate selected' },
      { keys: ['Ctrl', 'A'], action: 'Select all' },
      { keys: ['Escape'], action: 'Clear selection' },
    ]},
    { category: 'Nodes', items: [
      { keys: ['Double-click'], action: 'Add node at position' },
      { keys: ['Right-click'], action: 'Context menu' },
      { keys: ['Drag from palette'], action: 'Add node' },
      { keys: ['Drag handle'], action: 'Create connection' },
    ]},
    { category: 'File', items: [
      { keys: ['Ctrl', 'S'], action: 'Save flow' },
      { keys: ['Ctrl', 'E'], action: 'Export flow' },
      { keys: ['Ctrl', 'I'], action: 'Import flow' },
    ]},
  ];

  const Key = ({ k }: { k: string }) => (
    <kbd className="px-2 py-0.5 bg-surface-tertiary rounded text-text-primary font-mono text-xs border border-surface-border">
      {k}
    </kbd>
  );

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div className="modal-content max-w-2xl w-full mx-4 max-h-[80vh]">
        <div className="modal-header">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" aria-label="Close">
            {renderIcon('X', 20)}
          </button>
        </div>
        <div className="modal-body">
          {shortcuts.map((category) => (
            <div key={category.category} className="mb-6">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">{category.category}</h3>
              <div className="space-y-2">
                {category.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {item.keys.map((k, ki) => (
                        <Key key={ki} k={k} />
                      ))}
                    </div>
                    <span className="text-sm text-text-secondary">{item.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});