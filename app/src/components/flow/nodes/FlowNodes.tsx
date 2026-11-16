/**
 * Nexora Bots - Flow Node Registry
 * React Flow node/edge type registries and helpers for the bot flow editor.
 * The components themselves live in FlowNodeComponents (fast-refresh friendly).
 */

import type { NodeTypes, EdgeTypes } from 'reactflow';
import { NODE_CATEGORIES } from '@/contracts/bots';
import type { NodeCategory, NodeDefinition, NodeType } from '@/contracts/bots';
import {
  TriggerNode,
  ActionNode,
  LogicNode,
  BaseNodeComponent,
  CustomEdge,
} from './FlowNodeComponents';

// ============================================
// Node Types Registry
// ============================================

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
  // Default fallback
  default: BaseNodeComponent,
  // Per-type aliases so specific definition types resolve to their category component
  ...(Object.fromEntries(
    (Object.keys(NODE_CATEGORIES) as NodeType[]).map((type) => [
      type,
      NODE_CATEGORIES[type] === 'trigger'
        ? TriggerNode
        : NODE_CATEGORIES[type] === 'action'
          ? ActionNode
          : LogicNode,
    ]),
  ) as NodeTypes),
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
