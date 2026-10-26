import { CalendarArrowDown, Link2, Loader2, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useSigaaApiStatus, useSigaaAuth, useSigaaLoginDialog, useSigaaSync } from '@/hooks/useSigaa';
import { cn } from '@/lib/utils';
import { baixarGradeIcs } from '@/lib/sigaaActions';

/** Cartão "Conta do SIGAA" da tela de Ajustes. */
export function SigaaSettingsCard() {
  const { isConfigured, isLoggedIn, session, logout } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();
  const sync = useSigaaSync();
  const { data: status, isError: statusError, isLoading: statusLoading } = useSigaaApiStatus(isConfigured);

  if (!isConfigured) return null;

  const sigaaNoAr = status?.sigaa?.no_ar;
  const statusLabel = statusLoading
    ? 'Verificando…'
    : statusError
      ? 'API fora do ar'
      : sigaaNoAr === false
        ? 'SIGAA fora do ar'
        : 'Online';
  const statusOk = !statusLoading && !statusError && sigaaNoAr !== false;

  return (
    <div className="space-y-4 border-t-2 border-foreground pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa">
            <Link2 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-[22px] font-black tracking-[-0.03em] text-foreground">Conta do SIGAA</h3>
            <p className="text-xs text-muted-foreground">Opcional — importa histórico, CR e pendências automaticamente.</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
            statusOk ? 'bg-mar-claro text-mar-ink' : 'bg-nevoa text-foreground-2',
          )}
        >
          {statusLabel}
        </span>
      </div>

      {isLoggedIn ? (
        <>
          <div className="rounded-[18px] bg-nevoa p-4 text-sm">
            <p className="font-extrabold text-foreground">{session?.nome ?? session?.usuario}</p>
            {session?.curso && <p className="text-xs text-muted-foreground">{session.curso}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {session?.sincronizadoEm
                ? `Histórico sincronizado em ${new Date(session.sincronizadoEm).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}`
                : 'Histórico ainda não sincronizado'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {sync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar histórico
            </button>
            <button
              onClick={() => void baixarGradeIcs()}
              className="flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground transition-colors hover:bg-nevoa"
            >
              <CalendarArrowDown className="w-4 h-4" />
              Grade no calendário
            </button>
          </div>
          <button
            onClick={() => void logout()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-pitanga-tint text-sm font-bold text-pitanga-ink transition-colors hover:bg-pitanga hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sair do SIGAA
          </button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sair não apaga o que já foi importado: as disciplinas e o progresso continuam salvos neste navegador.
          </p>
        </>
      ) : (
        <button
          onClick={openLogin}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <LogIn className="w-4 h-4" />
          Entrar com o SIGAA
        </button>
      )}
    </div>
  );
}
