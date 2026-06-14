"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const FlashTradeProvider = dynamic(
  () =>
    import("../../providers/FlashTradeProvider").then(
      (mod) => mod.FlashTradeProvider
    ),
  { ssr: false }
);

export default function PerpsFlashProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <FlashTradeProvider>{children}</FlashTradeProvider>;
}
