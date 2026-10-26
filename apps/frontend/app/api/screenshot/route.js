import { NextResponse } from "next/server";
import { captureRouteScreenshot } from "../playwright-service";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    const route = searchParams.get("route") || "/";
    const action = searchParams.get("action") || "view";
    const selector = searchParams.get("selector") || "";

    // highlight=[{selector,label,color}] - color is "red" (defect) or "blue" (selected locator)
    const COLORS = { red: "#DC2626", blue: "#2563EB" };
    let highlights = [];
    try {
      const raw = JSON.parse(searchParams.get("highlight") || "[]");
      if (Array.isArray(raw)) {
        highlights = raw
          .filter((h) => h && typeof h.selector === "string" && h.selector.length <= 200)
          .slice(0, 8)
          .map((h) => ({
            selector: h.selector,
            label: String(h.label || "").slice(0, 80),
            color: COLORS[h.color] || COLORS.red,
          }));
      }
    } catch (e) {}

    if (!targetUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const { buffer, contentType, fromCache } = await captureRouteScreenshot(
      targetUrl,
      route,
      {
        action,
        selector,
        highlights,
        waitMs: 900,
      }
    );

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Drishti-Engine": "Playwright-Chromium",
        "X-Cache-Hit": fromCache ? "HIT" : "MISS",
      },
    });
  } catch (err) {
    if (err?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }
    console.error("[Screenshot API] Fatal error:", err);
    return new NextResponse("Failed to capture screenshot", { status: 500 });
  }
}
