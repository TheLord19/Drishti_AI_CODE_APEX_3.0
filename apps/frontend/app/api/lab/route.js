import { NextResponse } from "next/server";
import { allowedTargets, targetInfo, plantAndRun } from "../lab";

// GET: benchmark targets and the bugs each can plant.
export async function GET() {
  const targets = await Promise.all(allowedTargets().map((u) => targetInfo(u)));
  return NextResponse.json({ targets });
}

// POST { target, bugs: ["A1"] } or { target, random: 3, blind: true }: plant, then start a run.
export async function POST(req) {
  try {
    const body = await req.json();
    const result = await plantAndRun(body);
    return NextResponse.json(result, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: { message: e.message } }, { status: 400 });
  }
}
