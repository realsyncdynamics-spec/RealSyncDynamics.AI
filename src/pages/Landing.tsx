import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { AIAssistant } from '../components/AIAssistant';
import { Pricing } from '../components/Pricing';
import { Footer } from '../components/Footer';

export function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-200 selection:text-blue-900">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <AIAssistant />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
