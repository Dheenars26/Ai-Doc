import React from 'react';
import { Sparkles, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ darkMode, onToggleDarkMode }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md transition-colors duration-200 select-none">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Left Side: Logo & Brand */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="font-heading text-sm font-bold text-zinc-900 dark:text-zinc-50 block tracking-tight leading-none">
              AI Document Assistant
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest block mt-1 leading-none">
              Notion & ChatPDF Studio
            </span>
          </div>
        </div>

        {/* Right Side: Theme Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="Toggle theme mode"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

      </div>
    </header>
  );
};

export default Navbar;
