import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SigaaAccountButton } from '@/components/sigaa/SigaaAccount';
import { Logo } from '@/components/brand/Logo';

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
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm">
      <div className="flex h-[60px] items-center justify-between pl-5 pr-2">
        <Logo size={25} />

        <div className="flex items-center gap-1">
          <SigaaAccountButton variant="icon" />
          <button
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-nevoa"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
