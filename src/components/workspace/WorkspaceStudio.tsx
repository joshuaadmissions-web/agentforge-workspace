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
    <header className={styles.header}>
      <div className={styles.brand}><span className={styles.brandMark}>AF</span><div><span className={styles.wordmark}>AgentForge</span><span className={styles.environment}>Workspace · Local runtime</span></div></div>
      <div className={styles.headerStatus}><span className={styles.statusDot} /><span>Runtime connected</span></div>
      <div className={styles.actions}><button className={styles.deploy} onClick={createDeployment} disabled={deploying}>{deploying ? "Compiling…" : "⌘  Deploy profile"}</button><button className={styles.run} onClick={runGraph} disabled={running}>{running ? "Running mesh…" : "▶  Run mesh"}</button></div>
    </header>
    <section className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLabel}>ACTIVE WORKFLOW</div><h2>Research review</h2><p className={styles.flowName}>{graph.name}</p>
        <div className={styles.overview}><div><span>Agents</span><strong>{graph.nodes.length}</strong></div><div><span>Routes</span><strong>{graph.edges.length}</strong></div><div><span>Finished</span><strong>{complete}/{graph.nodes.length}</strong></div></div>
        <h3>Saved workflows</h3><button className={`${styles.profile} ${styles.profileActive}`}><span>✦</span> Research & review</button><button className={styles.profile}><span>◌</span> Incident response</button><button className={styles.profile}><span>◇</span> Product brief</button>
        <div className={styles.sidebarFooter}><span className={styles.pulse} /> Ready for execution</div>
      </aside>
      <div className={styles.center}>
        <section className={styles.graphPanel}><div className={styles.panelTitle}><div><span className={styles.eyebrow}>VISUAL ORCHESTRATION</span><strong>Agent execution topology</strong></div><span className={`${styles.live} ${running ? styles.liveRunning : ""}`}>{running ? "● LIVE RUN" : "● READY"}</span></div><AgentGraphCanvas /></section>
        <section className={styles.terminal}><div className={styles.panelTitle}><div><span className={styles.eyebrow}>EVENT STREAM</span><strong>Runtime console</strong></div><button onClick={clearTerminal}>Clear output</button></div><pre>{terminalLines.join("\n")}</pre></section>
      </div>
      <aside className={styles.inspector}><div className={styles.inspectorHeading}><div><span className={styles.eyebrow}>EXECUTION INPUT</span><h2>Prompt workspace</h2></div><span className={styles.promptIcon}>✦</span></div><label htmlFor="prompt">What should this mesh investigate?</label><textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} /><div className={styles.promptFooter}><span>{prompt.length} characters</span><span>⌘ ↵ to run</span></div><h3>Live metrics</h3><div className={styles.metricsCard}>{graph.nodes.map((node) => <div className={styles.metric} key={node.id}><span className={styles.metricName}><i className={styles[`kind${node.kind[0].toUpperCase()}${node.kind.slice(1)}`]} />{node.label}</span><b>{metrics[node.id]?.latencyMs ? `${metrics[node.id].latencyMs} ms` : metrics[node.id]?.status ?? "waiting"}</b></div>)}</div><div className={styles.tip}><span>✦</span><p><strong>Tip</strong> Run the mesh in demo mode first, then add an API key for live model execution.</p></div></aside>
    </section>
  </main>;
}
