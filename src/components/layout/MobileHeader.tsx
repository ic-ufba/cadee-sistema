import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SigaaAccountButton } from '@/components/sigaa/SigaaAccount';

export function MobileHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border/50 z-40 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="CADEE Logo" className="h-8 w-auto" />
          <span className="font-semibold text-foreground">CADEE</span>
        </div>
        
        <div className="flex items-center gap-1">
        <SigaaAccountButton variant="icon" />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-foreground" />
          ) : (
            <Moon className="w-5 h-5 text-foreground" />
          )}
        </button>
        </div>
      </div>
    </header>
  );
}
