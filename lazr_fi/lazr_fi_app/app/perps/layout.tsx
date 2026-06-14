import PerpsFlashProvider from "../components/perps/PerpsFlashProvider";

export default function PerpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PerpsFlashProvider>{children}</PerpsFlashProvider>;
}
