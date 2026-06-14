"use client";

import { Bot } from "lucide-react";

export default function AutopilotTabButton({
  active,
  onClick,
  size = "sm",
}: {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const sizeClasses =
    size === "md"
      ? "px-3 py-1.5 rounded-lg text-sm font-medium"
      : "px-3 py-1.5 rounded-md text-xs font-semibold";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 transition-colors text-gold ${sizeClasses} ${
        active
          ? size === "md"
            ? "bg-elevated"
            : "bg-background shadow-sm"
          : "hover:text-gold-light"
      }`}
    >
      <Bot className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      Autopilot
    </button>
  );
}
