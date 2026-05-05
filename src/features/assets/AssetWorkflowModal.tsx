import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, BrainCircuit, ShieldCheck, FileCheck, CheckCircle2, ChevronRight, Lock } from 'lucide-react';

export function AssetWorkflowModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);

  // Reset step when modal opens
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 2) {
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        setStep(3);
      }, 2500); // Simulate AI scan
    } else if (step < 4) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-3xl bg-obsidian-900 rounded-[2rem] shadow-2xl border border-titanium-900 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-titanium-900/50 bg-obsidian-950">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-obsidian-950 text-white rounded-none"><ShieldCheck className="h-4 w-4" /></div>
            <h2 className="font-display font-semibold text-titanium-50">C2PA Signierungs-Workflow</h2>
          </div>
          <button onClick={onClose} className="p-2 text-titanium-500 hover:text-titanium-300 hover:bg-obsidian-800 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-obsidian-800 rounded-full -z-10"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-security-500 rounded-full -z-10 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
            
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${step >= s ? 'bg-security-500 text-white shadow-md shadow-blue-600/30' : 'bg-obsidian-900 border-2 border-titanium-900 text-titanium-500'}`}>
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold text-titanium-400 uppercase tracking-wider mt-3">
            <span>Upload</span>
            <span>AI Audit</span>
            <span>Policy</span>
            <span>Seal</span>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col items-center justify-center text-center py-10">
                <div className="w-24 h-24 bg-security-900/30 text-security-400 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm ring-1 ring-slate-100">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-display font-bold text-titanium-50 mb-2">Originaldatei hochladen</h3>
                <p className="text-titanium-400 max-w-sm mb-8">Ziehe dein Asset (Bild, Video oder Dokument) in diesen Bereich, um den Sovereign-Trust-Prozess zu starten.</p>
                <div className="w-full max-w-md border-2 border-dashed border-titanium-900 rounded-none p-8 hover:bg-obsidian-950 hover:border-blue-400 transition-all cursor-pointer">
                  <p className="text-sm font-medium text-titanium-300">Klicken oder Datei ablegen</p>
                  <p className="text-xs text-titanium-500 mt-1">PNG, JPG, MP4 oder PDF (Max. 50MB)</p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col py-6">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-security-900/30 text-security-400 rounded-none flex items-center justify-center shadow-sm border border-security-800">
                    <BrainCircuit className={`h-6 w-6 ${isScanning ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-titanium-50">AI Deepfake & Integrity Scan</h3>
                    <p className="text-sm text-titanium-400">Prüfung auf synthetische Generierung und Manipulationen.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-obsidian-950 rounded-none border border-titanium-900/50 flex items-center justify-between">
                    <span className="text-sm font-medium text-titanium-200">Metadaten-Analyse</span>
                    {isScanning ? <div className="w-4 h-4 border-2 border-titanium-800 border-t-indigo-600 rounded-full animate-spin"></div> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  </div>
                  <div className="p-4 bg-obsidian-950 rounded-none border border-titanium-900/50 flex items-center justify-between">
                    <span className="text-sm font-medium text-titanium-200">Bildrauschen & Artefakt-Erkennung</span>
                    {isScanning ? <div className="w-4 h-4 border-2 border-titanium-800 border-t-indigo-600 rounded-full animate-spin"></div> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  </div>
                  <div className="p-4 bg-obsidian-950 rounded-none border border-titanium-900/50 flex items-center justify-between">
                    <span className="text-sm font-medium text-titanium-200">Generative-AI-Signatur (Gemini Vision)</span>
                    {isScanning ? <span className="text-xs font-semibold text-security-400 animate-pulse">Analysiert...</span> : <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-none">100% Menschlich</span>}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col py-6">
                 <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-obsidian-950 text-white rounded-none flex items-center justify-center shadow-sm border border-titanium-900">
                    <FileCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-titanium-50">Rechte & Monetarisierung</h3>
                    <p className="text-sm text-titanium-400">Definiere die C2PA Policy für dieses Asset.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-2">Automatisierungs-Workflow</label>
                    <select className="w-full bg-obsidian-900 border border-titanium-900 rounded-none p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>Standard C2PA Signatur (Keine Verwertungsrechte)</option>
                      <option>Monetize-Flow: 5€ pro Nutzung (Stripe Billing)</option>
                      <option>Internal-Flow: Share mit Team "Design"</option>
                      <option>Public-Sector-Flow: Open Data License</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-2">Creator ID</label>
                      <input type="text" value="Jane Smith (jsmith_corp)" disabled className="w-full bg-obsidian-950 border border-titanium-900/50 rounded-none p-3 text-sm text-titanium-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-titanium-400 uppercase tracking-wider mb-2">AI-Training erlaubt?</label>
                      <select className="w-full bg-obsidian-900 border border-titanium-900 rounded-none p-3 text-sm outline-none">
                        <option>Nein (Opt-Out)</option>
                        <option>Ja (Opt-In)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col items-center justify-center text-center py-10">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20"></div>
                  <div className="relative w-24 h-24 bg-emerald-950/40 text-emerald-400 rounded-full flex items-center justify-center border-8 border-white shadow-md">
                    <ShieldCheck className="h-10 w-10 gap-2" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-obsidian-950 p-1.5 rounded-none border-2 border-white">
                    <Lock className="h-4 w-4 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-display font-bold text-titanium-50 mb-2">Asset kryptografisch versiegelt</h3>
                <p className="text-titanium-400 max-w-sm mb-6">Die C2PA-Metadaten wurden irreversibel in die Datei geschrieben. Das Asset ist nun eIDAS-konform und bereit zur Verteilung.</p>
                <div className="flex gap-3">
                  <button onClick={onClose} className="px-6 py-2.5 bg-obsidian-800 hover:bg-titanium-900 text-titanium-200 font-medium rounded-none transition-colors">Schließen</button>
                  <button onClick={onClose} className="px-6 py-2.5 bg-obsidian-950 hover:bg-obsidian-800 text-white font-medium rounded-none transition-colors">Smart-Link kopieren</button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {step < 4 && (
          <div className="p-6 border-t border-titanium-900/50 bg-obsidian-950 flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-titanium-400 hover:text-titanium-200 transition-colors">
              Abbrechen
            </button>
            <button 
              onClick={handleNext} 
              disabled={isScanning}
              className="px-6 py-2.5 bg-security-500 hover:bg-security-600 disabled:opacity-50 text-white text-sm font-semibold rounded-none shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
            >
              {isScanning ? 'Prüfung läuft...' : step === 3 ? 'Kryptografisch versiegeln' : 'Weiter'}
              {!isScanning && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
