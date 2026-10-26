import { Home, BookOpen, Calendar, SlidersHorizontal, Sun, Moon, Github, GraduationCap } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { SigaaAccountButton } from '@/components/sigaa/SigaaAccount';
import { Logo } from '@/components/brand/Logo';
import { useMyPrograms } from '@/hooks/useMyPrograms';

const menuItems = [
  { title: 'Início', url: '/', icon: Home },
  { title: 'Disciplinas', url: '/disciplinas', icon: BookOpen },
  { title: 'Planejador', url: '/planejador', icon: Calendar },
  { title: 'Ajustes', url: '/configuracoes', icon: SlidersHorizontal },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

function tituloCurso(title?: string) {
  if (!title) return 'Curso';
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

/**
 * Navegação desktop. Na identidade nova vira uma barra superior (logo · pílulas · curso/conta · tema).
 * As props de recolher continuam aceitas para não mudar a API do componente, mas a barra não recolhe.
 */
export function AppSidebar({ isCollapsed = false, toggleCollapse }: AppSidebarProps) {
  const { theme, toggleTheme } = useApp();
  const { myPrograms } = useMyPrograms();
  const curso = myPrograms[0];

  return (
    <header className="sticky top-0 z-40 hidden w-full border-b border-border bg-background/95 backdrop-blur-sm md:block">
      <div className="mx-auto flex max-w-[1328px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[clamp(20px,4vw,56px)] py-3.5">
        <NavLink to="/" className="flex min-h-11 items-center" aria-label="cadee — início">
          <Logo size={28} />
        </NavLink>

        <nav aria-label="Principal">
          <ul className="flex items-center gap-0.5 rounded-full bg-nevoa p-1">
            {menuItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className="flex h-11 items-center gap-2 rounded-full px-[18px] text-[13px] font-semibold text-foreground-2 transition-colors hover:text-foreground"
                  activeClassName="bg-primary font-bold text-primary-foreground hover:text-primary-foreground"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {curso && (
            <NavLink
              to="/configuracoes"
              title={`${curso.title} — mudar de curso em Ajustes`}
              className="flex h-11 items-center gap-2.5 rounded-full border-[1.5px] border-foreground/15 py-1 pl-1.5 pr-4 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nevoa">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="max-w-[180px] truncate">{tituloCurso(curso.title)}</span>
            </NavLink>
          )}
          <SigaaAccountButton variant="icon" />
          <a
            href="https://github.com/FormigTeen/sigaa-static"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            aria-label="GitHub"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground-2 transition-colors hover:bg-nevoa hover:text-foreground"
          >
            <Github className="h-[18px] w-[18px]" />
          </a>
          <button
            onClick={toggleTheme}
            title="Alternar tema"
            aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
            className={cn('flex h-11 w-11 items-center justify-center rounded-full bg-nevoa text-foreground transition-colors hover:bg-trilho')}
          >
            {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </header>
  );
}
