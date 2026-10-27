import { useEffect, useMemo, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useSigaaAuth, useSigaaCargaHoraria, useSigaaHistorico, useSigaaIndices, useSigaaIntegralizacao } from '@/hooks/useSigaa';
import { simularIndices } from '@/services/sigaaApi';
import { cn } from '@/lib/utils';

const fmt = (v: number | null | undefined, casas = 2) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '—';

/** Selo discreto que marca o que veio do SIGAA. */
export function SeloSigaa({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[5px] rounded-full bg-mar-claro px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-mar-ink', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-mar" />
      SIGAA
    </span>
  );
}

/** CR de cada período (para a lista de Aproveitamento). Vazio sem login. */
export function useCrPorPeriodo() {
  const { isLoggedIn } = useSigaaAuth();
  const indices = useSigaaIndices(isLoggedIn);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const p of indices.data?.evolucao ?? []) if (typeof p.cr_periodo === 'number') m.set(p.periodo, p.cr_periodo);
    return m;
  }, [indices.data]);
}

/** Horas complementares em análise pela coordenação (só com login). */
export function useComplementaresEmAnalise() {
  const { isLoggedIn } = useSigaaAuth();
  const horas = useSigaaCargaHoraria(isLoggedIn);
  return horas.data?.atividades_em_analise_ch ?? 0;
}

