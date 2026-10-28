import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Lightbulb, Link2, Loader2, RefreshCw, X } from 'lucide-react';
import {
  useSigaaAuth,
  useSigaaCargaHoraria,
  useSigaaIndices,
  useSigaaIntegralizacao,
  useSigaaLoginDialog,
  useSigaaSync,
} from '@/hooks/useSigaa';
import { LiveDataBadge } from './ComponentProgram';
import { cn } from '@/lib/utils';

const CTA_KEY = 'sigaaCtaDismissed';

function fmt(n: number | null | undefined, digits = 2) {
  return typeof n === 'number' ? n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

function StatTile({ label, value, hint, loading }: { label: string; value: string; hint?: string; loading?: boolean }) {
  return (
    <div className="rounded-[18px] bg-nevoa p-4">
      <p className="rotulo">{label}</p>
      {loading ? (
        <div className="mt-1 h-7 w-16 animate-pulse rounded-full bg-trilho" />
      ) : (
        <p className="mt-1 text-[26px] font-black tabular-nums tracking-[-0.04em] text-foreground">{value}</p>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Convite discreto para conectar a conta (só aparece se a API estiver configurada e o aluno não estiver logado). */
function ConnectCta() {
  const { openLogin } = useSigaaLoginDialog();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(CTA_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(CTA_KEY, '1');
    } catch {
      // ignora
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-[18px] bg-mar-claro p-4 sm:flex-row sm:items-center">
      <Link2 className="hidden h-8 w-8 shrink-0 text-mar sm:block" />
      <div className="flex-1 text-sm">
        <p className="font-extrabold text-mar-ink">Conecte sua conta do SIGAA</p>
        <p className="text-muted-foreground">
          Importa o histórico sozinho e mostra CR, IAP, integralização e o que falta para se formar. É opcional.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={openLogin} className="h-11 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          Conectar
        </button>
        <button onClick={dismiss} className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-foreground-2 hover:text-foreground" aria-label="Dispensar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Painel com os índices oficiais do SIGAA (CR, IAP, integralização, pendências). */
export function SigaaInsights() {
  const { isConfigured, isLoggedIn } = useSigaaAuth();
  const indices = useSigaaIndices(isLoggedIn);
  const integralizacao = useSigaaIntegralizacao(isLoggedIn);
  const horas = useSigaaCargaHoraria(isLoggedIn);
  const sync = useSigaaSync();
  const [showAllPendentes, setShowAllPendentes] = useState(false);

  if (!isConfigured || !isLoggedIn) return null;

  const evolucao = (indices.data?.evolucao ?? []).filter((p) => p.cr_acumulado !== null || p.cr_periodo !== null);
  const pendentes = (integralizacao.data?.obrigatorios_pendentes ?? []).filter((p) => p.codigo.toUpperCase() !== 'ENADE');
  const categorias = (integralizacao.data?.carga_horaria ?? []).filter((c) => (c.exigido ?? 0) > 0);
  const percentual = integralizacao.data?.percentual ?? horas.data?.percentual_integralizado ?? null;
  const loadingAny = indices.isLoading || integralizacao.isLoading;
  const error = indices.error || integralizacao.error;

  return (
    <section className="mb-8 border-t-2 border-foreground pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[22px] font-black tracking-[-0.03em] text-foreground sm:text-[24px]">Dados oficiais do SIGAA</h2>
          <LiveDataBadge />
        </div>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-foreground/20 px-4 text-xs font-bold text-foreground hover:bg-nevoa disabled:opacity-60"
        >
          {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar histórico
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-[14px] bg-pitanga-tint px-4 py-2.5 text-sm font-semibold text-pitanga-ink">
          {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="CR" value={fmt(indices.data?.oficiais.cr)} loading={indices.isLoading} hint="Coeficiente de rendimento" />
        <StatTile label="IAP" value={fmt(indices.data?.oficiais.iap)} loading={indices.isLoading} hint="Índice de aproveitamento" />
        <StatTile
          label="Integralizado"
          value={percentual !== null ? `${fmt(percentual, 1)}%` : '—'}
          loading={integralizacao.isLoading}
          hint={integralizacao.data?.prazo_conclusao_padrao ? `Prazo padrão: ${integralizacao.data.prazo_conclusao_padrao}` : undefined}
        />
        <StatTile
          label="Extensão"
          value={horas.data ? `${horas.data.extensao_total_ch}h` : '—'}
          loading={horas.isLoading}
          hint="Carga horária extensionista"
        />
      </div>

      {evolucao.length > 1 && (
        <div className="mt-5">
          <h3 className="rotulo mb-2">Evolução do CR</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name === 'cr_acumulado' ? 'CR acumulado' : 'CR do semestre']}
                  contentStyle={{ fontSize: 12, borderRadius: 14, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="cr_periodo" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="cr_acumulado" stroke="hsl(var(--mar))" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Linha cheia: CR acumulado · tracejada: CR de cada semestre</p>
        </div>
      )}

      {(categorias.length > 0 || pendentes.length > 0) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {categorias.length > 0 && (
            <div>
              <h3 className="rotulo mb-2">Carga horária</h3>
              <ul className="space-y-2">
                {categorias.map((c) => {
                  const pct = c.exigido ? Math.min(100, ((c.integralizado ?? 0) / c.exigido) * 100) : 0;
                  return (
                    <li key={c.categoria} className="text-xs">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="font-bold text-foreground">{c.categoria}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {c.integralizado ?? 0}h / {c.exigido}h
                          {c.pendente ? ` · faltam ${c.pendente}h` : ''}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-trilho">
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-mar' : 'bg-foreground')} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {pendentes.length > 0 && (
            <div>
              <h3 className="rotulo mb-2">
                Obrigatórias pendentes <span className="text-muted-foreground">({pendentes.length})</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(showAllPendentes ? pendentes : pendentes.slice(0, 12)).map((p) => (
                  <span
                    key={p.codigo}
                    title={`${p.nome}${p.carga_horaria ? ` · ${p.carga_horaria}h` : ''}`}
                    className={cn(
                      'rounded-full px-2.5 py-1 font-mono text-[11px] font-bold',
                      p.matriculado ? 'bg-mar-claro text-mar-ink' : 'bg-nevoa text-foreground-2',
                    )}
                  >
                    {p.codigo}
                    {p.matriculado && ' · cursando'}
                  </span>
                ))}
                {pendentes.length > 12 && (
                  <button onClick={() => setShowAllPendentes((v) => !v)} className="text-[12px] font-bold text-mar hover:underline">
                    {showAllPendentes ? 'mostrar menos' : `+${pendentes.length - 12}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(horas.data?.dicas?.length ?? 0) > 0 && (
        <ul className="mt-5 space-y-1.5 rounded-[18px] bg-nevoa p-4">
          {horas.data!.dicas.map((dica) => (
            <li key={dica} className="flex gap-2 text-xs text-muted-foreground">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mar" />
              {dica}
            </li>
          ))}
        </ul>
      )}

      {loadingAny && !error && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando o SIGAA (pode levar alguns segundos)…
        </p>
      )}
    </section>
  );
}
