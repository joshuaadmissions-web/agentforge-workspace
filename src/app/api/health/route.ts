import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(): NextResponse {
  return NextResponse.json({ status: "ok", service: "agentforge-workspace", timestamp: new Date().toISOString() });
}
