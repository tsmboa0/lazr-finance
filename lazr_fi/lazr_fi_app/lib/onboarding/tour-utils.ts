export function getAllVisibleTourTargets(tourId: string): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const els = document.querySelectorAll<HTMLElement>(
    `[data-tour="${tourId}"]`
  );
  return Array.from(els).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

export function getVisibleTourTarget(tourId: string): HTMLElement | null {
  return getAllVisibleTourTargets(tourId)[0] ?? null;
}

export type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

const SPOTLIGHT_PAD = 6;

function readBorderRadius(el: HTMLElement): string {
  const style = window.getComputedStyle(el);
  const topLeft = style.borderTopLeftRadius;
  if (topLeft && topLeft !== "0px") {
    const pad = SPOTLIGHT_PAD;
    return `calc(${topLeft} + ${pad}px)`;
  }
  return "12px";
}

export function measureSpotlight(el: HTMLElement): SpotlightRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
    borderRadius: readBorderRadius(el),
  };
}

export function measureSpotlightUnion(els: HTMLElement[]): SpotlightRect | null {
  if (els.length === 0) return null;
  if (els.length === 1) return measureSpotlight(els[0]);

  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const el of els) {
    const rect = el.getBoundingClientRect();
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  return {
    top: top - SPOTLIGHT_PAD,
    left: left - SPOTLIGHT_PAD,
    width: right - left + SPOTLIGHT_PAD * 2,
    height: bottom - top + SPOTLIGHT_PAD * 2,
    borderRadius: "14px",
  };
}

export function scrollTargetIntoView(el: HTMLElement): void {
  el.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });
}

export const TOUR_TARGET_ACTIVE_CLASS = "tour-target-active";

export function activateTourTarget(el: HTMLElement | null): () => void {
  if (!el) return () => undefined;
  el.classList.add(TOUR_TARGET_ACTIVE_CLASS);
  return () => {
    el.classList.remove(TOUR_TARGET_ACTIVE_CLASS);
  };
}

export function activateTourTargets(els: HTMLElement[]): () => void {
  for (const el of els) {
    el.classList.add(TOUR_TARGET_ACTIVE_CLASS);
  }
  return () => {
    for (const el of els) {
      el.classList.remove(TOUR_TARGET_ACTIVE_CLASS);
    }
  };
}

export function getTourSpotlight(tourId: string): {
  rect: SpotlightRect | null;
  elements: HTMLElement[];
} {
  const elements = getAllVisibleTourTargets(tourId);
  return {
    elements,
    rect: measureSpotlightUnion(elements),
  };
}
