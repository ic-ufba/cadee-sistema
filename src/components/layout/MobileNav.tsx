import { Home, BookOpen, Calendar, SlidersHorizontal } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const menuItems = [
  { title: 'Início', url: '/', icon: Home },
  { title: 'Disciplinas', url: '/disciplinas', icon: BookOpen },
  { title: 'Planejador', url: '/planejador', icon: Calendar },
  { title: 'Ajustes', url: '/configuracoes', icon: SlidersHorizontal },
];

/** Dock flutuante do mobile: só ícones; o item ativo vira uma pílula clara com o nome. */
export function MobileNav() {
  const { pathname } = useLocation();

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] pointer-events-none">
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto rounded-full bg-dock p-1.5 shadow-dock dark:border dark:border-white/10"
      >
        <ul className="flex items-center justify-between gap-1">
          {menuItems.map((item) => {
            const active = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);
            return (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  aria-label={item.title}
                  className={cn(
                    'flex h-12 items-center justify-center rounded-full transition-colors',
                    active ? 'gap-2 bg-dock-ativo pl-3.5 pr-[18px] text-dock-ativo-fg' : 'w-[52px] text-dock-icone hover:text-white',
                  )}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-mar')} />
                  {active && <span className="text-[13.5px] font-extrabold">{item.title}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
