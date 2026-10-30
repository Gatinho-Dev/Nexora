/**
 * Nexora Bots - NodeConfigSidebar Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NodeConfigSidebar } from './NodeConfigSidebar';
import { FlowNode, NodeDefinition, allNodeDefinitions, getNodeDefinition } from '@/types/bots';
import { useState } from 'react';

const meta: Meta<typeof NodeConfigSidebar> = {
  title: 'Flow/NodeConfigSidebar',
  component: NodeConfigSidebar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    node: { control: 'object' },
    nodeDefinition: { control: 'object' },
    onUpdate: { action: 'update' },
    onClose: { action: 'close' },
    onDeleteNode: { action: 'deleteNode' },
    onDuplicateNode: { action: 'duplicateNode' },
    validationErrors: { control: 'object' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '360px', height: '600px', minWidth: '360px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample trigger node
const triggerNode: FlowNode = {
  id: 'trigger-message-1',
  type: 'trigger',
  position: { x: 100, y: 200 },
  data: {
    label: 'Message Created',
    category: 'trigger',
    triggerType: 'message_create',
    config: {
      channelIds: [],
      keyword: 'hello',
      regex: '',
      ignoreBots: true,
      ignoreSelf: true,
    },
    outputs: [
      { id: 'execution', name: 'Execution', type: 'execution', description: 'Triggers next node' },
    ],
  },
};

const triggerDef = getNodeDefinition('message_create')!;

// Sample action node
const actionNode: FlowNode = {
  id: 'action-send-1',
  type: 'action',
  position: { x: 400, y: 200 },
  data: {
    label: 'Send Message',
    category: 'action',
    actionType: 'send_message',
    config: {
      channelId: '',
      content: 'Hello {user}! Welcome to the server!',
      embeds: [],
      replyToMessageId: '',
    },
    inputs: [
      { id: 'execution', name: 'Execution', type: 'execution', required: true },
    ],
    outputs: [
      { id: 'execution', name: 'Execution', type: 'execution', description: 'Continues flow' },
    ],
  },
};

const actionDef = getNodeDefinition('send_message')!;

// Sample logic node
const logicNode: FlowNode = {
  id: 'logic-condition-1',
  type: 'logic',
  position: { x: 700, y: 200 },
  data: {
    label: 'Condition',
    category: 'logic',
    logicType: 'condition',
    config: {
      expression: 'event.message.content.includes("spam")',
      trueLabel: 'Is Spam',
      falseLabel: 'Not Spam',
    },
    inputs: [
      { id: 'execution', name: 'Execution', type: 'execution', required: true },
    ],
    outputs: [
      { id: 'true', name: 'True', type: 'execution', description: 'If condition is true' },
      { id: 'false', name: 'False', type: 'execution', description: 'If condition is false' },
    ],
  },
};

const logicDef = getNodeDefinition('condition')!;

// Webhook action with more fields
const webhookNode: FlowNode = {
  id: 'action-webhook-1',
  type: 'action',
  position: { x: 400, y: 200 },
  data: {
    label: 'Webhook Call',
    category: 'action',
    actionType: 'webhook_call',
    config: {
      url: 'https://api.example.com/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
      body: { event: 'message', content: '{event.message.content}' },
    },
    inputs: [
      { id: 'execution', name: 'Execution', type: 'execution', required: true },
    ],
    outputs: [
      { id: 'execution', name: 'Execution', type: 'execution', description: 'Continues flow' },
      { id: 'response', name: 'Response', type: 'object', description: 'HTTP response data' },
    ],
  },
};

const webhookDef = getNodeDefinition('webhook_call')!;

// Run code node
const codeNode: FlowNode = {
  id: 'action-code-1',
  type: 'action',
  position: { x: 400, y: 200 },
  data: {
    label: 'Run Code',
    category: 'action',
    actionType: 'run_code',
    config: {
      code: 'const response = await fetch("https://api.example.com/data");\nconst data = await response.json();\nreturn { items: data.items };',
      timeout: 5000,
    },
    inputs: [
      { id: 'execution', name: 'Execution', type: 'execution', required: true },
    ],
    outputs: [
      { id: 'execution', name: 'Execution', type: 'execution', description: 'Continues flow' },
      { id: 'result', name: 'Result', type: 'object', description: 'Code execution result' },
    ],
  },
};

const codeDef = getNodeDefinition('run_code')!;

export const TriggerNode: Story = {
  args: {
    node: triggerNode,
    nodeDefinition: triggerDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {},
  },
};

export const ActionNode: Story = {
  args: {
    node: actionNode,
    nodeDefinition: actionDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {},
  },
};

export const LogicNode: Story = {
  args: {
    node: logicNode,
    nodeDefinition: logicDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {},
  },
};

export const WebhookNode: Story = {
  args: {
    node: webhookNode,
    nodeDefinition: webhookDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {},
  },
};

export const CodeNode: Story = {
  args: {
    node: codeNode,
    nodeDefinition: codeDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {},
  },
};

export const WithValidationErrors: Story = {
  args: {
    node: {
      ...actionNode,
      data: {
        ...actionNode.data,
        config: {
          ...actionNode.data.config,
          content: '', // Missing required field
        },
      },
    },
    nodeDefinition: actionDef,
    onUpdate: (id, config) => console.log('Update node:', id, config),
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: (id) => console.log('Delete node:', id),
    onDuplicateNode: (id) => console.log('Duplicate node:', id),
    validationErrors: {
      'node.action-send-1.content': 'Message content is required',
      'node.action-send-1.channelId': 'Channel is required',
    },
  },
};

export const NoSelection: Story = {
  args: {
    node: null,
    nodeDefinition: null,
    onUpdate: () => {},
    onClose: () => console.log('Close sidebar'),
    onDeleteNode: () => {},
    onDuplicateNode: () => {},
    validationErrors: {},
  },
};

// Interactive demo
export const Interactive: Story = {
  render: () => {
    const [selectedNode, setSelectedNode] = useState<FlowNode | null>(triggerNode);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const nodes = [triggerNode, actionNode, logicNode, webhookNode, codeNode];
    const defs = nodes.map((n) => getNodeDefinition(n.type as any)!);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px' }}>
        <div style={{ padding: '16px', background: '#25272b', borderRadius: '8px' }}>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#b9bbbe', fontWeight: 500 }}>
            Select a node to inspect:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {nodes.map((node, i) => (
              <button
                key={node.id}
                onClick={() => {
                  setSelectedNode(node);
                  setErrors({});
                }}
                style={{
                  padding: '8px 12px',
                  background: selectedNode?.id === node.id ? '#5865f2' : '#2f3136',
                  border: '1px solid #3e4147',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                {node.data.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setErrors({
                'node.trigger-message-1.keyword': 'Keyword is required',
                'node.trigger-message-1.channelIds': 'At least one channel required',
              })}
              style={{ padding: '6px 12px', background: '#ed4245', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
            >
              Add Errors
            </button>
            <button
              onClick={() => setErrors({})}
              style={{ padding: '6px 12px', background: '#3ba55c', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
            >
              Clear Errors
            </button>
          </div>
        </div>

        <NodeConfigSidebar
          node={selectedNode}
          nodeDefinition={selectedNode ? getNodeDefinition(selectedNode.type as any)! : null}
          onUpdate={(id, config) => console.log('Update:', id, config)}
          onClose={() => console.log('Close')}
          onDeleteNode={(id) => console.log('Delete:', id)}
          onDuplicateNode={(id) => console.log('Duplicate:', id)}
          validationErrors={errors}
        />
      </div>
    );
  },
};