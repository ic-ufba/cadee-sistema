import { useEffect } from 'react';
import { CalendarArrowDown, LogIn, LogOut, RefreshCw, UserRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { useSigaaAuth, useSigaaLoginDialog, useSigaaSync } from '@/hooks/useSigaa';
import { SIGAA_SESSION_EXPIRED_EVENT } from '@/services/sigaaApi';
import { baixarGradeIcs } from '@/lib/sigaaActions';
import { cn } from '@/lib/utils';
import { SigaaLoginDialog } from './SigaaLoginDialog';

function primeiroNome(nome?: string, fallback?: string) {
  if (!nome) return fallback ?? 'Conta SIGAA';
  const first = nome.trim().split(/\s+/)[0] ?? nome;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Monta o diálogo de login e avisa quando a sessão do SIGAA expira. Fica uma vez no topo do app. */
export function SigaaRoot() {
  const { isConfigured } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();

  useEffect(() => {
    const onExpired = () =>
      toast({
        title: 'Sua sessão do SIGAA expirou',
        description: 'O CADEE continua funcionando com os dados já importados.',
        action: (
          <ToastAction altText="Entrar de novo" onClick={openLogin}>
            Entrar de novo
          </ToastAction>
        ),
      });
    window.addEventListener(SIGAA_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SIGAA_SESSION_EXPIRED_EVENT, onExpired);
  }, [openLogin]);

  if (!isConfigured) return null;
  return <SigaaLoginDialog />;
}

interface SigaaAccountButtonProps {
  collapsed?: boolean;
  variant?: 'sidebar' | 'icon';
}

/** Botão de conta: "Entrar com SIGAA" ou o menu do aluno logado. Some se a API não estiver configurada. */
export function SigaaAccountButton({ collapsed = false, variant = 'sidebar' }: SigaaAccountButtonProps) {
  const { isConfigured, isLoggedIn, session, logout } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();
  const sync = useSigaaSync();

  if (!isConfigured) return null;

  const compact = collapsed || variant === 'icon';
  const baseClass =
    variant === 'icon'
      ? 'relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-nevoa transition-colors text-foreground'
      : cn(
          'flex w-full items-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
          compact ? 'justify-center p-2' : 'gap-2 px-3 py-2',
        );

  if (!isLoggedIn) {
    return (
      <button type="button" onClick={openLogin} className={baseClass} title="Entrar com o SIGAA" aria-label="Entrar com o SIGAA">
        <LogIn className="h-5 w-5 shrink-0" />
        {!compact && <span className="text-sm font-medium whitespace-nowrap">Entrar com SIGAA</span>}
      </button>
    );
  }

  const nome = primeiroNome(session?.nome, session?.usuario);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={baseClass} title={`Conectado ao SIGAA como ${session?.usuario}`} aria-label="Conta do SIGAA">
          <span className="relative">
            <UserRound className="h-5 w-5 shrink-0" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
          </span>
          {!compact && (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{nome}</span>
              <span className="block text-[10px] text-muted-foreground">SIGAA conectado</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === 'icon' ? 'end' : 'start'} side={variant === 'icon' ? 'bottom' : 'top'} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{session?.nome ?? session?.usuario}</span>
          {session?.curso && <span className="block truncate text-xs text-muted-foreground">{session.curso}</span>}
          {session?.sincronizadoEm && (
            <span className="block text-xs text-muted-foreground">
              Sincronizado em {new Date(session.sincronizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={sync.isPending} onSelect={() => sync.mutate()}>
          <RefreshCw className={cn('mr-2 h-4 w-4', sync.isPending && 'animate-spin')} />
          {sync.isPending ? 'Sincronizando…' : 'Sincronizar histórico'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void baixarGradeIcs()}>
          <CalendarArrowDown className="mr-2 h-4 w-4" />
          Baixar grade (.ics)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sair do SIGAA
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
