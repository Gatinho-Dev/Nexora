/**
 * Nexora Bots - Flow Node Components
 * Custom React Flow node components for triggers, actions, and logic
 */

import React, { memo, useCallback } from 'react';
import {
  Handle,
  Position,
  NodeProps,
  NodeTypes,
  EdgeTypes,
  ConnectionLineType,
  Edge,
  EdgeProps,
  MarkerType,
  useReactFlow,
} from 'reactflow';
import { LucideIcon } from 'lucide-react';
import { NodeDefinition, FlowNode, FlowEdge, NodeCategory } from '@/contracts/bots';

// ============================================
// Icon Map
// ============================================

const iconMap: Record<string, LucideIcon> = {};

// We'll use inline SVG icons instead to avoid lucide dependency
export const renderIcon = (name: string, size: number = 16, color: string = 'currentColor') => {
  const icons: Record<string, JSX.Element> = {
    MessageSquare: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
    UserPlus: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <line x1="19" y1="8" x2="19" y2="14"></line>
        <line x1="22" y1="11" x2="16" y2="11"></line>
      </svg>
    ),
    Slash: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    ),
    Clock: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    Webhook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.5 8c2.5 0 2.5 2 0 2"></path>
        <path d="M21 12c0 2.5-2 2.5-2 5"></path>
        <path d="M3 12c0 2.5 2 2.5 2 5"></path>
        <path d="M10.5 16c2.5 0 2.5-2 0-2"></path>
        <path d="M12 13.5V6.5"></path>
      </svg>
    ),
    Heart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
    ),
    Mic: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
      </svg>
    ),
    Hash: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    ),
    UserCog: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"></circle>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M10 15H6a4 4 0 0 0-4 4v2"></path>
        <path d="M21.7 19.3a2.5 2.5 0 0 1 0 3.5"></path>
        <path d="M19.8 15.7a2.5 2.5 0 0 1 3.3 2.3"></path>
        <path d="M15.7 13.8a2.5 2.5 0 0 1 2.3 3.3"></path>
        <path d="M13.8 19.8a2.5 2.5 0 0 1-2.3 3.3"></path>
        <path d="M15.7 21.7a2.5 2.5 0 0 1-3.3 2.3"></path>
        <path d="M19.8 23.6a2.5 2.5 0 0 1-3.5 0"></path>
        <path d="M21.7 15.7a2.5 2.5 0 0 1-2.3-3.3"></path>
      </svg>
    ),
    MessageSquareDiff: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        <line x1="8" y1="10" x2="16" y2="10"></line>
        <line x1="8" y1="14" x2="16" y2="14"></line>
      </svg>
    ),
    Trash2: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    ),
    Send: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    ),
    FileText: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    UserCheck: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <polyline points="17 11 19 13 22 10"></polyline>
      </svg>
    ),
    UserX: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="17" y1="11" x2="19" y2="13"></line>
        <line x1="17" y1="13" x2="19" y2="11"></line>
      </svg>
    ),
    ClockAlert: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
        <line x1="12" y1="18" x2="12.01" y2="18"></line>
      </svg>
    ),
    UserMinus: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="17" y1="11" x2="22" y2="11"></line>
      </svg>
    ),
    Ban: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
      </svg>
    ),
    PlusSquare: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="12" y1="8" x2="12" y2="16"></line>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    ),
    MinusSquare: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="8" y1="12" x2="16" y2="12"></line>
      </svg>
    ),
    Mail: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"></rect>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
      </svg>
    ),
    Globe: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    ),
    Terminal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    ),
    Timer: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="14" x2="10" y2="20"></line>
        <line x1="14" y1="10" x2="14" y2="20"></line>
        <line x1="18" y1="6" x2="18" y2="20"></line>
      </svg>
    ),
    GitBranch: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15"></line>
        <circle cx="18" cy="6" r="3"></circle>
        <circle cx="6" cy="18" r="3"></circle>
        <path d="M18 9a9 9 0 0 1-9 9"></path>
      </svg>
    ),
    Zap: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    ),
    SwitchCamera: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11"></path>
        <circle cx="13" cy="15" r="2"></circle>
      </svg>
    ),
    Code2: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    ),
    Settings: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    ),
    ChevronDown: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    ),
    ChevronUp: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    ),
    X: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    ),
    Check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    ),
    AlertCircle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    ),
    Info: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
  };

  return icons[name] || icons.MessageSquare;
};

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

