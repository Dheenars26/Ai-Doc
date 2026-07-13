import React from 'react';
import { Shield, HelpCircle, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-zinc-200 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-950/40 py-6 select-none transition-colors duration-200 mt-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
        
        {/* Left Links */}
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700" />
          <span>Grounded Source Context Engines Sync</span>
        </div>

        {/* Center / Right Links */}
        <div className="flex items-center gap-6">
          <a href="#" className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <Shield className="h-3.5 w-3.5" />
            <span>Privacy Policy</span>
          </a>
          <a href="#" className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Documentation</span>
          </a>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
