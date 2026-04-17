import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#0A0A0B] border-t-4 border-[#E2E2E2] py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#0052FF] p-2">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <span className="font-mono font-bold text-2xl tracking-tighter text-[#E2E2E2] uppercase">
                RealSync<span className="text-[#0052FF]">Dynamics</span>
              </span>
            </div>
            <p className="text-slate-400 font-mono text-sm max-w-sm leading-relaxed">
              [SYSTEM_STATUS: OPERATIONAL]
              <br />
              Sovereign AI-Infrastruktur für Europa. 
              Digitale Verifizierung und sichere Automatisierung.
              Harte Kanten für klare Entscheidungen.
            </p>
          </div>
          
          <div className="space-y-6">
            <h4 className="text-[#E2E2E2] font-mono font-bold text-xs uppercase tracking-[0.2em] border-l-4 border-[#0052FF] pl-3">
              Plattform_Module
            </h4>
            <ul className="space-y-3">
              {['Creator OS', 'CreatorSeal', 'Market', 'DealFlow', 'LocalFlow'].map((item) => (
                <li key={item}>
                  <a 
                    href="#" 
                    className="block w-full text-left bg-[#141416] border border-slate-800 text-slate-400 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[#0052FF] hover:text-white hover:border-[#0052FF] transition-all"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-[#E2E2E2] font-mono font-bold text-xs uppercase tracking-[0.2em] border-l-4 border-[#0052FF] pl-3">
              Information_Meta
            </h4>
            <ul className="space-y-3">
              {['Über uns', 'Kontakt', 'Datenschutz', 'Impressum'].map((item) => (
                <li key={item}>
                  <a 
                    href="#" 
                    className="block w-full text-left bg-[#141416] border border-slate-800 text-slate-400 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[#E2E2E2] hover:text-[#0A0A0B] hover:border-[#E2E2E2] transition-all"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 mt-20 pt-10 flex flex-col md:flex-row justify-between items-center gap-8 font-mono">
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            © {new Date().getFullYear()} REALSYNCDYNAMICS_TERMINAL. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
             <span className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500"></div>
               EU_LOCATION: DE_FRANKFURT
             </span>
             <span className="text-[#0052FF]">DSGVO_ENFORCED</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