const CustomHandle = memo(function CustomHandle({
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

interface BaseNodeComponentProps extends NodeProps<FlowNode> {
  definition: NodeDefinition;
}

const BaseNodeComponent = memo(function BaseNodeComponent({
  data,
  selected,
  definition,
}: BaseNodeComponentProps) {
  const { label, category, error } = data;
  const isError = !!error;

  const categoryStyles: Record<NodeCategory, { bg: string; border: string; text: string }> = {
    trigger: { bg: 'var(--color-node-trigger-bg)', border: 'var(--color-node-trigger-border)', text: 'var(--color-node-trigger-text)' },
    action: { bg: 'var(--color-node-action-bg)', border: 'var(--color-node-action-border)', text: 'var(--color-node-action-text)' },
    logic: { bg: 'var(--color-node-logic-bg)', border: 'var(--color-node-logic-border)', text: 'var(--color-node-logic-text)' },
  };

  const styles = categoryStyles[category] || categoryStyles.trigger;

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
      data-testid={`node-${definition.type}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 p-1.5 rounded-lg"
          style={{ background: `${styles.border}20`, color: styles.border }}
        >
          {renderIcon(definition.icon, 18, styles.border)}
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
            {definition.label}
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
});

// ============================================
// Trigger Node
// ============================================

const TriggerNode = memo(function TriggerNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const outputs = data.outputs || [];

  return (
    <>
      {/* Source handles (right side) */}
      {outputs.map((output, index) => (
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
});

// ============================================
// Action Node
// ============================================

const ActionNode = memo(function ActionNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const inputs = data.inputs || [];
  const outputs = data.outputs || [];

  return (
    <>
      {/* Target handles (left side) */}
      {inputs.map((input, index) => (
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
      {outputs.map((output, index) => (
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
});

// ============================================
// Logic Node
// ============================================

const LogicNode = memo(function LogicNode(props: BaseNodeComponentProps) {
  const { data } = props;
  const inputs = data.inputs || [];
  const outputs = data.outputs || [];

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
});

// ============================================
// Custom Edge Component
// ============================================

const CustomEdge = memo(function CustomEdge(props: EdgeProps<FlowEdge>) {
  const { data, selected, connectionLineType = 'smoothstep' } = props;
  const { animated = false, label } = data;

  const [sourceX, sourceY, targetX, targetY] = useReactFlow().getConnectionPosition?.() || [0, 0, 0, 0];

  const strokeColor = selected
    ? 'var(--color-primary-500)'
    : animated
    ? 'var(--color-primary-500)'
    : 'var(--color-surface-border-strong)';

  const strokeWidth = selected || animated ? 2 : 1.5;

  return (
    <>
      <Connection
        connectionLineType={connectionLineType}
        strokeWidth={strokeWidth}
        stroke={strokeColor}
        strokeDasharray={animated ? '5 5' : 'none'}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          pointerEvents: 'none',
          filter: animated ? 'drop-shadow(0 0 4px var(--color-primary-500))' : 'none',
        }}
      />
      {label && (
        <div
          className="absolute pointer-events-none"
          style={{
            transform: 'translate(-50%, -50%)',
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
      )}
    </>
  );
});

// ============================================
// Node Types Registry
// ============================================

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
  // Default fallback
  default: BaseNodeComponent,
};

export const edgeTypes: EdgeTypes = {
  default: CustomEdge,
  smoothstep: CustomEdge,
  straight: CustomEdge,
  step: CustomEdge,
  bezier: CustomEdge,
};

// ============================================
// Helper to get node component type
// ============================================

export function getNodeComponentType(category: NodeCategory): keyof NodeTypes {
  switch (category) {
    case 'trigger':
      return 'trigger';
    case 'action':
      return 'action';
    case 'logic':
      return 'logic';
    default:
      return 'default';
  }
}

export function getNodeTypeFromDefinition(definition: NodeDefinition): keyof NodeTypes {
  return getNodeComponentType(definition.category);
}