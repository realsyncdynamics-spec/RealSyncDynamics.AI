import { ShieldCheck, Menu, X, ChevronRight, LayoutDashboard, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-obsidian-900/80 backdrop-blur-xl border-b border-titanium-900 shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-obsidian-950 p-1.5 rounded-none shadow-sm">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-titanium-50">
              RealSync<span className="text-titanium-400 font-medium">Dynamics</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium text-titanium-300 hover:text-titanium-50 transition-colors">Plattform</a>
            <a href="#pricing" className="text-sm font-medium text-titanium-300 hover:text-titanium-50 transition-colors">Preise</a>
            <Link to="/dashboard" className="group flex items-center gap-1.5 bg-obsidian-950 hover:bg-obsidian-800 border border-titanium-900 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(15,23,42,0.2)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)]">
              <Sparkles className="h-4 w-4 text-security-300" />
              App Workspace
              <ChevronRight className="h-4 w-4 text-titanium-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-titanium-300">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-obsidian-900 border-b border-titanium-900 overflow-hidden shadow-xl"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              <a href="#features" className="block px-3 py-3 text-base font-medium text-titanium-200 hover:bg-obsidian-950 rounded-none">Plattform</a>
              <a href="#pricing" className="block px-3 py-3 text-base font-medium text-titanium-200 hover:bg-obsidian-950 rounded-none">Preise</a>
              <Link to="/dashboard" className="w-full flex justify-between items-center px-3 py-3 mt-2 text-base font-medium bg-obsidian-950 text-white rounded-none">
                App Workspace
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
