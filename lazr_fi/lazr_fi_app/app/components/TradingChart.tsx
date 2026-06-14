"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface TradingChartProps {
  /** TradingView symbol, e.g. "BINANCE:BTCUSDT" */
  symbol: string;
  /** Unique suffix when multiple charts can exist in the document */
  instanceId?: string;
}

type ChartStatus = "loading" | "ready" | "error";

interface TradingViewWidget {
  onChartReady?: (callback: () => void) => void;
  remove?: () => void;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => TradingViewWidget;
    };
  }
}

const SCRIPT_SRC = "https://s3.tradingview.com/tv.js";
const CHART_READY_TIMEOUT_MS = 15000;
const HIDDEN_HOST_ID = "tv-chart-hidden-host";

function getHiddenHost(): HTMLDivElement {
  let host = document.getElementById(HIDDEN_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = HIDDEN_HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;top:0;left:0";
    document.body.appendChild(host);
  }
  return host;
}

function teardownChart(
  widget: TradingViewWidget | null | undefined,
  mount: HTMLDivElement | null,
  detachToHiddenHost: boolean
) {
  try {
    widget?.remove?.();
  } catch {
    // tv.js can throw when DOM nodes are already detached
  }

  if (!mount) return;

  if (detachToHiddenHost) {
    const host = getHiddenHost();
    if (mount.parentNode !== host) {
      host.appendChild(mount);
    }
  }

  mount.innerHTML = "";
  mount.remove();
}

function isTradingViewNoise(event: ErrorEvent): boolean {
  const filename = event.filename ?? "";
  const message = event.message ?? "";
  return (
    filename.includes("tv.js") ||
    message.includes("parentNode") ||
    message.includes("insertBefore")
  );
}

function loadTradingViewScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );

    if (existing) {
      const scriptLoaded =
        existing.getAttribute("data-loaded") === "true" || window.TradingView;
      if (scriptLoaded) {
        if (window.TradingView) {
          resolve();
        } else {
          reject(new Error("Failed to load TradingView"));
        }
        return;
      }

      existing.addEventListener("load", () => {
        existing.setAttribute("data-loaded", "true");
        resolve();
      });
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load TradingView"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load TradingView"));
    document.head.appendChild(script);
  });
}

function waitForChartEmbed(
  container: HTMLElement,
  onReady: () => void,
  onError: () => void
): () => void {
  let settled = false;
  let observer: MutationObserver | undefined;
  let timeoutId: number | undefined;

  const settle = (ready: boolean) => {
    if (settled) return;
    settled = true;
    observer?.disconnect();
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (ready) onReady();
    else onError();
  };

  const attachIframeListeners = (iframe: HTMLIFrameElement) => {
    iframe.addEventListener("load", () => settle(true), { once: true });
    iframe.addEventListener("error", () => settle(false), { once: true });

    window.setTimeout(() => {
      if (!settled && iframe.offsetHeight > 0) {
        settle(true);
      }
    }, 500);
  };

  const iframe = container.querySelector("iframe");
  if (iframe) {
    attachIframeListeners(iframe);
    return () => settle(false);
  }

  observer = new MutationObserver(() => {
    const frame = container.querySelector("iframe");
    if (frame) attachIframeListeners(frame);
  });

  observer.observe(container, { childList: true, subtree: true });

  timeoutId = window.setTimeout(() => {
    settle(container.querySelector("iframe") !== null);
  }, CHART_READY_TIMEOUT_MS);

  return () => settle(false);
}

export default function TradingChart({
  symbol,
  instanceId = "main",
}: TradingChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartMountRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<TradingViewWidget | null>(null);
  const cleanupReadyWaitRef = useRef<(() => void) | null>(null);
  const containerId = `tv-chart-${instanceId}-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [status, setStatus] = useState<ChartStatus>("loading");

  useLayoutEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      if (isTradingViewNoise(event)) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", onWindowError);

    return () => {
      window.removeEventListener("error", onWindowError);
    };
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    const cleanup = (detachToHiddenHost: boolean) => {
      if (cleanupReadyWaitRef.current) {
        cleanupReadyWaitRef.current();
        cleanupReadyWaitRef.current = null;
      }

      teardownChart(widgetRef.current, chartMountRef.current, detachToHiddenHost);
      widgetRef.current = null;
      chartMountRef.current = null;
    };

    setStatus("loading");

    loadTradingViewScript()
      .then(() => {
        if (cancelled || !window.TradingView) return;

        const wrapper = wrapperRef.current;
        if (!wrapper) {
          if (!cancelled) setStatus("error");
          return;
        }

        const mount = document.createElement("div");
        mount.id = containerId;
        mount.className = "w-full h-full min-h-0";
        wrapper.appendChild(mount);
        chartMountRef.current = mount;

        const widget = new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: "1",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0C0D11",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: false,
          save_image: false,
          container_id: containerId,
          backgroundColor: "#0C0D11",
          gridColor: "rgba(46, 48, 56, 0.4)",
        });

        widgetRef.current = widget;

        const markReady = () => {
          if (!cancelled) setStatus("ready");
        };

        const markError = () => {
          if (!cancelled) setStatus("error");
        };

        if (typeof widget.onChartReady === "function") {
          widget.onChartReady(markReady);
        } else {
          cleanupReadyWaitRef.current = waitForChartEmbed(
            mount,
            markReady,
            markError
          );
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cleanup(true);
    };
  }, [symbol, containerId]);

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col bg-background">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2
            className="size-8 text-gold animate-spin"
            aria-label="Loading chart"
          />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-tertiary text-sm">
          Unable to load chart
        </div>
      )}
      <div
        ref={wrapperRef}
        className={`flex-1 min-h-0 w-full ${status !== "ready" ? "opacity-0" : ""}`}
      />
    </div>
  );
}
