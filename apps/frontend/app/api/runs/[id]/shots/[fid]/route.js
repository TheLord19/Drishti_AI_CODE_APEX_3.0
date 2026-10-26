import { getStore } from "../../../../store";
import { readText } from "../../../../run-log";

// Evidence screenshot captured while a check caught the defect (element outlined in red).
export async function GET(req, { params }) {
  const { id, fid } = await params;
  const dataUri = getStore().shots?.get(`${id}/${fid}`) || readText(id, `shot_${fid}.txt`);
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUri || "");
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=86400" },
  });
}
