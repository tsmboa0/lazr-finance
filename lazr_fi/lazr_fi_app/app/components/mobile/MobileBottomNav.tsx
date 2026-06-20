"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, TrendingUp, Landmark, Sparkles } from "lucide-react";
import DepositDropdown from "../DepositDropdown";

const NAV_ITEMS = [
  {
    label: "PropAMM",
    href: "/",
    icon: LayoutGrid,
    isActive: (path: string) =>
      path === "/" || path.startsWith("/trade"),
  },
  {
    label: "Perps",
    href: "/perps/SOL",
    icon: TrendingUp,
    isActive: (path: string) => path.startsWith("/perps"),
  },
  {
    label: "Lend",
    href: "#",
    icon: Landmark,
    isActive: () => false,
  },
  {
    label: "Predict",
    href: "#",
    icon: Sparkles,
    isActive: () => false,
  },
];

function NavIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={`w-6 h-0.5 rounded-full mb-0.5 ${
        active ? "bg-foreground" : "bg-transparent"
      }`}
    />
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex-shrink-0 border-t border-border-subtle bg-background px-1 pb-safe z-30"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          const className = `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full transition-colors ${
            active ? "text-foreground" : "text-tertiary hover:text-secondary"
          }`;

          if (item.href === "#") {
            return (
              <button key={item.label} type="button" className={className}>
                <NavIndicator active={active} />
                <Icon className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-[10px] font-medium truncate max-w-full px-1 leading-none">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={className}
              {...(item.label === "Perps"
                ? { "data-tour": "propamm-perps-nav" }
                : {})}
            >
              <NavIndicator active={active} />
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium truncate max-w-full px-1 leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}

        <DepositDropdown variant="bottomNav" />
      </div>
    </nav>
  );
}
