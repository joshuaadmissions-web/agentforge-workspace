import { NextResponse } from "next/server";
import type { AgentNodeConfig } from "@/lib/agentFlowEngine";

export const runtime = "nodejs";

interface ExecuteRequest { node: AgentNodeConfig; input: string; }

interface ResponsesApiPayload {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}

function assertRequest(value: unknown): asserts value is ExecuteRequest {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object");
  const request = value as Partial<ExecuteRequest>;
  if (!request.node || typeof request.node !== "object" || typeof request.node.label !== "string") throw new Error("A valid node is required");
  if (typeof request.input !== "string" || request.input.trim().length === 0) throw new Error("input must be a non-empty string");
}

function demoResponse(node: AgentNodeConfig, input: string): string {
  const excerpt = input.replace(/\s+/g, " ").slice(0, 180);
  return `${node.label} completed a deterministic local analysis of: ${excerpt}`;
}

function extractOutput(payload: ResponsesApiPayload): string {
  if (payload.output_text) return payload.output_text;
  const text = payload.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text;
  if (!text) throw new Error("The model response did not contain output text");
  return text;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    assertRequest(body);
    const isGlm = body.node.model && body.node.model.startsWith("glm-");
    const apiKey = isGlm ? process.env.ZHIPUAI_API_KEY : process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      if (process.env.AGENTFORGE_DEMO_MODE === "false") {
        return NextResponse.json({ 
          error: isGlm ? "ZHIPUAI_API_KEY is not configured" : "OPENAI_API_KEY is not configured" 
        }, { status: 503 });
      }
      return NextResponse.json({ output: demoResponse(body.node, body.input), mode: "demo" });
    }

    if (isGlm) {
      // GLM API call
      const upstream = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          model: body.node.model,
          messages: [
            { role: "system", content: body.node.systemPrompt },
            { role: "user", content: body.input }
          ],
          temperature: 0
        }),
      });
      const payload = await upstream.json() as any;
      if (!upstream.ok) {
        return NextResponse.json({ error: payload.error?.message ?? "GLM execution failed" }, { status: upstream.status });
      }
      return NextResponse.json({ output: payload.choices[0]?.message?.content || "No response", mode: "glm" });
    } else {
      // OpenAI API call
      const upstream = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.node.model,
          instructions: body.node.systemPrompt,
          input: body.input,
          max_output_tokens: body.node.maxTokens,
        }),
      });
      const payload = await upstream.json() as ResponsesApiPayload & { error?: { message?: string } };
      if (!upstream.ok) return NextResponse.json({ error: payload.error?.message ?? "OpenAI execution failed" }, { status: upstream.status });
      return NextResponse.json({ output: extractOutput(payload), mode: "openai" });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Execution request failed" }, { status: 400 });
  }
}