function Simulador({ crAtual }: { crAtual: number | null }) {
  const historico = useSigaaHistorico();
  const cursando = useMemo(
    () => (historico.data?.componentes ?? []).filter((c) => c.cursando || c.situacao?.toUpperCase().startsWith('MATR')),
    [historico.data],
  );
  const [notas, setNotas] = useState<Record<string, number>>({});
  const valores = useMemo(() => {
    const v: Record<string, number> = {};
    for (const c of cursando) v[c.codigo] = notas[c.codigo] ?? 7;
    return v;
  }, [cursando, notas]);

  const simular = useMutation({
    mutationFn: () =>
      simularIndices(cursando.map((c) => ({ codigo: c.codigo, nota: valores[c.codigo], carga_horaria: c.carga_horaria ?? undefined }))),
  });
  const chave = JSON.stringify(valores);
  useEffect(() => {
    if (cursando.length === 0) return;
    const t = setTimeout(() => simular.mutate(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const ajusta = (codigo: string, d: number) =>
    setNotas((n) => ({ ...n, [codigo]: Math.max(0, Math.min(10, Math.round(((n[codigo] ?? 7) + d) * 2) / 2)) }));

  const crSim = simular.data?.cr_simulado ?? null;

  if (historico.isLoading) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-foreground-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo as disciplinas em curso…
      </p>
    );
  }
  if (cursando.length === 0) return <p className="text-[13px] text-foreground-2">Nenhuma disciplina em curso no SIGAA para simular.</p>;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
        {cursando.map((c) => (
          <div key={c.codigo} title={c.nome} className="flex items-center justify-between gap-1.5 rounded-xl bg-background px-2.5 py-2">
            <span className="font-mono text-[11.5px] font-semibold text-mar-ink">{c.codigo}</span>
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                aria-label={`Diminuir nota de ${c.codigo}`}
                onClick={() => ajusta(c.codigo, -0.5)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-nevoa text-sm font-extrabold text-foreground hover:bg-trilho"
              >
                −
              </button>
              <span className="w-[30px] text-center font-mono text-[13px] font-bold">{fmt(valores[c.codigo], 1)}</span>
              <button
                type="button"
                aria-label={`Aumentar nota de ${c.codigo}`}
                onClick={() => ajusta(c.codigo, 0.5)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-nevoa text-sm font-extrabold text-foreground hover:bg-trilho"
              >
                +
              </button>
            </span>
          </div>
        ))}
      </div>
      <span className="flex items-baseline justify-between gap-2.5 whitespace-nowrap lg:justify-start">
        <span className="rotulo !text-foreground">CR depois</span>
        <span
          className={cn(
            'numero text-[32px] leading-none',
            crSim === null ? 'text-muted-foreground' : crAtual !== null && crSim < crAtual ? 'text-pitanga' : 'text-mar-ink',
          )}
          aria-live="polite"
        >
          {simular.isPending && crSim === null ? '…' : fmt(crSim)}
        </span>
      </span>
    </div>
  );
}

/**
 * Faixa de índices oficiais (CR, IAP, extensão, prazo) que entra no Progresso quando o SIGAA está conectado.
 * O simulador de CR só abre se o aluno pedir.
 */
export function IndicesSigaa() {
  const { isLoggedIn } = useSigaaAuth();
  const indices = useSigaaIndices(isLoggedIn);
  const integralizacao = useSigaaIntegralizacao(isLoggedIn);
  const horas = useSigaaCargaHoraria(isLoggedIn);
  const [simAberto, setSimAberto] = useState(false);

  if (!isLoggedIn) return null;

  const evolucao = indices.data?.evolucao ?? [];
  const ult = evolucao.filter((p) => typeof p.cr_acumulado === 'number').slice(-2);
  const delta = ult.length === 2 ? (ult[1].cr_acumulado as number) - (ult[0].cr_acumulado as number) : null;
  const cr = indices.data?.oficiais.cr ?? null;

  const celula = 'flex flex-col gap-2 py-4 lg:flex-[1_1_200px] lg:gap-2.5 lg:border-l lg:border-foreground/10 lg:px-7 lg:pb-1.5 lg:pt-5 lg:first:border-l-0 lg:first:pl-0';
  const valor = 'numero text-[30px] leading-[0.9] text-foreground lg:text-[32px]';
  const detalhe = 'font-mono text-[11px] text-foreground-2';

  return (
    <section aria-label="Índices do SIGAA" className="mt-6 border-t border-foreground/10">
      <div className="grid grid-cols-2 gap-x-4 lg:flex lg:flex-wrap">
        <div className={celula}>
          <span className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground lg:text-[11px] lg:tracking-[0.12em]">
            CR <SeloSigaa />
          </span>
          <span className={valor}>{indices.isLoading ? '…' : fmt(cr)}</span>
          {delta !== null && (
            <span className={detalhe}>
              {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))} em {ult[1].periodo}
            </span>
          )}
          <button
            type="button"
            aria-expanded={simAberto}
            onClick={() => setSimAberto((v) => !v)}
            className="mt-0.5 inline-flex min-h-[30px] items-center gap-1.5 self-start rounded-full border-[1.5px] border-mar/35 px-3 text-[11.5px] font-bold text-mar-ink transition-colors hover:bg-mar-claro"
          >
            <Calculator className="h-3.5 w-3.5" />
            {simAberto ? 'Fechar simulação' : 'Simular CR'}
          </button>
        </div>
        <div className={celula}>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground lg:text-[11px] lg:tracking-[0.12em]">IAP</span>
          <span className={valor}>{indices.isLoading ? '…' : fmt(indices.data?.oficiais.iap)}</span>
          <span className={detalhe}>índice de aproveitamento</span>
        </div>
        <div className={celula}>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground lg:text-[11px] lg:tracking-[0.12em]">Extensão</span>
          <span className={valor}>{horas.isLoading ? '…' : `${horas.data?.extensao_total_ch ?? 0} h`}</span>
          <span className={detalhe}>carga extensionista registrada</span>
        </div>
        <div className={celula}>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground lg:text-[11px] lg:tracking-[0.12em]">Prazo</span>
          <span className={valor}>{integralizacao.isLoading ? '…' : integralizacao.data?.prazo_conclusao_padrao ?? '—'}</span>
          <span className={detalhe}>conclusão no tempo padrão</span>
        </div>
      </div>
      {simAberto && (
        <div role="region" aria-label="Simular CR" className="mt-3 rounded-[18px] bg-nevoa px-4 py-3.5">
          <Simulador crAtual={cr} />
        </div>
      )}
    </section>
  );
}
