"use client";

import { create } from "zustand";
import type { AgentGraphDefinition, ExecutionStatus } from "@/lib/agentFlowEngine";

export interface NodeMetric { status: ExecutionStatus; latencyMs?: number; }

interface WorkspaceState {
  prompt: string;
  graph: AgentGraphDefinition;
  metrics: Record<string, NodeMetric>;
  terminalLines: string[];
  setPrompt: (prompt: string) => void;
  setMetric: (nodeId: string, metric: NodeMetric) => void;
  appendTerminal: (line: string) => void;
  clearTerminal: () => void;
}

export const defaultGraph: AgentGraphDefinition = {
  name: "research-and-review-mesh",
  nodes: [
    { id: "intake", label: "Request Intake", kind: "input", model: "input", systemPrompt: "Normalize the incoming request.", temperature: 0, maxTokens: 600 },
    { id: "research", label: "Research Agent", kind: "agent", model: "gpt-5.6", systemPrompt: "Find evidence and identify uncertainty.", temperature: 0.2, maxTokens: 1800 },
    { id: "review", label: "Quality Gate", kind: "router", model: "gpt-5.6", systemPrompt: "Review claims, citations, and risk.", temperature: 0.1, maxTokens: 900 },
    { id: "deliver", label: "Deliverable", kind: "output", model: "output", systemPrompt: "Present a concise, defensible answer.", temperature: 0, maxTokens: 1200 },
  ],
  edges: [
    { id: "intake-research", source: "intake", target: "research" },
    { id: "research-review", source: "research", target: "review" },
    { id: "review-deliver", source: "review", target: "deliver" },
  ],
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  prompt: "Analyze the latest deployment telemetry and recommend the safest release strategy.",
  graph: defaultGraph,
  metrics: {},
  terminalLines: ["AgentForge runtime ready.", "Graph loaded: research-and-review-mesh"],
  setPrompt: (prompt) => set({ prompt }),
  setMetric: (nodeId, metric) => set((state) => ({ metrics: { ...state.metrics, [nodeId]: metric } })),
  appendTerminal: (line) => set((state) => ({ terminalLines: [...state.terminalLines.slice(-99), line] })),
  clearTerminal: () => set({ terminalLines: [] }),
}));
