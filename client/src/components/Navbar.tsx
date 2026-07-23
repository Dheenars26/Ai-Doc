import React from 'react';
import { Sparkles, Moon, Sun, Users, Settings } from 'lucide-react';
import { Collaborator } from '../types/types';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenProfile: () => void;
  myProfile: { name: string; color: string };
  collaborators: Collaborator[];
}

export const Navbar: React.FC<NavbarProps> = ({ 
  darkMode, 
  onToggleDarkMode, 
  onOpenProfile, 
  myProfile, 
  collaborators 
}) => {
  // Exclude current user (socket.id matches the collaborator ID, but we just display everyone except themselves or show all)
  // Let's filter other collaborators to display
  const otherCollaborators = collaborators.filter(c => !c.isMe);

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

        {/* Middle/Right: Collaborators list & Profile Trigger & Theme Toggle */}
        <div className="flex items-center gap-4">
          {/* Active Collaborators Bubbles */}
          {collaborators.length > 0 && (
            <div className="flex items-center gap-1.5 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <div className="flex -space-x-2 overflow-hidden">
                {/* Me Avatar */}
                <button
                  onClick={onOpenProfile}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-zinc-950 border-2 border-white dark:border-zinc-900 hover:scale-110 hover:z-10 transition-transform cursor-pointer shadow-sm relative group"
                  style={{ backgroundColor: myProfile.color }}
                  title={`Customize Profile: ${myProfile.name}`}
                >
                  {(myProfile.name || 'W').substring(0, 1).toUpperCase()}
                  <span className="absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                </button>

                {/* Other Collaborators Avatars */}
                {otherCollaborators.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-zinc-950 border-2 border-white dark:border-zinc-900 hover:scale-110 hover:z-10 transition-transform shadow-sm relative group"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  >
                    {(c.name || 'C').substring(0, 1).toUpperCase()}
                  </div>
                ))}

                {otherCollaborators.length > 4 && (
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 border-2 border-white dark:border-zinc-900 shadow-sm">
                    +{otherCollaborators.length - 4}
                  </div>
                )}
              </div>
              
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline-block">
                {collaborators.length} {collaborators.length === 1 ? 'Editor' : 'Editors'} Online
              </span>
            </div>
          )}

          {/* Settings / Customize Profile Button */}
          <button
            onClick={onOpenProfile}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title="Customize profile"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Toggle theme mode"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

      </div>
    </header>
  );
};

export default Navbar;
