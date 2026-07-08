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

const CopyTradeProvider = dynamic(
  () =>
    import("../../providers/CopyTradeProvider").then(
      (mod) => mod.CopyTradeProvider
    ),
  { ssr: false }
);

export default function PerpsFlashProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FlashTradeProvider>
      <CopyTradeProvider>{children}</CopyTradeProvider>
    </FlashTradeProvider>
  );
}
