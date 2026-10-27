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
    <div className="flex flex-col gap-4">
      {isLoggedIn ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="h-2 w-2 rounded-full bg-mar" />
                Conectado como {session?.nome ?? session?.usuario}
              </span>
              {session?.curso && <span className="font-mono text-[11px] text-foreground-2">{session.curso}</span>}
              <span className="text-xs text-muted-foreground">
                {session?.sincronizadoEm
                  ? `Histórico sincronizado em ${new Date(session.sincronizadoEm).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}`
                  : 'Histórico ainda não sincronizado'}
              </span>
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
          <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap">
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-mar px-5 text-[13px] font-bold text-white transition-colors hover:bg-mar/90 disabled:opacity-60"
            >
              {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar histórico
            </button>
            <button
              onClick={() => void baixarGradeIcs()}
              className="flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/20 px-5 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa"
            >
              <CalendarArrowDown className="h-4 w-4" />
              Grade no calendário
            </button>
            <button
              onClick={() => void logout()}
              className="flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-bold text-pitanga transition-colors hover:bg-pitanga-tint"
            >
              <LogOut className="h-4 w-4" />
              Sair do SIGAA
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Sair não apaga o que já foi importado: as disciplinas e o progresso continuam salvos neste navegador.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-muted-foreground" />
            Não conectado
            <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold', statusOk ? 'bg-mar-claro text-mar-ink' : 'bg-nevoa text-foreground-2')}>
              {statusLabel}
            </span>
          </span>
          <button
            onClick={openLogin}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-mar px-[22px] text-[15px] font-extrabold text-white transition-colors hover:bg-mar/90 md:h-11 md:text-[13px]"
          >
            Conectar ao SIGAA →
          </button>
        </div>
      )}
    </div>
  );
}
