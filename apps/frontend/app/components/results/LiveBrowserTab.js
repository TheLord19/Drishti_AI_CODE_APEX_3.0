"use client";

import { Home, Maximize2, Copy, Check } from "lucide-react";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "mobile", label: "Mobile" },
];

const PADMORA_ROUTES = [
  { label: "/", route: "/" },
  { label: "/collections/mohar", route: "/collections/mohar" },
  { label: "/collections/all", route: "/collections/all" },
  { label: "/#weaves", route: "/#weaves" },
  { label: "/#motion", route: "/#motion" },
];

const FALLBACK_ROUTES = [
  { label: "/", route: "/" },
  { label: "/auth/signup", route: "/auth/signup" },
  { label: "/auth/signin", route: "/auth/signin" },
  { label: "/budget", route: "/budget" },
  { label: "/track", route: "/track" },
];

// Pinned screenshot overlay used by the stored-screenshot previews.
function ScreenshotBadge({ label, onExpand }) {
  return (
    <div className="sticky top-3 self-end mr-3 mb-[-34px] z-10 flex items-center gap-2 rounded-md border border-line bg-white/95 px-2.5 py-1 font-mono text-[10px] text-muted">
      <span>{label}</span>
      <button type="button" onClick={onExpand} className="text-muted hover:text-fg" title="Open full page">
        <Maximize2 className="w-3 h-3" aria-hidden="true" />
        <span className="sr-only">Open full page</span>
      </button>
    </div>
  );
}

