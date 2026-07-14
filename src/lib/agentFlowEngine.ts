export type AgentKind = "input" | "agent" | "router" | "output";
export type ExecutionStatus = "idle" | "queued" | "running" | "completed" | "failed";

export interface AgentNodeConfig {
  id: string;
  label: string;
  kind: AgentKind;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
}

export interface AgentEdgeConfig {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface AgentMessage {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  content: string;
  createdAt: string;
}

export interface AgentGraphDefinition {
  name: string;
  nodes: AgentNodeConfig[];
  edges: AgentEdgeConfig[];
}

export interface ExecutionParameters {
  runId: string;
  input: string;
  maxHops: number;
  signal?: AbortSignal;
}

export interface ExecutionEvent {
  nodeId: string;
  status: ExecutionStatus;
  message?: AgentMessage;
  latencyMs?: number;
}

export type AgentExecutor = (node: AgentNodeConfig, input: string, signal?: AbortSignal) => Promise<string>;

export class AgentFlowEngine {
  private readonly nodeIndex: Map<string, AgentNodeConfig>;
  private readonly outgoing: Map<string, AgentEdgeConfig[]>;

  constructor(private readonly graph: AgentGraphDefinition, private readonly executor: AgentExecutor) {
    this.validateGraph(graph);
    this.nodeIndex = new Map(graph.nodes.map((node) => [node.id, node]));
    this.outgoing = graph.edges.reduce<Map<string, AgentEdgeConfig[]>>((index, edge) => {
      const edges = index.get(edge.source) ?? [];
      edges.push(edge);
      index.set(edge.source, edges);
      return index;
    }, new Map());
  }

  async *execute(parameters: ExecutionParameters): AsyncGenerator<ExecutionEvent> {
    const entryNodes = this.graph.nodes.filter((node) => node.kind === "input");
    const queue = entryNodes.map((node) => ({ node, input: parameters.input, hops: 0 }));
    const visited = new Map<string, number>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (parameters.signal?.aborted) throw new DOMException("Execution aborted", "AbortError");
      if (current.hops > parameters.maxHops) throw new Error(`Execution exceeded maxHops (${parameters.maxHops})`);
      const visitKey = `${current.node.id}:${current.input}`;
      const count = visited.get(visitKey) ?? 0;
      if (count >= 1) continue;
      visited.set(visitKey, count + 1);

      yield { nodeId: current.node.id, status: "running" };
      const startedAt = performance.now();
      try {
        const content = await this.executor(current.node, current.input, parameters.signal);
        const latencyMs = Math.round(performance.now() - startedAt);
        const edges = this.outgoing.get(current.node.id) ?? [];
        yield { nodeId: current.node.id, status: "completed", latencyMs };
        for (const edge of edges) {
          const message: AgentMessage = {
            id: `${parameters.runId}:${edge.id}:${crypto.randomUUID()}`,
            sourceNodeId: current.node.id,
            targetNodeId: edge.target,
            content,
            createdAt: new Date().toISOString(),
          };
          yield { nodeId: edge.target, status: "queued", message };
          queue.push({ node: this.nodeIndex.get(edge.target)!, input: content, hops: current.hops + 1 });
        }
      } catch (error) {
        yield { nodeId: current.node.id, status: "failed" };
        throw error;
      }
    }
  }

  private validateGraph(graph: AgentGraphDefinition): void {
    if (graph.nodes.length === 0) throw new Error("An agent graph must contain at least one node");
    const ids = new Set<string>();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
      ids.add(node.id);
    }
    if (!graph.nodes.some((node) => node.kind === "input")) throw new Error("An agent graph requires an input node");
    for (const edge of graph.edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`Edge ${edge.id} references an unknown node`);
    }
  }
}
