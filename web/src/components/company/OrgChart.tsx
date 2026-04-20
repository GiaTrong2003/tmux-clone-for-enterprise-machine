import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import { AgentNode } from './AgentNode';
import type { AgentWithSession } from '../../types/api';
import './OrgChart.css';

const NODE_W = 200;
const NODE_H = 82;
const H_GAP = 40;
const V_GAP = 64;

const nodeTypes = { agent: AgentNode };

interface Props {
  agents: AgentWithSession[];
  onOpenNode: (name: string) => void;
}

// Compute level (distance from a top-level node) for each agent.
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

function computeLayout(agents: AgentWithSession[]): { nodes: Node[]; edges: Edge[] } {
  const level = computeLevels(agents);
  const rows = new Map<number, AgentWithSession[]>();
  agents.forEach(a => {
    const l = level.get(a.name) ?? 0;
    if (!rows.has(l)) rows.set(l, []);
    rows.get(l)!.push(a);
  });

  const maxRow = Math.max(...Array.from(rows.values()).map(r => r.length), 1);
  const chartW = Math.max(800, maxRow * (NODE_W + H_GAP) + H_GAP);

  const nodes: Node[] = [];
  for (const [l, row] of rows.entries()) {
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = (chartW - totalW) / 2;
    row.forEach((a, i) => {
      nodes.push({
        id: a.name,
        type: 'agent',
        position: { x: startX + i * (NODE_W + H_GAP), y: l * (NODE_H + V_GAP) + V_GAP / 2 },
        data: { agent: a },
        draggable: false,
        selectable: true,
      });
    });
  }

  const edges: Edge[] = agents
    .filter(a => a.reportsTo && agents.some(x => x.name === a.reportsTo))
    .map(a => ({
      id: `${a.reportsTo}-${a.name}`,
      source: a.reportsTo!,
      target: a.name,
      type: 'smoothstep',
      style: { stroke: 'var(--border)', strokeWidth: 1.5 },
    }));

  return { nodes, edges };
}

export function OrgChart({ agents, onOpenNode }: Props) {
  const { nodes, edges } = useMemo(() => {
    const base = computeLayout(agents);
    // Thread onOpenNode into each node's data so AgentNode can call it
    const withHandler = base.nodes.map(n => ({
      ...n,
      data: { ...n.data, onOpen: onOpenNode },
    }));
    return { nodes: withHandler, edges: base.edges };
  }, [agents, onOpenNode]);

  return (
    <div className="org-chart">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="#21262d" gap={24} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          style={{ background: 'var(--bg-0)' }}
          nodeColor={n => {
            const s = (n.data as any)?.agent?.status;
            if (s === 'running') return 'var(--warn)';
            if (s === 'waiting') return 'var(--ok)';
            if (s === 'error') return 'var(--err)';
            return 'var(--fg-dim)';
          }}
        />
      </ReactFlow>
    </div>
  );
}
