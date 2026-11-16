/**
 * Nexora Bots - Flow Node Components
 * Custom React Flow node components for triggers, actions, and logic.
 * This file only exports components so React fast refresh keeps working.
 */

import { memo } from 'react';
import {
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from 'reactflow';
import type {
  NodeProps,
  EdgeProps,
} from 'reactflow';
import {
  NODE_CATEGORIES,
  getNodeDefinition,
} from '@/contracts/bots';
import type {
  NodeDefinition,
  NodeData,
  NodeType,
  NodeCategory,
} from '@/contracts/bots';
import { renderIcon } from './flowIcons';

// ============================================
// Handle Component
// ============================================

interface CustomHandleProps {
  id: string;
  type: 'source' | 'target';
  position: Position;
  nodeType: NodeCategory;
  isConnecting?: boolean;
  label?: string;
}

export const CustomHandle = memo(function CustomHandle({
  id,
  type,
  position,
  nodeType,
  isConnecting,
  label,
}: CustomHandleProps) {
  const handleColors: Record<NodeCategory, string> = {
    trigger: '#3ba55c',
    action: '#5865f2',
    logic: '#faa61a',
  };

  const color = handleColors[nodeType] || '#5865f2';

  return (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{
        width: 14,
        height: 14,
        background: isConnecting ? color : 'var(--color-surface-border-strong)',
        border: `2px solid var(--color-surface-secondary)`,
        borderRadius: '50%',
        transition: 'all 150ms ease',
        zIndex: 10,
      }}
      className={`handle-${type} handle-${position}`}
      aria-label={label || `${type} handle`}
    />
  );
});

// ============================================
// Base Node Component
// ============================================

interface BaseNodeComponentProps extends NodeProps<NodeData> {
  definition?: NodeDefinition;
}

export function BaseNodeComponent({
  data,
  selected,
  type,
  definition,
}: BaseNodeComponentProps) {
  const { label, category, error } = data;
  const isError = !!error;
  const resolvedDefinition =
    definition ??
    (typeof type === 'string' && type in NODE_CATEGORIES
      ? getNodeDefinition(type as NodeType)
      : undefined);

  const categoryStyles: Record<NodeCategory, { bg: string; border: string; text: string }> = {
    trigger: { bg: 'var(--color-node-trigger-bg)', border: 'var(--color-node-trigger-border)', text: 'var(--color-node-trigger-text)' },
    action: { bg: 'var(--color-node-action-bg)', border: 'var(--color-node-action-border)', text: 'var(--color-node-action-text)' },
    logic: { bg: 'var(--color-node-logic-bg)', border: 'var(--color-node-logic-border)', text: 'var(--color-node-logic-text)' },
  };

  const styles = categoryStyles[category];

  return (
    <div
      className={`react-flow__node ${selected ? 'selected' : ''} ${isError ? 'has-error' : ''} node-${category}`}
      style={{
        minWidth: 220,
        maxWidth: 280,
        background: styles.bg,
        border: `1.5px solid ${styles.border}`,
        borderRadius: '12px',
        padding: '12px',
        boxShadow: 'var(--shadow-md)',
        ...(selected && { boxShadow: 'var(--shadow-lg), 0 0 0 2px var(--color-surface-primary), 0 0 0 4px var(--color-primary-500)' }),
      }}
      data-testid={`node-${resolvedDefinition?.type ?? type ?? category}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 p-1.5 rounded-lg"
          style={{ background: `${styles.border}20`, color: styles.border }}
        >
          {renderIcon(resolvedDefinition?.icon ?? 'Settings', 18, styles.border)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-sm truncate"
              style={{ color: styles.text }}
            >
              {label}
            </span>
            {isError && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-danger-500/20 text-danger-500 border border-danger-500/30">
                Error
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
            {resolvedDefinition?.label ?? label}
          </p>
        </div>

        {/* Delete button on hover */}
        <button
          className="opacity-0 transition-opacity p-1 rounded hover:bg-surface-hover text-text-tertiary hover:text-danger-500"
          onClick={(e) => {
            e.stopPropagation();
            // Delete handled by parent
          }}
          aria-label="Delete node"
        >
          {renderIcon('X', 14)}
        </button>
      </div>

      {/* Error message */}
      {isError && (
        <div className="mt-3 p-2 rounded bg-danger-500/10 border border-danger-500/30 text-danger-500 text-xs">
          {error}
        </div>
      )}

      {/* Handles - rendered by React Flow */}
    </div>
  );
}

// ============================================
// Trigger Node
// ============================================

export function TriggerNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const outputs = data.category === 'trigger' ? (data.outputs ?? []) : [];

  return (
    <>
      {/* Source handles (right side) */}
      {outputs.map((output) => (
        <CustomHandle
          key={output.id}
          id={output.id}
          type="source"
          position={Position.Right}
          nodeType="trigger"
          label={output.name}
        />
      ))}
      <BaseNodeComponent {...props} />
    </>
  );
}

// ============================================
// Action Node
// ============================================

export function ActionNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const inputs = data.category === 'action' ? (data.inputs ?? []) : [];
  const outputs = data.category === 'action' ? (data.outputs ?? []) : [];

  return (
    <>
      {/* Target handles (left side) */}
      {inputs.map((input) => (
        <CustomHandle
          key={input.id}
          id={input.id}
          type="target"
          position={Position.Left}
          nodeType="action"
          label={input.name}
        />
      ))}

      <BaseNodeComponent {...props} />

      {/* Source handles (right side) */}
      {outputs.map((output) => (
        <CustomHandle
          key={output.id}
          id={output.id}
          type="source"
          position={Position.Right}
          nodeType="action"
          label={output.name}
        />
      ))}
    </>
  );
}

// ============================================
// Logic Node
// ============================================

export function LogicNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const inputs = data.category === 'logic' ? (data.inputs ?? []) : [];
  const outputs = data.category === 'logic' ? (data.outputs ?? []) : [];

  // For condition nodes, we want true/false handles on right
  // For parallel/switch, we want multiple outputs

  return (
    <>
      {/* Target handles (left side) */}
      {inputs.map((input) => (
        <CustomHandle
          key={input.id}
          id={input.id}
          type="target"
          position={Position.Left}
          nodeType="logic"
          label={input.name}
        />
      ))}

      <BaseNodeComponent {...props} />

      {/* Source handles (right side) - conditional rendering based on logic type */}
      {outputs.map((output) => (
        <CustomHandle
          key={output.id}
          id={output.id}
          type="source"
          position={Position.Right}
          nodeType="logic"
          label={output.name}
        />
      ))}
    </>
  );
}

// ============================================
// Custom Edge Component
// ============================================

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const animated = data?.animated ?? false;
  const label = data?.label;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = selected || animated
    ? 'var(--color-primary-500)'
    : 'var(--color-surface-border-strong)';

  const strokeWidth = selected || animated ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: animated ? '5 5' : 'none',
          filter: animated ? 'drop-shadow(0 0 4px var(--color-primary-500))' : 'none',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: '10px',
              color: 'var(--color-text-tertiary)',
              background: 'var(--color-surface-secondary)',
              padding: '1px 4px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
