import { motion } from 'motion/react';
import { ArrowRight, Shield, Lock, FileCheck, Terminal } from 'lucide-react';
import { SovereignButton } from './ui/SovereignButton';

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-[#0A0A0B]">
      {/* Sovereign Grid Background */}
      <div className="absolute inset-0 bg-[#E2E2E2]/[0.02] bg-[size:40px_40px]"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0B]/50 to-[#0A0A0B] pointer-events-none"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-start gap-12">
          
          <div className="flex-1 text-left">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-3 px-4 py-2 bg-[#141416] border-l-4 border-[#0052FF] text-[11px] font-mono font-bold uppercase tracking-widest text-[#E2E2E2] mb-8"
            >
              <Terminal className="h-4 w-4 text-[#0052FF]" />
              [STATUS: TRUST_LAYER_ACTIVE]
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="font-mono text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tighter text-[#E2E2E2] leading-[0.9] mb-8 uppercase"
            >
              Digitale <br />
              <span className="text-[#0052FF]">Souveränität.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="text-lg text-titanium-500 max-w-xl mb-12 font-mono leading-relaxed"
            >
              Wir bauen die Infrastruktur für das post-generative Zeitalter. 
              Kryptografische Absicherung von Assets nach C2PA-Standard. 
              Made in Europe. Hard-wired for compliance.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="flex flex-wrap gap-6"
            >
              <SovereignButton variant="primary" size="lg" className="group">
                Terminal öffnen
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </SovereignButton>
              <SovereignButton variant="outline" size="lg">
                Protokoll lesen
              </SovereignButton>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="flex-1 relative hidden lg:block"
          >
            <div className="aspect-square bg-[#141416] border-2 border-[#E2E2E2]/10 p-8 relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 font-mono text-[8px] leading-tight overflow-hidden p-4 select-none pointer-events-none">
                 {Array.from({ length: 50 }).map((_, i) => (
                   <div key={i}>0x{Math.random().toString(16).substring(2, 10).toUpperCase()} SIGNATURE_VALIDATED BY_REALSYNC_DYNAMICS</div>
                 ))}
               </div>
               <div className="relative h-full border-2 border-[#0052FF] flex items-center justify-center bg-[#0A0A0B]/80 backdrop-blur-sm">
                 <Shield className="h-32 w-32 text-[#0052FF]" />
                 <div className="absolute bottom-4 left-4 right-4 flex justify-between font-mono text-[10px] text-titanium-400 uppercase tracking-widest font-bold">
                    <span>C2PA_VERIFIED</span>
                    <span>EIDAS_COMPLIANT</span>
                 </div>
               </div>
            </div>
            {/* Hard Edge Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#0052FF]/20 -z-10"></div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-[#E2E2E2]/10 -z-10"></div>
          </motion.div>

        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-24 pt-12 border-t border-[#E2E2E2]/10 flex flex-wrap justify-between gap-x-12 gap-y-8 font-mono"
        >
          <div className="flex items-center gap-4 group">
            <div className="p-3 bg-[#141416] text-[#0052FF] border border-[#0052FF]/20 group-hover:bg-[#0052FF] group-hover:text-white transition-colors">
              <FileCheck className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h4 className="text-[#E2E2E2] text-xs font-bold uppercase tracking-widest">C2PA_Standard</h4>
              <p className="text-titanium-400 text-[10px]">VERIFIZIERTE_CREDENTIALS</p>
            </div>
          </div>
          <div className="flex items-center gap-4 group">
            <div className="p-3 bg-[#141416] text-[#0052FF] border border-[#0052FF]/20 group-hover:bg-[#0052FF] group-hover:text-white transition-colors">
              <Lock className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h4 className="text-[#E2E2E2] text-xs font-bold uppercase tracking-widest">eIDAS_Sicherheit</h4>
              <p className="text-titanium-400 text-[10px]">EU_LEVEL_COMPLIANCE</p>
            </div>
          </div>
          <div className="flex items-center gap-4 group">
            <div className="p-3 bg-[#141416] text-[#0052FF] border border-[#0052FF]/20 group-hover:bg-[#0052FF] group-hover:text-white transition-colors">
              <Shield className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h4 className="text-[#E2E2E2] text-xs font-bold uppercase tracking-widest">DSGVO_Enforced</h4>
              <p className="text-titanium-400 text-[10px]">100%_DATEN_SOUVERÄNITÄT</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

