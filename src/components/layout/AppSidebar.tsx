import { Home, BookOpen, Calendar, SlidersHorizontal, Sun, Moon, Github, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { SigaaAccountButton } from '@/components/sigaa/SigaaAccount';

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

export function AppSidebar({ isCollapsed = false, toggleCollapse }: AppSidebarProps) {
  const { theme, toggleTheme } = useApp();

  return (
    <aside className={cn("hidden md:flex flex-col fixed inset-y-0 left-0 z-50 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300", isCollapsed ? "w-20" : "w-64")}>
      {toggleCollapse && (
        <button 
          onClick={toggleCollapse}
          className="absolute -right-3 top-8 bg-sidebar border border-sidebar-border rounded-full p-1 text-sidebar-foreground hover:bg-sidebar-accent z-50 shadow-sm"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}

      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        {/* Logo */}
        <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center p-4" : "gap-3")}>
          <img src="/logo.png" alt="CADEE Logo" className={cn("h-12 w-auto transition-all", isCollapsed && "h-8")} />
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-primary truncate">CADEE</h1>
              <p className="text-[8px] text-muted-foreground mt-1 leading-tight">Catálogo Auxiliar de Disciplinas e Estruturação de Estudos</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-2">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200",
                    isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                  )}
                  activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
          <SigaaAccountButton collapsed={isCollapsed} />
          <div className={cn("flex items-center", isCollapsed ? "flex-col justify-center gap-4" : "justify-between")}>
            <button
              onClick={toggleTheme}
              title="Alternar Tema"
              className={cn("flex items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors", isCollapsed ? "p-2 justify-center" : "gap-2 px-3 py-2")}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="text-sm whitespace-nowrap">Escuro</span>}
                </>
              ) : (
                <>
                  <Sun className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="text-sm whitespace-nowrap">Claro</span>}
                </>
              )}
            </button>
            
            <a
              href="https://github.com/FormigTeen/sigaa-static"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex items-center justify-center"
            >
              <Github className="w-5 h-5 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
