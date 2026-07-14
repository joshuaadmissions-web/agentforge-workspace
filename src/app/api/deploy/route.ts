import { NextResponse } from "next/server";
import type { AgentGraphDefinition } from "@/lib/agentFlowEngine";

export const runtime = "nodejs";

interface DeploymentRequest {
  graph: AgentGraphDefinition;
  image: string;
  replicas?: number;
  namespace?: string;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function assertDeploymentRequest(value: unknown): asserts value is DeploymentRequest {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object");
  const request = value as Partial<DeploymentRequest>;
  if (!request.graph || !Array.isArray(request.graph.nodes) || !Array.isArray(request.graph.edges)) throw new Error("graph.nodes and graph.edges are required arrays");
  if (typeof request.graph.name !== "string" || !/^[a-z0-9-]+$/.test(request.graph.name)) throw new Error("graph.name must be a lowercase DNS-safe identifier");
  if (typeof request.image !== "string" || request.image.length === 0) throw new Error("image is required");
  if (request.replicas !== undefined && (!Number.isInteger(request.replicas) || request.replicas < 1 || request.replicas > 50)) throw new Error("replicas must be an integer between 1 and 50");
}

function dockerfile(): string {
  return `FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start"]
`;
}

function manifests(request: DeploymentRequest): string {
  const replicas = request.replicas ?? 2;
  const namespace = request.namespace ?? "agentforge";
  const graph = JSON.stringify(request.graph);
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${request.graph.name}-graph
  namespace: ${namespace}
data:
  graph.json: ${yamlString(graph)}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${request.graph.name}
  namespace: ${namespace}
  labels:
    app.kubernetes.io/name: ${request.graph.name}
    app.kubernetes.io/component: agent-mesh
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app.kubernetes.io/name: ${request.graph.name}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${request.graph.name}
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: agentforge-runtime
          image: ${request.image}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
          env:
            - name: AGENTFORGE_GRAPH_PATH
              value: /etc/agentforge/graph.json
          volumeMounts:
            - name: graph
              mountPath: /etc/agentforge
              readOnly: true
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits: { cpu: "1", memory: 1Gi }
          readinessProbe:
            httpGet: { path: /api/health, port: http }
            initialDelaySeconds: 5
          livenessProbe:
            httpGet: { path: /api/health, port: http }
            initialDelaySeconds: 15
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
      volumes:
        - name: graph
          configMap: { name: ${request.graph.name}-graph }
---
apiVersion: v1
kind: Service
metadata:
  name: ${request.graph.name}
  namespace: ${namespace}
spec:
  selector:
    app.kubernetes.io/name: ${request.graph.name}
  ports:
    - name: http
      port: 80
      targetPort: http
`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload: unknown = await request.json();
    assertDeploymentRequest(payload);
    return NextResponse.json({
      profile: payload.graph.name,
      files: {
        Dockerfile: dockerfile(),
        "k8s/agentforge-mesh.yaml": manifests(payload),
        "deploy.sh": `#!/usr/bin/env sh\nset -eu\nkubectl apply -f k8s/agentforge-mesh.yaml\nkubectl rollout status deployment/${payload.graph.name} -n ${payload.namespace ?? "agentforge"}\n`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid deployment request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
