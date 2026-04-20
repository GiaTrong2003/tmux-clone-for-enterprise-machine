import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { AgentNode } from './AgentNode';
import { patchAgent } from '../../api/agents';
import type { AgentWithSession } from '../../types/api';
import './OrgChart.css';

const NODE_W = 200;
const NODE_H = 82;
const H_GAP = 40;
const V_GAP = 64;

const nodeTypes = { agent: AgentNode };

interface Props {
  agents: AgentWithSession[];
  activeEdges: Set<string>;
  onOpenNode: (name: string) => void;
  onAddAgent: (parent: string | null) => void;
  onGraphChanged: () => void;
}

function computeLevels(agents: AgentWithSession[]): Map<string, number> {
  const byName = new Map(agents.map(a => [a.name, a]));
  const level = new Map<string, number>();
  const walk = (name: string, seen: Set<string>): number => {
    if (seen.has(name)) return 0;
    seen.add(name);
    const cached = level.get(name);
    if (cached !== undefined) return cached;
    const a = byName.get(name);
    const d = a?.reportsTo && byName.has(a.reportsTo) ? 1 + walk(a.reportsTo, seen) : 0;
    level.set(name, d);
    return d;
  };
  agents.forEach(a => walk(a.name, new Set()));
  return level;
}

function layoutPositions(agents: AgentWithSession[]): Map<string, { x: number; y: number }> {
  const level = computeLevels(agents);
  const rows = new Map<number, AgentWithSession[]>();
  agents.forEach(a => {
    const l = level.get(a.name) ?? 0;
    if (!rows.has(l)) rows.set(l, []);
    rows.get(l)!.push(a);
  });
  const maxRow = Math.max(...Array.from(rows.values()).map(r => r.length), 1);
  const chartW = Math.max(800, maxRow * (NODE_W + H_GAP) + H_GAP);
  const out = new Map<string, { x: number; y: number }>();
  for (const [l, row] of rows.entries()) {
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = (chartW - totalW) / 2;
    row.forEach((a, i) => {
      out.set(a.name, { x: startX + i * (NODE_W + H_GAP), y: l * (NODE_H + V_GAP) + V_GAP / 2 });
    });
  }
  return out;
}

function edgeId(parent: string, child: string) {
  return `${parent}-${child}`;
}

function buildEdges(agents: AgentWithSession[], active: Set<string>): Edge[] {
  const names = new Set(agents.map(a => a.name));
  return agents
    .filter(a => a.reportsTo && names.has(a.reportsTo))
    .map(a => {
      const id = edgeId(a.reportsTo!, a.name);
      const isActive = active.has(id);
      return {
        id,
        source: a.reportsTo!,
        target: a.name,
        type: 'smoothstep',
        animated: isActive,
        className: isActive ? 'edge-delegated' : undefined,
        style: {
          stroke: isActive ? 'var(--warn)' : 'var(--border)',
          strokeWidth: isActive ? 2.5 : 1.5,
        },
        markerEnd: isActive
          ? { type: MarkerType.ArrowClosed, color: 'var(--warn)' }
          : undefined,
      };
    });
}

export function OrgChart({ agents, activeEdges, onOpenNode, onAddAgent, onGraphChanged }: Props) {
  const [nodes, setNodes, onNodesChangeDefault] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeDefault] = useEdgesState<Edge>([]);

  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Rebuild nodes when the agent set (or metadata used for display) changes.
  useEffect(() => {
    const auto = layoutPositions(agents);
    const next: Node[] = agents.map(a => {
      const existing = positionsRef.current.get(a.name);
      const position = existing ?? auto.get(a.name) ?? { x: 0, y: 0 };
      positionsRef.current.set(a.name, position);
      return {
        id: a.name,
        type: 'agent',
        position,
        data: { agent: a, onOpen: onOpenNode },
        draggable: true,
        selectable: true,
      };
    });
    // Drop positions for removed agents so they re-layout cleanly if re-added.
    const keep = new Set(agents.map(a => a.name));
    for (const k of Array.from(positionsRef.current.keys())) {
      if (!keep.has(k)) positionsRef.current.delete(k);
    }
    setNodes(next);
  }, [agents, onOpenNode, setNodes]);

  // Rebuild edges when hierarchy or active-set changes.
  useEffect(() => {
    setEdges(buildEdges(agents, activeEdges));
  }, [agents, activeEdges, setEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChangeDefault(changes);
      for (const c of changes) {
        if (c.type === 'position' && c.position && !c.dragging) {
          positionsRef.current.set(c.id, c.position);
        } else if (c.type === 'position' && c.position) {
          // Live-update so the next render doesn't snap back.
          positionsRef.current.set(c.id, c.position);
        }
      }
    },
    [onNodesChangeDefault]
  );

  const onConnect = useCallback(
    async (conn: Connection) => {
      const parent = conn.source;
      const child = conn.target;
      if (!parent || !child || parent === child) return;
      try {
        await patchAgent(child, { reportsTo: parent });
        onGraphChanged();
      } catch (e: any) {
        alert('Could not link: ' + e.message);
      }
    },
    [onGraphChanged]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChangeDefault(changes);
      // Persistence for removals is handled in onEdgesDelete (which also fires
      // on Delete/Backspace) — we don't duplicate here because `remove` changes
      // also arrive from our own state rebuilds.
    },
    [onEdgesChangeDefault]
  );

  const onEdgesDelete = useCallback(
    async (removed: Edge[]) => {
      for (const e of removed) {
        try {
          await patchAgent(String(e.target), { reportsTo: null });
        } catch (err: any) {
          alert(`Could not unlink ${e.target}: ${err.message}`);
        }
      }
      onGraphChanged();
    },
    [onGraphChanged]
  );

  const onReconnect = useCallback(
    async (oldEdge: Edge, conn: Connection) => {
      const newParent = conn.source;
      const child = conn.target;
      if (!newParent || !child || newParent === child) return;
      try {
        if (String(oldEdge.target) !== child) {
          // Reconnected to a different child — treat as (unlink old child) + (link new child)
          await patchAgent(String(oldEdge.target), { reportsTo: null });
        }
        await patchAgent(child, { reportsTo: newParent });
        onGraphChanged();
      } catch (e: any) {
        alert('Could not reconnect: ' + e.message);
      }
    },
    [onGraphChanged]
  );

  const minimapColor = useCallback((n: Node) => {
    const s = (n.data as any)?.agent?.status;
    if (s === 'running') return 'var(--warn)';
    if (s === 'waiting') return 'var(--ok)';
    if (s === 'error') return 'var(--err)';
    return 'var(--fg-dim)';
  }, []);

  return (
    <div className="org-chart">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onReconnect={onReconnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable
        nodesDraggable
        elementsSelectable
        edgesReconnectable
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={1.5}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background color="#21262d" gap={24} />
        <Controls showInteractive={false} />
        <Panel position="top-right" className="org-chart-panel">
          <button className="primary" onClick={() => onAddAgent(null)}>+ Add agent</button>
          <span className="org-chart-hint">Drag to move · drag a handle to link · click edge + Del to unlink</span>
        </Panel>
        <MiniMap
          pannable
          zoomable
          style={{ background: 'var(--bg-0)' }}
          nodeColor={minimapColor}
        />
      </ReactFlow>
    </div>
  );
}
