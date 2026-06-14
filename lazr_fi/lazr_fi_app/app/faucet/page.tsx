import Header from "../components/Header";
import FaucetPanel from "../components/faucet/FaucetPanel";

export default function FaucetPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <FaucetPanel />
      </main>
    </div>
  );
}
