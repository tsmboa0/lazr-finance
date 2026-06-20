import Header from "./components/Header";
import HeroBar from "./components/HeroBar";
import TokenTable from "./components/TokenTable";
import MobileBottomNav from "./components/mobile/MobileBottomNav";
import HomeOnboarding from "./components/onboarding/HomeOnboarding";
import { AllPoolQuotesProvider } from "./providers/AllPoolQuotesProvider";

export default function Home() {
  return (
    <div className="flex flex-col h-screen min-h-0 bg-background">
      <HomeOnboarding />
      <Header />
      <div className="flex-1 min-h-0 flex flex-col">
        <HeroBar />
        <AllPoolQuotesProvider>
          <TokenTable />
        </AllPoolQuotesProvider>
      </div>
      <div className="lg:hidden shrink-0">
        <MobileBottomNav />
      </div>
    </div>
  );
}
