import { NextResponse } from "next/server";
import { readableLog } from "../../../run-log";

// The saved agent log for one run, grouped by agent, as a text download.
export async function GET(req, { params }) {
  const { id: runId } = await params;
  const text = readableLog(runId);
  if (!text) {
    return NextResponse.json({ error: { message: "No saved log for this run" } }, { status: 404 });
  }
  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="drishti_${runId}_log.txt"`,
    },
  });
}
