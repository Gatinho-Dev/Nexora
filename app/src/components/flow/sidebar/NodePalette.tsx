/**
 * Nexora Bots - Node Palette
 * Left sidebar with draggable node categories and nodes
 */

import React, { memo, useState, useCallback } from 'react';
import { NodeDefinition, NodeCategory, nodeCategories, allNodeDefinitions } from '@/types/bots';
import { renderIcon } from '@/components/flow/nodes/FlowNodes';

// ============================================
// Category Section
// ============================================

interface CategorySectionProps {
  category: NodeCategory;
  nodes: NodeDefinition[];
  isOpen: boolean;
  onToggle: () => void;
  searchQuery: string;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, nodeDef: NodeDefinition) => void;
}

const CategorySection = memo(function CategorySection({
  category,
  nodes,
  isOpen,
  onToggle,
  searchQuery,
  onDragStart,
}: CategorySectionProps) {
  const categoryMeta: Record<NodeCategory, { icon: string; label: string; color: string; description: string }> = {
    trigger: { icon: 'Zap', label: 'Triggers', color: '#3ba55c', description: 'Events that start a flow' },
    action: { icon: 'Send', label: 'Actions', color: '#5865f2', description: 'Operations that perform tasks' },
    logic: { icon: 'GitBranch', label: 'Logic', color: '#faa61a', description: 'Flow control and branching' },
  };

  const meta = categoryMeta[category];

  // Filter nodes based on search
  const filteredNodes = nodes.filter(
    (node) =>
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredNodes.length === 0 && searchQuery) {
    return null;
  }

  return (
    <div className="border-b border-surface-border last:border-0">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-tertiary/50 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div
          className="flex-shrink-0 p-1.5 rounded-lg"
          style={{ background: `${meta.color}20`, color: meta.color }}
        >
          {renderIcon(meta.icon, 18, meta.color)}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-medium text-text-primary truncate">{meta.label}</h3>
          <p className="text-xs text-text-tertiary truncate">{filteredNodes.length} nodes</p>
        </div>
        {isOpen ? renderIcon('ChevronUp', 16, 'var(--color-text-tertiary)') : renderIcon('ChevronDown', 16, 'var(--color-text-tertiary)')}
      </button>

      {/* Category Nodes */}
      {isOpen && (
        <div className="px-3 pb-2 space-y-1 animate-slide-down">
          {filteredNodes.map((node) => (
            <DraggableNodeItem
              key={node.type}
              node={node}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================
// Draggable Node Item
// ============================================

interface DraggableNodeItemProps {
  node: NodeDefinition;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, nodeDef: NodeDefinition) => void;
}

const DraggableNodeItem = memo(function DraggableNodeItem({
  node,
  onDragStart,
}: DraggableNodeItemProps) {
  const categoryColors: Record<NodeCategory, string> = {
    trigger: '#3ba55c',
    action: '#5865f2',
    logic: '#faa61a',
  };

  const color = categoryColors[node.category];

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Set drag data
      e.dataTransfer.setData('application/json', JSON.stringify(node));
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart(e, node);
    },
    [node, onDragStart]
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors cursor-grab active:cursor-grabbing"
      role="button"
      tabIndex={0}
      aria-label={`Add ${node.label} node`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Could trigger a "add node at center" action
        }
      }}
    >
      <div
        className="flex-shrink-0 p-1.5 rounded-lg"
        style={{ background: `${color}20`, color: color }}
      >
        {renderIcon(node.icon, 16, color)}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="font-medium text-sm text-text-primary truncate">{node.label}</p>
        <p className="text-xs text-text-tertiary truncate">{node.description}</p>
      </div>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary">
        →
      </span>
    </div>
  );
});

// ============================================
// Search Input
// ============================================

const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Search nodes...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative p-3 border-b border-surface-border">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-tertiary)' }}>
          {renderIcon('Search', 16)}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input input-sm pl-9 pr-3"
          autoFocus
        />
      </div>
    </div>
  );
});

// ============================================
// Node Palette
// ============================================

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent<HTMLDivElement>, nodeDef: NodeDefinition) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  categories?: typeof nodeCategories;
}

export const NodePalette = memo(function NodePalette({
  onDragStart,
  searchQuery = '',
  onSearchChange,
  categories = nodeCategories,
}: NodePaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<NodeCategory, boolean>>({
    trigger: true,
    action: true,
    logic: true,
  });

  const toggleCategory = useCallback((category: NodeCategory) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      onSearchChange?.(value);
      // Auto-expand categories that have matches
      if (value) {
        const newExpanded: Record<NodeCategory, boolean> = { trigger: false, action: false, logic: false };
        allNodeDefinitions.forEach((node) => {
          if (
            node.label.toLowerCase().includes(value.toLowerCase()) ||
            node.description.toLowerCase().includes(value.toLowerCase())
          ) {
            newExpanded[node.category] = true;
          }
        });
        setExpandedCategories(newExpanded);
      } else {
        setExpandedCategories({ trigger: true, action: true, logic: true });
      }
    },
    [onSearchChange]
  );

  return (
    <div className="flex flex-col h-full bg-surface-secondary border-r border-surface-border overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-surface-border">
        <h2 className="font-medium text-text-primary">Nodes</h2>
        <p className="text-xs text-text-tertiary mt-0.5">Drag nodes to canvas</p>
      </div>

      {/* Search */}
      {onSearchChange && (
        <SearchInput value={searchQuery} onChange={handleSearchChange} />
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category.id as NodeCategory}
            nodes={category.nodes}
            isOpen={expandedCategories[category.id as NodeCategory]}
            onToggle={() => toggleCategory(category.id as NodeCategory)}
            searchQuery={searchQuery}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-surface-border">
        <div className="text-xs text-text-tertiary text-center">
          <kbd className="px-1.5 py-0.5 bg-surface-tertiary rounded text-text-secondary font-mono">
            Double-click canvas
          </kbd>
          <span className="mx-2">or</span>
          <kbd className="px-1.5 py-0.5 bg-surface-tertiary rounded text-text-secondary font-mono">
            Right-click
          </kbd>
          <span> to add nodes</span>
        </div>
      </div>
    </div>
  );
});