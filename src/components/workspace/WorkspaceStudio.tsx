"use client";

import { useCallback, useState } from "react";
import { AgentFlowEngine, type AgentNodeConfig } from "@/lib/agentFlowEngine";
import { AgentGraphCanvas } from "./AgentGraphCanvas";
import { useWorkspaceStore } from "./store";
import styles from "./workspace.module.css";

const executeAgent = async (node: AgentNodeConfig, input: string): Promise<string> => {
  if (node.kind === "input" || node.kind === "output") return input;
  const response = await fetch("/api/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ node, input }) });
  const payload = await response.json() as { output?: string; error?: string };
  if (!response.ok || !payload.output) throw new Error(payload.error ?? "Agent execution failed");
  return payload.output;
};

export function WorkspaceStudio() {
  const { prompt, graph, metrics, terminalLines, setPrompt, setMetric, appendTerminal, clearTerminal } = useWorkspaceStore();
  const [running, setRunning] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const runGraph = useCallback(async () => {
    setRunning(true);
    appendTerminal(`> Executing ${graph.name}`);
    try {
      const engine = new AgentFlowEngine(graph, executeAgent);
      for await (const event of engine.execute({ runId: crypto.randomUUID(), input: prompt, maxHops: 12 })) {
        setMetric(event.nodeId, { status: event.status, latencyMs: event.latencyMs });
        appendTerminal(`${event.status.toUpperCase()} ${event.nodeId}${event.latencyMs ? ` (${event.latencyMs} ms)` : ""}`);
      }
      appendTerminal("Execution completed successfully.");
    } catch (error) {
      appendTerminal(`ERROR ${error instanceof Error ? error.message : "Unknown runtime error"}`);
    } finally { setRunning(false); }
  }, [appendTerminal, graph, prompt, setMetric]);

  const createDeployment = useCallback(async () => {
    setDeploying(true);
    appendTerminal("> Compiling Docker and Kubernetes deployment profile");
    try {
      const response = await fetch("/api/deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph, image: "ghcr.io/acme/agentforge-mesh:latest", replicas: 3 }) });
      const payload = await response.json() as { files?: Record<string, string>; error?: string };
      if (!response.ok || !payload.files) throw new Error(payload.error ?? "Deployment compilation failed");
      appendTerminal(`Generated ${Object.keys(payload.files).join(", ")}`);
    } catch (error) { appendTerminal(`DEPLOY ERROR ${error instanceof Error ? error.message : "Unknown error"}`); }
    finally { setDeploying(false); }
  }, [appendTerminal, graph]);

  const complete = Object.values(metrics).filter((metric) => metric.status === "completed").length;
  return <main className={styles.studio}>
    <header className={styles.header}><div><span className={styles.wordmark}>AGENTFORGE</span><span className={styles.environment}>LOCAL / DEVELOPMENT</span></div><div className={styles.actions}><button onClick={createDeployment} disabled={deploying}>{deploying ? "Compiling…" : "Generate Deployment"}</button><button className={styles.run} onClick={runGraph} disabled={running}>{running ? "Running…" : "Run Mesh"}</button></div></header>
    <section className={styles.workspace}>
      <aside className={styles.sidebar}><h2>Execution map</h2><p>{graph.name}</p><dl><dt>Agents</dt><dd>{graph.nodes.length}</dd><dt>Routes</dt><dd>{graph.edges.length}</dd><dt>Complete</dt><dd>{complete}/{graph.nodes.length}</dd></dl><h3>Profiles</h3><button className={styles.profile}>Research & review</button><button className={styles.profile}>Incident response</button></aside>
      <div className={styles.center}><section className={styles.graphPanel}><div className={styles.panelTitle}><span>Agent execution topology</span><span className={styles.live}>{running ? "LIVE" : "READY"}</span></div><AgentGraphCanvas /></section><section className={styles.terminal}><div className={styles.panelTitle}><span>Runtime terminal</span><button onClick={clearTerminal}>Clear</button></div><pre>{terminalLines.join("\n")}</pre></section></div>
      <aside className={styles.inspector}><h2>Prompt configuration</h2><label htmlFor="prompt">Run input</label><textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={9} /><h3>Observed metrics</h3>{graph.nodes.map((node) => <div className={styles.metric} key={node.id}><span>{node.label}</span><b>{metrics[node.id]?.latencyMs ? `${metrics[node.id].latencyMs} ms` : metrics[node.id]?.status ?? "idle"}</b></div>)}</aside>
    </section>
  </main>;
}
