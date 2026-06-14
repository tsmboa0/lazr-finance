import Image from "next/image";
import { USDC_ICON_SRC } from "../data/tokens";

interface TokenIconProps {
  token: {
    ticker: string;
    iconSrc: string;
  };
  /** Diameter of the main token circle in pixels. */
  size?: number;
  /** Whether to render the overlapping USDC badge. */
  showQuote?: boolean;
}

export default function TokenIcon({
  token,
  size = 36,
  showQuote = true,
}: TokenIconProps) {
  const badgeSize = Math.round(size * 0.55);
  const wrapperSize = size + Math.round(badgeSize / 2);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: wrapperSize, height: wrapperSize }}
    >
      <Image
        src={token.iconSrc}
        alt={token.ticker}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
      {showQuote && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background overflow-hidden"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <Image
            src={USDC_ICON_SRC}
            alt="USDC"
            width={badgeSize}
            height={badgeSize}
            className="object-cover"
            style={{ width: badgeSize, height: "auto" }}
          />
        </div>
      )}
    </div>
  );
}
