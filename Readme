# AgentForge Workspace

**A local control plane for designing, running, and deploying multi-agent workflows.**

AgentForge Workspace gives developers one place to inspect an agent mesh, run a prompt through its execution path, watch per-agent latency, and generate a Docker/Kubernetes deployment profile from the same graph.

![Platform](https://img.shields.io/badge/platform-Next.js%2015-111827?style=flat-square) ![Language](https://img.shields.io/badge/language-TypeScript-3178C6?style=flat-square) ![Runtime](https://img.shields.io/badge/runtime-Node.js%2022-339933?style=flat-square)

## Why AgentForge

Multi-agent prototypes are easy to sketch and difficult to operationalize. AgentForge narrows that gap: the workflow graph used in the studio is also the input to the execution engine and deployment compiler. There is no separate diagram to keep in sync with the service configuration.

## What you can do

| Capability | What it provides |
| --- | --- |
| **Visual mesh** | A React Flow canvas that shows the routed agent topology and each node’s current state. |
| **Controlled execution** | A typed graph engine with validation, bounded hops, repeat-loop protection, execution events, and cancellation support. |
| **Runtime signal** | Per-agent status and latency in the workspace alongside an execution terminal. |
| **OpenAI execution** | Server-side Responses API calls that keep `OPENAI_API_KEY` out of the browser. |
| **Demo-ready mode** | A clearly labeled deterministic mode for testing the full workflow without credentials. |
| **Deployment compilation** | Generated Dockerfile, Kubernetes Namespace, ConfigMap, Deployment, Service, and rollout script. |

## Quick start

**Prerequisite:** Node.js 22 or later.

```bash
git clone https://github.com/joshuaadmissions-web/agentforge-workspace.git
cd agentforge-workspace
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000/workspace](http://localhost:3000/workspace).

### Run with OpenAI

Add a valid key to `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
AGENTFORGE_DEMO_MODE=false
```

Configured agent nodes are then executed through the OpenAI Responses API. Without a key, the default `AGENTFORGE_DEMO_MODE=true` keeps the workspace usable with deterministic local results; it never presents demo output as a model response.

## Architecture

```text
Workspace UI ──► AgentFlowEngine ──► /api/execute ──► OpenAI Responses API
      │                 │
      │                 └── status, messages, latency events
      │
      └──────────────────────────────► /api/deploy ──► Docker + Kubernetes profile
```

| Area | Location | Responsibility |
| --- | --- | --- |
| Studio UI | `src/components/workspace` | Canvas, prompt controls, terminal, and metrics. |
| Graph runtime | `src/lib/agentFlowEngine.ts` | Validates and walks directed agent graphs. |
| Model boundary | `src/app/api/execute/route.ts` | Executes configured nodes server-side or returns transparent demo output. |
| Deployment compiler | `src/app/api/deploy/route.ts` | Converts graph configuration into deployment artifacts. |
| Health check | `src/app/api/health/route.ts` | Supplies a readiness/liveness endpoint. |

## Verify the build

```bash
npm run typecheck
npm run build
```

## Generate a deployment profile

Select **Generate Deployment** in the workspace, or `POST` a graph definition to `/api/deploy`. The endpoint returns:

- `Dockerfile` — multi-stage Node 22 production image
- `k8s/agentforge-mesh.yaml` — Namespace, ConfigMap, Deployment, and Service
- `deploy.sh` — applies the manifest and waits for rollout completion

Save the generated files in the service repository, build and publish the image referenced in the deployment request, then run `deploy.sh` with a configured `kubectl` context.

## Hackathon submission notes

AgentForge Workspace was built and iterated with Codex during the submission period. Codex accelerated the typed application foundation, graph runtime, React Flow workspace, deployment compiler, health check, and verification workflow. The project author directed the product choices, including the graph schema, transparent demo mode, server-only API-key handling, and Kubernetes security posture.

For a complete submission, add the repository URL, a public demo video under three minutes with audio, the `/feedback` Codex Session ID, and any test credentials or demo URL required by judges. Confirm eligibility, ownership, licensing, and deadlines against [Rules.md](./Rules.md) before submitting.

## License

See [LICENSE](./LICENSE).
