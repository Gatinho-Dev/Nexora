/**
 * Nexora Bots - BotFlowEditor Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BotFlowEditor } from './BotFlowEditor';
import { BotFlow, FlowNode, FlowEdge, Viewport, allNodeDefinitions } from '@/types/bots';
import { useState } from 'react';

const meta: Meta<typeof BotFlowEditor> = {
  title: 'Flow/BotFlowEditor',
  component: BotFlowEditor,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  tags: ['autodocs'],
  argTypes: {
    initialFlow: { control: 'object' },
    readOnly: { control: 'boolean' },
    onChange: { action: 'change' },
    onValidate: { action: 'validate' },
    availableNodes: { control: 'object' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '600px', minWidth: '800px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample flow with a few nodes
const sampleFlow: BotFlow = {
  version: 1,
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Message Created',
        category: 'trigger',
        triggerType: 'message_create',
        config: { keyword: 'hello' },
        outputs: [
          { id: 'execution', name: 'Execution', type: 'execution', description: 'Triggers next node' },
        ],
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 400, y: 150 },
      data: {
        label: 'Send Message',
        category: 'action',
        actionType: 'send_message',
        config: { content: 'Hello there! 👋' },
        inputs: [
          { id: 'execution', name: 'Execution', type: 'execution', required: true },
        ],
        outputs: [
          { id: 'execution', name: 'Execution', type: 'execution', description: 'Continues flow' },
        ],
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 400, y: 300 },
      data: {
        label: 'Add Role',
        category: 'action',
        actionType: 'add_role',
        config: { roleId: 'role-123' },
        inputs: [
          { id: 'execution', name: 'Execution', type: 'execution', required: true },
        ],
        outputs: [
          { id: 'execution', name: 'Execution', type: 'execution', description: 'Continues flow' },
        ],
      },
    },
    {
      id: 'logic-1',
      type: 'logic',
      position: { x: 700, y: 200 },
      data: {
        label: 'Condition',
        category: 'logic',
        logicType: 'condition',
        config: { expression: 'event.message.content.includes("bot")' },
        inputs: [
          { id: 'execution', name: 'Execution', type: 'execution', required: true },
        ],
        outputs: [
          { id: 'true', name: 'True', type: 'execution', description: 'If condition is true' },
          { id: 'false', name: 'False', type: 'execution', description: 'If condition is false' },
        ],
      },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'trigger-1',
      target: 'action-1',
      sourceHandle: 'execution',
      targetHandle: 'execution',
      type: 'smoothstep',
      animated: false,
      markerEnd: 'arrowclosed',
    },
    {
      id: 'edge-2',
      source: 'trigger-1',
      target: 'action-2',
      sourceHandle: 'execution',
      targetHandle: 'execution',
      type: 'smoothstep',
      animated: false,
      markerEnd: 'arrowclosed',
    },
    {
      id: 'edge-3',
      source: 'action-1',
      target: 'logic-1',
      sourceHandle: 'execution',
      targetHandle: 'execution',
      type: 'smoothstep',
      animated: true,
      markerEnd: 'arrowclosed',
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export const Default: Story = {
  args: {
    initialFlow: sampleFlow,
    readOnly: false,
    onChange: (flow) => console.log('Flow changed:', flow.nodes.length, 'nodes'),
    onValidate: (errors) => console.log('Validation:', errors.length, 'errors'),
    availableNodes: allNodeDefinitions,
  },
};

export const Empty: Story = {
  args: {
    initialFlow: null,
    readOnly: false,
    onChange: (flow) => console.log('Flow changed:', flow.nodes.length, 'nodes'),
    onValidate: (errors) => console.log('Validation:', errors.length, 'errors'),
    availableNodes: allNodeDefinitions,
  },
};

export const ReadOnly: Story = {
  args: {
    initialFlow: sampleFlow,
    readOnly: true,
    onChange: (flow) => console.log('Flow changed:', flow.nodes.length, 'nodes'),
    onValidate: (errors) => console.log('Validation:', errors.length, 'errors'),
    availableNodes: allNodeDefinitions,
  },
};

export const ComplexFlow: Story = {
  args: {
    initialFlow: {
      version: 1,
      nodes: [
        {
          id: 'scheduled-1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Daily at 9 AM',
            category: 'trigger',
            triggerType: 'scheduled',
            config: { cronExpression: '0 9 * * *', timezone: 'UTC' },
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
          },
        },
        {
          id: 'code-1',
          type: 'action',
          position: { x: 400, y: 50 },
          data: {
            label: 'Fetch Data',
            category: 'action',
            actionType: 'run_code',
            config: { code: 'const data = await fetch("https://api.example.com/data");\nreturn data.json();' },
            inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }, { id: 'result', name: 'Result', type: 'object' }],
          },
        },
        {
          id: 'condition-1',
          type: 'logic',
          position: { x: 700, y: 50 },
          data: {
            label: 'Has Updates?',
            category: 'logic',
            logicType: 'condition',
            config: { expression: 'vars.result.updates.length > 0' },
            inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
            outputs: [
              { id: 'true', name: 'Yes', type: 'execution' },
              { id: 'false', name: 'No', type: 'execution' },
            ],
          },
        },
        {
          id: 'send-1',
          type: 'action',
          position: { x: 1000, y: 0 },
          data: {
            label: 'Send Update',
            category: 'action',
            actionType: 'send_message',
            config: { channelId: 'channel-123', content: 'New updates available!' },
            inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
          },
        },
        {
          id: 'log-1',
          type: 'action',
          position: { x: 1000, y: 100 },
          data: {
            label: 'Log Check',
            category: 'action',
            actionType: 'log_audit',
            config: { action: 'daily_check', details: { updates: 0 } },
            inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'scheduled-1', target: 'code-1', type: 'smoothstep', markerEnd: 'arrowclosed' },
        { id: 'e2', source: 'code-1', target: 'condition-1', type: 'smoothstep', markerEnd: 'arrowclosed' },
        { id: 'e3', source: 'condition-1', target: 'send-1', sourceHandle: 'true', type: 'smoothstep', markerEnd: 'arrowclosed' },
        { id: 'e4', source: 'condition-1', target: 'log-1', sourceHandle: 'false', type: 'smoothstep', markerEnd: 'arrowclosed' },
      ],
      viewport: { x: -200, y: -100, zoom: 0.8 },
    },
    readOnly: false,
    onChange: (flow) => console.log('Flow changed:', flow.nodes.length, 'nodes'),
    onValidate: (errors) => console.log('Validation:', errors.length, 'errors'),
    availableNodes: allNodeDefinitions,
  },
};

export const WithValidationErrors: Story = {
  args: {
    initialFlow: {
      version: 1,
      nodes: [
        {
          id: 'trigger-bad',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: {
            label: 'Message Created',
            category: 'trigger',
            triggerType: 'message_create',
            config: {},
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
          },
        },
        {
          id: 'action-bad',
          type: 'action',
          position: { x: 400, y: 200 },
          data: {
            label: 'Send Message',
            category: 'action',
            actionType: 'send_message',
            config: { content: '' }, // Missing required content
            inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
            outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    readOnly: false,
    onChange: (flow) => console.log('Flow changed'),
    onValidate: (errors) => console.log('Validation errors:', errors),
    availableNodes: allNodeDefinitions,
  },
};

// Interactive wrapper for controlling the editor
export const Interactive: Story = {
  render: () => {
    const [flow, setFlow] = useState<BotFlow | null>(sampleFlow);
    const [errors, setErrors] = useState<any[]>([]);

    return (
      <div style={{ height: '600px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFlow(sampleFlow)}
            style={{ padding: '8px 16px', background: '#5865f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Load Sample
          </button>
          <button
            onClick={() => setFlow(null)}
            style={{ padding: '8px 16px', background: '#3e4147', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Clear
          </button>
          <button
            onClick={() => {
              const newFlow: BotFlow = {
                version: 1,
                nodes: [
                  ...(flow?.nodes || []),
                  {
                    id: `node-${Date.now()}`,
                    type: 'action',
                    position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 },
                    data: {
                      label: 'Send Message',
                      category: 'action',
                      actionType: 'send_message',
                      config: { content: 'New node!' },
                      inputs: [{ id: 'execution', name: 'Execution', type: 'execution', required: true }],
                      outputs: [{ id: 'execution', name: 'Execution', type: 'execution' }],
                    },
                  },
                ],
                edges: flow?.edges || [],
                viewport: flow?.viewport || { x: 0, y: 0, zoom: 1 },
              };
              setFlow(newFlow);
            }}
            style={{ padding: '8px 16px', background: '#3ba55c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Add Node
          </button>
          <span style={{ alignSelf: 'center', color: '#b9bbbe', fontSize: '14px' }}>
            Nodes: {flow?.nodes.length || 0} | Edges: {flow?.edges.length || 0} | Errors: {errors.length}
          </span>
        </div>
        <BotFlowEditor
          initialFlow={flow}
          onChange={setFlow}
          onValidate={setErrors}
          availableNodes={allNodeDefinitions}
        />
      </div>
    );
  },
};