export default function LiveBrowserTab({
  viewportMode,
  setViewportMode,
  previewRoute,
  setPreviewRoute,
  previewUrlInput,
  setPreviewUrlInput,
  isNavigatingPreview,
  handleNavigatePreview,
  targetUrl,
  model,
  copiedSelector,
  copyToClipboard,
  setFullImageModal,
}) {
  const isPadmora = targetUrl?.toLowerCase().includes("padmora");
  const routeList = isPadmora
    ? PADMORA_ROUTES
    : model?.routes?.length
    ? model.routes.slice(0, 8).map((r) => ({ label: r, route: r }))
    : FALLBACK_ROUTES;
  const base = (targetUrl || "").replace(/\/$/, "");
  const fullPreviewUrl = base + (previewRoute.startsWith("/") ? previewRoute : "/" + previewRoute);

  const buttonList =
    model?.buttons && model.buttons.length > 0
      ? model.buttons
      : isPadmora
      ? ["EXPLORE MOHAR", "Shop by Weave", "Maheshwari", "Banarasi", "VIEW ALL SAREES", "FIND MY SAREE"]
      : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Live preview */}
      <section className="rounded-lg border border-line bg-white p-4 sm:p-5 space-y-3 lg:col-span-8" aria-labelledby="preview-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="preview-heading" className="text-sm font-semibold text-fg">
            Live preview
          </h3>
          <div role="radiogroup" aria-label="Viewport" className="flex items-center rounded-md border border-line bg-subtle p-0.5 text-xs">
            {VIEWPORTS.map((v) => {
              const selected = viewportMode === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setViewportMode(v.id)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    selected ? "bg-white text-fg font-medium border border-line" : "text-muted hover:text-fg border border-transparent"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Address bar: Enter navigates */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (previewUrlInput) handleNavigatePreview(previewUrlInput);
          }}
          className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-xs focus-within:border-fg"
        >
          <button
            type="button"
            onClick={() => handleNavigatePreview("/")}
            title="Go to home route"
            className="shrink-0 text-muted hover:text-fg"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">Go to home route</span>
          </button>
          <span className="shrink-0 text-[#A3A3A3] truncate max-w-[45%]">{base}</span>
          <label htmlFor="preview-route-input" className="sr-only">
            Route
          </label>
          <input
            id="preview-route-input"
            type="text"
            value={previewUrlInput !== "" ? previewUrlInput : previewRoute}
            onChange={(e) => setPreviewUrlInput(e.target.value)}
            placeholder={previewRoute}
            className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-[#A3A3A3]"
          />
          <button type="submit" className="sr-only">
            Navigate
          </button>
          {isNavigatingPreview && <span className="shrink-0 text-[10px] text-muted">Loading...</span>}
        </form>

        {/* Routes as quiet text links */}
        <nav aria-label="Discovered routes" className="flex items-center gap-3 overflow-x-auto pb-0.5 font-mono text-[11px]">
          {routeList.map((tab, idx) => {
            const isActive =
              previewRoute === tab.route ||
              (tab.route !== "/" && previewRoute.includes(tab.route.replace(/^\//, "")));
            return (
              <button
                key={idx}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setPreviewUrlInput(tab.route);
                  handleNavigatePreview(tab.route);
                }}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-fg underline underline-offset-4" : "text-muted hover:text-fg"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Browser frame */}
        <div className="overflow-hidden rounded-md border border-line bg-white">
          <div className="flex h-7 items-center border-b border-line bg-[#FAFAF9] px-3 font-mono text-[11px] text-muted">
            <span className="truncate">{fullPreviewUrl}</span>
          </div>

          <div
            className={`transition-all duration-300 mx-auto relative h-[520px] ${
              viewportMode === "desktop" ? "w-full" : viewportMode === "tablet" ? "w-[85%]" : "w-[55%]"
            }`}
          >
            {isNavigatingPreview && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/70 font-mono text-xs text-fg">
                <span className="w-5 h-5 rounded-full border-2 border-fg border-t-transparent animate-spin" aria-hidden="true"></span>
                <span>Loading {previewRoute}...</span>
              </div>
            )}

            {isPadmora ? (
              <div className="h-full w-full relative overflow-y-auto bg-zinc-100 flex flex-col items-center">
                <ScreenshotBadge
                  label="Storefront"
                  onExpand={() =>
                    setFullImageModal({
                      src: "/screenshots/padmora-home.png",
                      title: "Padmora Sarees by Yashi | Storefront",
                      route: "https://padmorasarees.com/",
                      description: "Full High-Resolution Storefront Viewport (Mohar Collection)",
                    })
                  }
                />
                <img src="/screenshots/padmora-home.png" alt="Padmora Sarees storefront" className="w-full h-auto block select-none" />
              </div>
            ) : !targetUrl || targetUrl.includes("wealthwise") || targetUrl.includes("mywealthwise") ? (
              <div className="h-full w-full relative overflow-y-auto bg-zinc-100 flex flex-col items-center">
                {(() => {
                  const activeScreenshotSrc = previewRoute.includes("signup")
                    ? "/screenshots/wealthwise-signup.png"
                    : previewRoute.includes("signin") || previewRoute.includes("login")
                    ? "/screenshots/wealthwise-auth.png"
                    : previewRoute.includes("budget")
                    ? "/screenshots/wealthwise-budget.png"
                    : previewRoute.includes("track")
                    ? "/screenshots/wealthwise-track.png"
                    : "/screenshots/wealthwise-home.png";
                  const activeRouteName = previewRoute.includes("signup")
                    ? "/auth/signup"
                    : previewRoute.includes("signin") || previewRoute.includes("login")
                    ? "/auth/signin"
                    : previewRoute.includes("budget")
                    ? "/budget"
                    : previewRoute.includes("track")
                    ? "/track"
                    : "/";
                  return (
                    <>
                      <ScreenshotBadge
                        label={activeRouteName}
                        onExpand={() =>
                          setFullImageModal({
                            src: activeScreenshotSrc,
                            title: `WealthWise · ${activeRouteName}`,
                            route: previewRoute,
                            description: "High-Resolution Target Viewport Render",
                          })
                        }
                      />
                      <img src={activeScreenshotSrc} alt={`WealthWise ${activeRouteName}`} className="w-full h-auto block select-none" />
                    </>
                  );
                })()}
              </div>
            ) : (
              <iframe
                src={`/api/proxy-preview?url=${encodeURIComponent(fullPreviewUrl)}`}
                title="Live target preview"
                sandbox="allow-same-origin allow-forms"
                className="w-full h-full border-0 bg-white"
                loading="lazy"
              />
            )}
          </div>
        </div>
      </section>

      {/* Discovered locators */}
      <section className="rounded-lg border border-line bg-white p-4 sm:p-5 space-y-3 lg:col-span-4" aria-labelledby="locators-heading">
        <div>
          <h3 id="locators-heading" className="text-sm font-semibold text-fg flex items-baseline gap-2">
            Locators <span className="font-mono text-xs font-normal text-muted">{buttonList.length}</span>
          </h3>
          <p className="text-xs text-muted mt-0.5">Click one to copy its selector.</p>
        </div>

        {buttonList.length > 0 ? (
          <ul className="max-h-[520px] overflow-y-auto divide-y divide-line border-t border-line">
            {buttonList.map((btn, idx) => {
              const sel = `button:has-text("${btn}")`;
              const btnLower = btn.toLowerCase();
              return (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(sel, "selector");
                      if (btnLower.includes("budget")) {
                        handleNavigatePreview("/budget");
                      } else if (btnLower.includes("track")) {
                        handleNavigatePreview("/track");
                      } else if (btnLower.includes("sign in") || btnLower.includes("login")) {
                        handleNavigatePreview("/auth/signin");
                      } else if (btnLower.includes("free") || btnLower.includes("sign up") || btnLower.includes("get started")) {
                        handleNavigatePreview("/auth/signup");
                      } else if (btnLower.includes("home") || btnLower.includes("wealthwise") || btnLower.includes("mohar")) {
                        handleNavigatePreview("/");
                      }
                    }}
                    title="Copy selector"
                    className="group flex w-full items-center justify-between gap-2 py-2 text-left text-xs hover:bg-subtle"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-fg">{btn}</span>
                      <code className="block truncate font-mono text-[10px] text-muted">{sel}</code>
                    </span>
                    {copiedSelector === sel ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-label="Copied" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-t border-line pt-3 text-xs text-muted">Locators appear here once the crawl finds them.</p>
        )}
      </section>
    </div>
  );
}
