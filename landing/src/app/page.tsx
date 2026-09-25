import { Hero } from "@/components/sections/Hero";
import { AssetStrip } from "@/components/sections/AssetStrip";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Calculator } from "@/components/sections/Calculator";
import { Cashback } from "@/components/sections/Cashback";
import { Tiers } from "@/components/sections/Tiers";
import { Savings } from "@/components/sections/Savings";
import { Compare } from "@/components/sections/Compare";
import { Demo } from "@/components/sections/Demo";
import { Protection } from "@/components/sections/Protection";
import { Manifesto } from "@/components/sections/Manifesto";
import { Faq } from "@/components/sections/Faq";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-clip bg-ground text-text antialiased">
      <Hero />
      <AssetStrip />
      <HowItWorks />
      <Calculator />
      <Cashback />
      <Tiers />
      <Savings />
      <Compare />
      <Demo />
      <Protection />
      <Manifesto />
      <Faq />
      <Footer />
    </main>
  );
}
