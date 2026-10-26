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
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">Conta do SIGAA</h3>
            <p className="text-xs text-muted-foreground">Opcional — importa histórico, CR e pendências automaticamente.</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border',
            statusOk ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {statusLabel}
        </span>
      </div>

      {isLoggedIn ? (
        <>
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm">
            <p className="font-medium text-foreground">{session?.nome ?? session?.usuario}</p>
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
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {sync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar histórico
            </button>
            <button
              onClick={() => void baixarGradeIcs()}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              <CalendarArrowDown className="w-4 h-4" />
              Grade no calendário
            </button>
          </div>
          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
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
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Entrar com o SIGAA
        </button>
      )}
    </div>
  );
}
