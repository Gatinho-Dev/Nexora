/**
 * Nexora Bots - Bot Flow Editor
 * Main visual flow editor component using React Flow
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
} from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  getOutgoers,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Connection,
  NodeChange,
  EdgeChange,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes, edgeTypes } from '@/components/flow/nodes/FlowNodes';
import { NodePalette } from '@/components/flow/sidebar/NodePalette';
import { NodeConfigSidebar } from '@/components/flow/sidebar/NodeConfigSidebar';
import { FlowToolbar, KeyboardShortcutsModal } from '@/components/flow/toolbar/FlowToolbar';
import {
  getNodeDefinition,
  getSpecificNodeType,
  asTriggerNodeType,
  asActionNodeType,
  asLogicNodeType,
  allNodeDefinitions,
  nodeCategories,
} from '@/contracts/bots';
import type {
  BotFlow,
  FlowNode,
  FlowEdge,
  Viewport,
  NodeData,
  NodeDefinition,
  ValidationError,
  NodeCategory,
  TriggerConfig,
  ActionConfig,
  LogicConfig,
} from '@/contracts/bots';

// ============================================
// Editor-local types & converters
// ============================================

type EditorNode = Node<NodeData>;

function toEditorNode(node: FlowNode): EditorNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    ...(node.style ? { style: node.style } : null),
    ...(node.className ? { className: node.className } : null),
  };
}

function fromEditorNode(node: EditorNode): FlowNode {
  return {
    id: node.id,
    type: getSpecificNodeType(node.data),
    position: node.position,
    data: node.data,
  };
}

function toEditorEdge(edge: FlowEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type ?? 'smoothstep',
    animated: edge.animated,
    label: edge.label,
    labelStyle: edge.labelStyle,
    labelShowBg: edge.labelShowBg,
    labelBgStyle: edge.labelBgStyle,
    style: edge.style,
    markerEnd: edge.markerEnd as Edge['markerEnd'],
    data: { animated: edge.animated ?? false, label: edge.label },
  };
}

function fromEditorEdge(edge: Edge): FlowEdge {
  const animated = edge.animated ?? (edge.data?.animated as boolean | undefined);
  const label =
    (typeof edge.data?.label === 'string' ? edge.data.label : undefined) ?? edge.label;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: (edge.type as FlowEdge['type']) ?? 'smoothstep',
    animated,
    label,
    markerEnd:
      edge.markerEnd === MarkerType.ArrowClosed ? MarkerType.ArrowClosed : undefined,
  };
}

function buildNodeData(definition: NodeDefinition): NodeData {
  const base = {
    label: definition.label,
    description: definition.description,
    category: definition.category,
    icon: definition.icon,
    disabled: false,
  };
  switch (definition.category) {
    case 'trigger':
      return {
        ...base,
        category: 'trigger',
        triggerType: asTriggerNodeType(definition.type),
        config: {},
        outputs: definition.outputs,
      };
    case 'action':
      return {
        ...base,
        category: 'action',
        actionType: asActionNodeType(definition.type),
        config: {},
        inputs: definition.inputs,
        outputs: definition.outputs,
      };
    case 'logic':
      return {
        ...base,
        category: 'logic',
        logicType: asLogicNodeType(definition.type),
        config: {},
        inputs: definition.inputs,
        outputs: definition.outputs,
      };
  }
}

// ============================================
// Custom Hooks
// ============================================

function useHistory<T>(initialState: T, maxSize = 50) {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const push = useCallback((newState: T) => {
    setPast((prev) => [...prev.slice(-maxSize + 1), present]);
    setPresent(newState);
    setFuture([]);
  }, [present, maxSize]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((prev) => [present, ...prev]);
    setPresent(previous);
    setPast((prev) => prev.slice(0, -1));
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast((prev) => [...prev, present]);
    setPresent(next);
    setFuture((prev) => prev.slice(1));
  }, [future, present]);

  return { past, future, present, push, undo, redo, canUndo, canRedo };
}

// ============================================
// BotFlowEditor Component
// ============================================

interface BotFlowEditorProps {
  initialFlow?: BotFlow | null;
  readOnly?: boolean;
  onChange: (flow: BotFlow) => void;
  onValidate: (errors: ValidationError[]) => void;
  availableNodes?: NodeDefinition[];
}

export function BotFlowEditor({
  initialFlow,
  readOnly = false,
  onChange,
  onValidate,
  availableNodes = allNodeDefinitions,
}: BotFlowEditorProps) {
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(
    (initialFlow?.nodes ?? []).map(toEditorNode)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialFlow?.edges ?? []).map(toEditorEdge)
  );
  const [viewport, setViewport] = useState<Viewport>(
    initialFlow?.viewport ?? { x: 0, y: 0, zoom: 1 }
  );

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Palette categories derived from the available node definitions
  const paletteCategories = useMemo(() => {
    const available = new Set(availableNodes.map((n) => n.type));
    return nodeCategories
      .map((category) => ({
        ...category,
        nodes: category.nodes.filter((node) => available.has(node.type)),
      }))
      .filter((category) => category.nodes.length > 0);
  }, [availableNodes]);

  // History
  const history = useHistory({ nodes, edges });

  // React Flow instance
  const reactFlowInstance = useReactFlow();

  // ============================================
  // Validation
  // ============================================

  const validateFlow = useCallback(() => {
    const errors: ValidationError[] = [];

    // Check for nodes without connections (except triggers)
    nodes.forEach((node) => {
      const def = getNodeDefinition(getSpecificNodeType(node.data));
      if (!def) return;

      const incoming = edges.filter((e) => e.target === node.id);
      const outgoing = edges.filter((e) => e.source === node.id);

      // Triggers should have outgoing connections
      if (def.category === 'trigger' && outgoing.length === 0 && nodes.length > 1) {
        errors.push({
          field: `node.${node.id}`,
          message: 'Trigger node should have at least one outgoing connection',
          severity: 'warning',
        });
      }

      // Actions should have incoming connections
      if (def.category === 'action' && incoming.length === 0) {
        errors.push({
          field: `node.${node.id}`,
          message: 'Action node should have an incoming connection',
          severity: 'error',
        });
      }

      // Logic nodes validation
      if (def.category === 'logic') {
        if (getSpecificNodeType(node.data) === 'condition') {
          const trueEdges = edges.filter((e) => e.source === node.id && e.sourceHandle === 'true');
          const falseEdges = edges.filter((e) => e.source === node.id && e.sourceHandle === 'false');
          if (trueEdges.length === 0 && falseEdges.length === 0) {
            errors.push({
              field: `node.${node.id}`,
              message: 'Condition node should have true/false outputs connected',
              severity: 'warning',
            });
          }
        }
      }

      // Check for required config
      if (def.configSchema) {
        const config = (node.data.config ?? {}) as Record<string, unknown>;
        def.configSchema.forEach((field) => {
          if (field.required && (config[field.key] === undefined || config[field.key] === '')) {
            errors.push({
              field: `node.${node.id}.${field.key}`,
              message: `${field.label} is required`,
              severity: 'error',
            });
          }
        });
      }
    });

    // Check for cycles (simple detection)
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visiting.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      const outgoers = node ? getOutgoers(node, nodes, edges) : [];
      for (const outgoer of outgoers) {
        if (hasCycle(outgoer.id)) return true;
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
      return false;
    };

    nodes.forEach((node) => {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        errors.push({
          field: `flow.cycle`,
          message: 'Flow contains a cycle - this may cause infinite loops',
          severity: 'error',
        });
      }
    });

    setValidationErrors(errors);
    onValidate(errors);

    return errors;
  }, [nodes, edges, onValidate]);

  // Run validation on changes
  useEffect(() => {
    const timer = setTimeout(validateFlow, 300);
    return () => clearTimeout(timer);
  }, [nodes, edges, validateFlow]);

  // ============================================
  // History Management
  // ============================================

  const saveToHistory = useCallback(() => {
    history.push({ nodes, edges });
  }, [history, nodes, edges]);

  const handleUndo = useCallback(() => {
    history.undo();
    const { nodes: prevNodes, edges: prevEdges } = history.present;
    setNodes(prevNodes);
    setEdges(prevEdges);
    saveToHistory();
  }, [history, saveToHistory, setEdges, setNodes]);

  const handleRedo = useCallback(() => {
    history.redo();
    const { nodes: nextNodes, edges: nextEdges } = history.present;
    setNodes(nextNodes);
    setEdges(nextEdges);
    saveToHistory();
  }, [history, saveToHistory, setEdges, setNodes]);

  // ============================================
  // Node/Edge Handlers
  // ============================================

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const { source, target, sourceHandle, targetHandle } = params;

      // Prevent self-connections and incomplete connections
      if (!source || !target || source === target) return;

      // Check if connection already exists
      const exists = edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          e.sourceHandle === (sourceHandle ?? undefined) &&
          e.targetHandle === (targetHandle ?? undefined)
      );
      if (exists) return;

      const newEdge: Edge = {
        id: `edge-${source}-${target}-${sourceHandle}-${targetHandle}-${Date.now()}`,
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        targetHandle: targetHandle ?? undefined,
        type: 'smoothstep',
        animated: false,
        markerEnd: MarkerType.ArrowClosed,
        data: { animated: false },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      saveToHistory();
    },
    [edges, saveToHistory, setEdges]
  );

  const onNodesChangeHandler: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // Save to history for position changes
      const hasPositionChange = changes.some(
        (c) => c.type === 'position' && c.position
      );
      if (hasPositionChange) {
        saveToHistory();
      }
    },
    [onNodesChange, saveToHistory]
  );

  const onEdgesChangeHandler: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      saveToHistory();
    },
    [onEdgesChange, saveToHistory]
  );

  const onNodeClick = useCallback(
    (_event: ReactMouseEvent, node: EditorNode) => {
      setSelectedNodeId(node.id);
      setShowSidebar(true);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setShowSidebar(false);
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      if (selectedNodes.length > 0) {
        setSelectedNodeId(selectedNodes[0].id);
        setShowSidebar(true);
      } else if (selectedEdges.length > 0) {
        setSelectedNodeId(null);
        setShowSidebar(false);
      } else {
        setSelectedNodeId(null);
        setShowSidebar(false);
      }
    },
    []
  );

  // ============================================
  // Toolbar Actions
  // ============================================

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.1, duration: 300 });
  }, [reactFlowInstance]);

  const handleCenter = useCallback(() => {
    reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  }, [reactFlowInstance]);

  const clearSelection = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)));
  }, [setNodes]);

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    setShowSidebar(false);
    saveToHistory();
  }, [selectedNodeId, saveToHistory, setEdges, setNodes]);

  const handleAlignHorizontal = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length < 2) return;

    const avgY = selected.reduce((sum, n) => sum + n.position.y, 0) / selected.length;
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, position: { ...n.position, y: avgY } } : n
      )
    );
    saveToHistory();
  }, [nodes, saveToHistory, setNodes]);

  const handleAlignVertical = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length < 2) return;

    const avgX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length;
    setNodes((nds) =>
      nds.map((n) =>
        n.selected ? { ...n, position: { ...n.position, x: avgX } } : n
      )
    );
    saveToHistory();
  }, [nodes, saveToHistory, setNodes]);

  const handleExport = useCallback(() => {
    const flow: BotFlow = {
      version: 1,
      nodes: nodes.map(fromEditorNode),
      edges: edges.map(fromEditorEdge),
      viewport,
    };
    const blob = new Blob([JSON.stringify(flow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-flow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, viewport]);

  const handleImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const flow = JSON.parse(e.target?.result as string) as BotFlow;
          if (flow.nodes && flow.edges) {
            setNodes(flow.nodes.map(toEditorNode));
            setEdges(flow.edges.map(toEditorEdge));
            if (flow.viewport) setViewport(flow.viewport);
            saveToHistory();
            validateFlow();
          }
        } catch (err) {
          console.error('Failed to import flow:', err);
        }
      };
      reader.readAsText(file);
    },
    [saveToHistory, validateFlow, setEdges, setNodes]
  );

  const handleDragStart = useCallback(
    (event: ReactDragEvent, nodeDef: NodeDefinition) => {
      event.dataTransfer.setData('application/json', JSON.stringify(nodeDef));
      event.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  const onDrop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      try {
        const nodeDef = JSON.parse(event.dataTransfer.getData('application/json')) as NodeDefinition;
        const position = reactFlowInstance.project({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: EditorNode = {
          id: `${nodeDef.type}-${Date.now()}`,
          type: nodeDef.type,
          position,
          data: buildNodeData(nodeDef),
        };

        setNodes((nds) => [...nds, newNode]);
        saveToHistory();
      } catch (err) {
        console.error('Failed to add node from palette:', err);
      }
    },
    [reactFlowInstance, saveToHistory, setNodes]
  );

  const onDragOver = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // ============================================
  // Keyboard Shortcuts
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Shortcuts
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }

      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setSelectedNodeId(null);
        setShowSidebar(false);
        clearSelection();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          handleDelete();
        }
      }

      if (e.key === 'g') {
        e.preventDefault();
        setGridEnabled((prev) => !prev);
      }

      if (e.key === 'm') {
        e.preventDefault();
        setMinimapEnabled((prev) => !prev);
      }

      if (e.key === '1' && e.shiftKey) {
        e.preventDefault();
        handleFitView();
      }

      if (e.key === 'Home') {
        e.preventDefault();
        handleCenter();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    handleUndo,
    handleRedo,
    handleDelete,
    handleFitView,
    handleCenter,
    handleExport,
    clearSelection,
  ]);

  // ============================================
  // Notify Parent of Changes
  // ============================================

  useEffect(() => {
    const flow: BotFlow = {
      version: 1,
      nodes: nodes.map(fromEditorNode),
      edges: edges.map(fromEditorEdge),
      viewport,
    };
    onChange(flow);
  }, [nodes, edges, viewport, onChange]);

  // ============================================
  // Selected Node Definition
  // ============================================

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedNodeDef = selectedNode
    ? (getNodeDefinition(getSpecificNodeType(selectedNode.data)) ?? null)
    : null;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Toolbar */}
      {!readOnly && (
        <FlowToolbar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onCenter={handleCenter}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDelete={handleDelete}
          onAlignHorizontal={handleAlignHorizontal}
          onAlignVertical={handleAlignVertical}
          onExport={handleExport}
          onImport={handleImport}
          onToggleGrid={() => setGridEnabled((p) => !p)}
          onToggleMinimap={() => setMinimapEnabled((p) => !p)}
          onOpenSettings={() => {}}
          onShowHelp={() => setShowShortcuts(true)}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          hasSelection={!!selectedNodeId}
          zoom={viewport.zoom}
          gridEnabled={gridEnabled}
          minimapEnabled={minimapEnabled}
          validationErrors={validationErrors.filter((e) => e.severity === 'error').length}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Palette */}
        {!readOnly && (
          <div className="w-72 flex-shrink-0 transition-width duration-fast">
            <NodePalette
              onDragStart={handleDragStart}
              searchQuery=""
              onSearchChange={() => {}}
              categories={paletteCategories}
            />
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 relative"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeHandler}
            onEdgesChange={onEdgesChangeHandler}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onSelectionChange={onSelectionChange}
            onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={readOnly ? ConnectionMode.Loose : ConnectionMode.Strict}
            defaultViewport={viewport}
            fitView={false}
            panOnScroll={true}
            panOnScrollSpeed={0.8}
            minZoom={0.1}
            maxZoom={3}
            snapToGrid={gridEnabled}
            snapGrid={[20, 20]}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={true}
            selectNodesOnDrag={true}
            attributionPosition="bottom-left"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--color-surface-border)"
            />
            {minimapEnabled && (
              <MiniMap
                nodeColor={(node) => {
                  const def = node.type
                    ? getNodeDefinition(node.type as FlowNode['type'])
                    : undefined;
                  if (!def) return 'var(--color-surface-border-strong)';
                  const colors: Record<NodeCategory, string> = {
                    trigger: 'var(--color-node-trigger-border)',
                    action: 'var(--color-node-action-border)',
                    logic: 'var(--color-node-logic-border)',
                  };
                  return colors[def.category] || 'var(--color-surface-border-strong)';
                }}
                maskColor="rgba(88, 101, 242, 0.3)"
              />
            )}
            <Controls
              showZoom={false}
              showFitView={false}
              showInteractive={!readOnly}
            />
          </ReactFlow>
        </div>

        {/* Right Sidebar */}
        {showSidebar && (
          <div className="w-80 flex-shrink-0 transition-width duration-fast border-l border-surface-border">
            <NodeConfigSidebar
              node={selectedNode ? fromEditorNode(selectedNode) : null}
              nodeDefinition={selectedNodeDef}
              onUpdate={(nodeId, config) => {
                setNodes((nds) =>
                  nds.map((n) => {
                    if (n.id !== nodeId) return n;
                    const data = n.data;
                    if (data.category === 'trigger') {
                      return {
                        ...n,
                        data: { ...data, config: { ...data.config, ...config } as TriggerConfig },
                      };
                    }
                    if (data.category === 'action') {
                      return {
                        ...n,
                        data: { ...data, config: { ...data.config, ...config } as ActionConfig },
                      };
                    }
                    return {
                      ...n,
                      data: { ...data, config: { ...data.config, ...config } as LogicConfig },
                    };
                  })
                );
                saveToHistory();
              }}
              onClose={() => {
                setShowSidebar(false);
                setSelectedNodeId(null);
                clearSelection();
              }}
              onDeleteNode={(nodeId) => {
                setNodes((nds) => nds.filter((n) => n.id !== nodeId));
                setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
                setSelectedNodeId(null);
                setShowSidebar(false);
                saveToHistory();
              }}
              onDuplicateNode={(nodeId) => {
                const nodeToDup = nodes.find((n) => n.id === nodeId);
                if (!nodeToDup) return;
                const newNode: EditorNode = {
                  ...nodeToDup,
                  id: `${nodeToDup.type}-${Date.now()}`,
                  position: {
                    x: nodeToDup.position.x + 30,
                    y: nodeToDup.position.y + 30,
                  },
                  selected: false,
                };
                setNodes((nds) => [...nds, newNode]);
                saveToHistory();
              }}
              validationErrors={Object.fromEntries(validationErrors.map((e) => [e.field, e.message]))}
            />
          </div>
        )}

        {/* Keyboard Shortcuts Modal */}
        <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>
    </div>
  );
}
