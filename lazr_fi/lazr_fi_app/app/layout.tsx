import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import SolanaWalletProvider from "./providers/SolanaWalletProvider";
import UserBankDelegationProvider from "./providers/UserBankDelegationProvider";
import { MarketDataProvider } from "./providers/MarketDataProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "La⚡r Fi — Terminal",
  description: "Speed-of-light trading terminal on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <SolanaWalletProvider>
          <UserBankDelegationProvider>
            <MarketDataProvider>{children}</MarketDataProvider>
          </UserBankDelegationProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
