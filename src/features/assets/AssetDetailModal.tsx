import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ShieldCheck, Download, Fingerprint, Box, Activity, Link as LinkIcon, Code, Copy, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { SovereignButton } from '../../components/ui/SovereignButton';

interface Asset {
  id: string;
  name: string;
  status: string;
  views: string;
  date: string;
  package?: string; // 'Creator Start', 'Creator Pro', 'Creator Sovereign'
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
}

export const AssetDetailModal = ({ isOpen, onClose, asset }: ModalProps) => {
  if (!isOpen || !asset) return null;

  // Mock a hash string based on ID
  const mockHashString = `0x3F8A2B9C${asset.id.replace('AST-', '')}E7D1F...4A2`;
  const pkg = asset.package || 'Creator Pro';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#0A0A0B]/90 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-6xl bg-[#0A0A0B] text-[#E2E2E2] shadow-[8px_8px_0px_0px_#0052FF] border border-[#E2E2E2]/20 flex flex-col md:flex-row h-[85vh] sm:h-auto max-h-[90vh]">
        
        {/* Left Column: Preview & QR */}
        <div className="w-full md:w-2/5 border-r border-[#E2E2E2]/10 flex flex-col items-center justify-center p-8 bg-[#141416]">
          <div className="w-full aspect-square border-2 border-[#E2E2E2]/10 bg-[#0A0A0B] flex items-center justify-center mb-8 relative group overflow-hidden">
             {/* Technical grid lines overlay */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(226,226,226,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(226,226,226,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
             <ImageIcon className="h-16 w-16 text-[#0052FF]/50" />
             <div className="absolute top-4 left-4 font-mono text-[10px] font-bold tracking-widest text-[#0052FF]">PREVIEW_RENDER_ACTIVE</div>
          </div>
          
          <div className="bg-[#E2E2E2] p-4 flex flex-col items-center">
            <QRCodeSVG value={`https://realsyncdynamics.com/verify/${asset.id}`} size={160} fgColor="#0A0A0B" bgColor="#E2E2E2" />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-400 mt-4 mb-8 text-center flex flex-col gap-1">
             <span>SCANNABLE_SIGNATURE_TOKEN</span>
             <span>ID: {asset.id}</span>
          </div>

          <div className="flex gap-4 w-full">
             <SovereignButton variant="outline" className="flex-1 text-[10px] py-3"><Download className="h-3.5 w-3.5 mr-2" /> QR / PNG</SovereignButton>
             <SovereignButton variant="outline" className="flex-1 text-[10px] py-3"><Code className="h-3.5 w-3.5 mr-2" /> EMBED</SovereignButton>
          </div>
        </div>

        {/* Right Column: Verification Data */}
        <div className="w-full md:w-3/5 p-8 overflow-y-auto font-mono">
           <div className="flex items-start justify-between mb-8">
             <div>
               <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">{asset.name}</h2>
               <div className="flex items-center gap-3 text-[10px] font-bold text-titanium-500">
                 <span className="flex items-center"><Activity className="h-3 w-3 mr-1" /> {asset.views} VIEWS</span>
                 <span className="text-[#0052FF]">|</span>
                 <span>TS: {asset.date}</span>
                 <span className="text-[#0052FF]">|</span>
                 <span className="text-emerald-500">C2PA_VERIFIED</span>
               </div>
             </div>
             <button onClick={onClose} className="p-2 text-titanium-400 hover:text-white hover:bg-[#141416] transition-colors">
               <X className="h-5 w-5" />
             </button>
           </div>
           
           <div className="space-y-6">
             {/* Verification Status */}
             <div className="border border-[#E2E2E2]/20 p-5 bg-[#141416]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#0052FF] mb-4 flex items-center border-b border-[#E2E2E2]/10 pb-2"><ShieldCheck className="h-3 w-3 mr-2" /> VERIFIZIERUNGSSTATUS</h3>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                     <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider mb-1 mt-1">VERIFIED_BY_REALSYNC_DYNAMICS</div>
                    <div className="text-[10px] text-titanium-500">SIGNATURE TIMESTAMP: {asset.date} (UTC)</div>
                  </div>
                </div>
             </div>

             {/* Watermark Section */}
             <div className="border border-[#E2E2E2]/20 p-5 bg-[#141416]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#0052FF] mb-4 flex items-center border-b border-[#E2E2E2]/10 pb-2"><Fingerprint className="h-3 w-3 mr-2" /> WASSERZEICHEN_METADATEN</h3>
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-titanium-500 mb-1">
                     <span>UNSICHTBARES WASSERZEICHEN</span>
                     <span className="text-emerald-500">ACTIVE</span>
                  </div>
                  <div className="bg-[#0A0A0B] border border-[#E2E2E2]/10 p-3 flex justify-between items-center group cursor-pointer hover:border-[#0052FF]/50 transition-colors mt-2">
                    <span className="text-xs text-[#E2E2E2] font-bold tracking-widest">{mockHashString}</span>
                    <Copy className="h-3.5 w-3.5 text-titanium-400 group-hover:text-[#0052FF]" />
                  </div>
                </div>
                <SovereignButton variant="primary" className="w-full text-[10px] py-4 mt-2 bg-[#0052FF] text-white hover:bg-[#0041CC] border-transparent"><LinkIcon className="h-3.5 w-3.5 mr-2" /> ASSET_PROOF_SEITE ÖFFNEN</SovereignButton>
             </div>

             {/* Package & Tools */}
             <div className="border border-[#E2E2E2]/20 p-5 bg-[#0A0A0B] relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#0052FF]"></div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-titanium-400 mb-4 flex items-center border-b border-[#E2E2E2]/10 pb-2"><Box className="h-3 w-3 mr-2" /> AKTIVES PAKET & TOOLS</h3>
                <div className="flex items-center gap-3 mb-5 mt-2">
                   <div className="px-3 py-1 bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/30 text-[10px] font-bold tracking-wider uppercase">
                     {pkg}
                   </div>
                   <span className="text-[10px] text-titanium-400 uppercase tracking-widest">REALSYNC_BADGE_AUTHORIZED</span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-[10px] text-titanium-600">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 font-bold" /> UNSICHTBARES WATERMARK</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 font-bold" /> QR & BARCODE GEN</div>
                  <div className="flex items-center gap-2">
                    {pkg.includes('Sovereign') ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 font-bold" /> : <div className="h-3.5 w-3.5 rounded-full border border-titanium-700 flex items-center justify-center opacity-50"><X className="h-2.5 w-2.5" /></div>} 
                    <span className={!pkg.includes('Sovereign') ? 'opacity-50 line-through' : ''}>BLOCKCHAIN_PROOF</span>
                  </div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 font-bold" /> ANALYTICS ({pkg.includes('Start') ? 'BASIC' : pkg.includes('Pro') ? 'ADVANCED' : 'FULL'})</div>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
