"use client";

import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { useWorkspaceStore } from "./store";

const positions = [{ x: 40, y: 145 }, { x: 260, y: 55 }, { x: 490, y: 145 }, { x: 710, y: 55 }];
const palette: Record<string, string> = { input: "#2dd4bf", agent: "#818cf8", router: "#fbbf24", output: "#fb7185" };

export function AgentGraphCanvas() {
  const graph = useWorkspaceStore((state) => state.graph);
  const metrics = useWorkspaceStore((state) => state.metrics);
  const nodes = useMemo<Node[]>(() => graph.nodes.map((agent, index) => ({
    id: agent.id,
    position: positions[index] ?? { x: index * 180, y: 120 },
    data: { label: <div><strong>{agent.label}</strong><small>{metrics[agent.id]?.status ?? "idle"} · {agent.model}</small></div> },
    style: { width: 168, border: `1px solid ${palette[agent.kind]}`, borderRadius: 10, padding: 8, background: "#111827", color: "#e5e7eb" },
  })), [graph.nodes, metrics]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({ ...edge, animated: metrics[edge.target]?.status === "running", markerEnd: { type: MarkerType.ArrowClosed } })), [graph.edges, metrics]);
  return <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}><Background gap={18} size={1} color="#263244" /><Controls showInteractive={false} /></ReactFlow>;
}
