import { NextResponse } from "next/server";
import { labResult } from "../../lab";

// Lab status; once the run has finished, the planted bugs and the score.
export async function GET(req, { params }) {
  const { id } = await params;
  const result = await labResult(id);
  if (!result) return NextResponse.json({ error: { message: "Lab run not found" } }, { status: 404 });
  return NextResponse.json(result);
}
