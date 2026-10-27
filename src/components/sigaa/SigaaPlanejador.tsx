import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react';
import { useGrades, useMySections } from '@/hooks/useMySections';
import { codigoDaTurma } from '@/lib/choques';
import { findCorrespondingBlockSections } from '@/lib/blockCourses';
import type { Section } from '@/services/api';
import { useSections } from '@/hooks/useApi';
import { SIGAA_USER_KEY, useSigaaAuth, useSigaaPrevisaoOferta } from '@/hooks/useSigaa';
import { findStaticSection, toEscolhas } from '@/lib/sigaaSync';
import {
  fetchPlanejamentoMatricula,
  fetchSugestaoMatricula,
  simularMatricula,
  type PlanejamentoMatricula,
  type SimulacaoMatricula,
} from '@/services/sigaaApi';
import { toast } from '@/hooks/use-toast';
import { SeloSigaa } from './IndicesSigaa';
import { cn } from '@/lib/utils';
import { tituloCurso } from '@/lib/curso-texto';

export type PainelSigaa = 'sugestao' | 'conferir' | 'previsao' | null;

const ACOES: Array<{ id: Exclude<PainelSigaa, null>; nome: string; Icone: typeof Sparkles }> = [
  { id: 'sugestao', nome: 'Sugerir grade', Icone: Sparkles },
  { id: 'conferir', nome: 'Conferir com o SIGAA', Icone: ShieldCheck },
  { id: 'previsao', nome: 'Previsão', Icone: TrendingUp },
];

/** Botões do SIGAA no topo do Planejador. Sem login não aparecem. */
export function SigaaAcoesPlanejador({ painel, onPainel }: { painel: PainelSigaa; onPainel: (p: PainelSigaa) => void }) {
  const { isLoggedIn } = useSigaaAuth();
  if (!isLoggedIn) return null;
  return (
    <div role="group" aria-label="Com o SIGAA" className="flex flex-wrap items-center gap-2">
      <SeloSigaa />
      {ACOES.map(({ id, nome, Icone }) => (
        <button
          key={id}
          type="button"
          aria-pressed={painel === id}
          onClick={() => onPainel(painel === id ? null : id)}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[12.5px] font-extrabold transition-colors',
            painel === id ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 bg-background text-foreground hover:bg-nevoa',
          )}
        >
          <Icone className="h-3.5 w-3.5" strokeWidth={2.2} />
          {nome}
        </button>
      ))}
    </div>
  );
}

function usePlano() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.fetchQuery<PlanejamentoMatricula>({
      queryKey: [SIGAA_USER_KEY, 'planejamento'],
      queryFn: fetchPlanejamentoMatricula,
      staleTime: 1000 * 60 * 10,
    });
}

function Linha({ ok, alerta, titulo, detalhe }: { ok?: boolean; alerta?: boolean; titulo: string; detalhe: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-[14px] px-3 py-2.5', alerta ? 'bg-dende-claro' : 'bg-nevoa')}>
      <span
        aria-hidden
        className={cn(
          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-black',
          alerta ? 'bg-dende text-foreground' : ok ? 'bg-mar text-white' : 'bg-foreground text-background',
        )}
      >
        {alerta ? '!' : ok ? '✓' : '↗'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-extrabold text-foreground">{titulo}</span>
        <span className="font-mono text-[11px] text-foreground-2">{detalhe}</span>
      </span>
    </div>
  );
}

function Conferir({ sim, naoIdentificadas }: { sim: SimulacaoMatricula; naoIdentificadas: string[] }) {
  const pct = sim.percentual_integralizado_depois;
  return (
    <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
      {sim.choques.map((c, i) => (
        <Linha key={`c${i}`} alerta titulo={`Choque: ${c.turmas.join(' × ')}`} detalhe={`${c.dia} · ${c.horario}`} />
      ))}
      {sim.choques.length === 0 && <Linha ok titulo="Sem choques" detalhe="confere com o SIGAA" />}
      {sim.problemas.map((p) => (
        <Linha key={p} alerta titulo={p} detalhe="regra do SIGAA" />
      ))}
      <Linha
        ok={!sim.excede_ch_maxima}
        alerta={sim.excede_ch_maxima}
        titulo={`${sim.ch_total} h no semestre`}
        detalhe={sim.ch_maxima_periodo ? `máximo do curso: ${sim.ch_maxima_periodo} h` : 'sem limite informado'}
      />
      {typeof pct === 'number' && (
        <Linha titulo={`${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do curso`} detalhe="se aprovar tudo" />
      )}
      {naoIdentificadas.length > 0 && (
        <Linha alerta titulo="Turma não identificada" detalhe={`${naoIdentificadas.join(', ')} · usei a primeira ofertada`} />
      )}
    </div>
  );
}

const TURNOS = [
  { id: 'M', nome: 'Manhã' },
  { id: 'T', nome: 'Tarde' },
  { id: 'N', nome: 'Noite' },
];

function Sugestao({ onFechar }: { onFechar: () => void }) {
  const { criar } = useGrades();
  const { data: allSections = [] } = useSections();
  const getPlano = usePlano();
  const [turnos, setTurnos] = useState<string[]>([]);
  const [optativas, setOptativas] = useState(true);

  const sugerir = useMutation({
    mutationFn: async () => {
      const [sim, plano] = await Promise.all([
        fetchSugestaoMatricula({ turnos: turnos.join(',') || undefined, incluir_optativas: optativas }),
        getPlano(),
      ]);
      return { sim, plano };
    },
  });
  const chave = `${turnos.join(',')}|${optativas}`;
  useEffect(() => {
    sugerir.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const itens = useMemo(
    () => (sugerir.data ? sugerir.data.sim.itens.map((item) => ({ item, section: findStaticSection(item, sugerir.data!.plano, allSections) })) : []),
    [sugerir.data, allSections],
  );

  const usar = () => {
    const achadas = itens.filter((i) => i.section);
    if (achadas.length === 0) return;
    // A sugestão vira uma grade nova: a sua continua do jeito que está, para comparar
    const secoes: Section[] = [];
    for (const { section } of achadas) {
      for (const s of [section!, ...findCorrespondingBlockSections(section!, allSections)]) {
        if (!secoes.some((x) => codigoDaTurma(x) === codigoDaTurma(s))) secoes.push(s);
      }
    }
    criar(secoes, 'Sugestão do SIGAA');
    toast({
      title: 'Sugestão salva como nova grade',
      description: `${achadas.length} turma(s)${achadas.length < itens.length ? `; ${itens.length - achadas.length} fora do catálogo` : ''}. Sua grade anterior continua salva.`,
    });
    onFechar();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {TURNOS.map((t) => {
          const ativo = turnos.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => setTurnos((v) => (ativo ? v.filter((x) => x !== t.id) : [...v, t.id]))}
              className={cn('h-9 rounded-full px-3.5 text-xs font-extrabold', ativo ? 'bg-foreground text-background' : 'bg-nevoa text-foreground-2 hover:bg-trilho')}
            >
              {t.nome}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs font-bold text-foreground-2">
          <input type="checkbox" checked={optativas} onChange={(e) => setOptativas(e.target.checked)} className="accent-mar" />
          Optativas
        </label>
      </div>
      {sugerir.isPending ? (
        <p className="flex items-center gap-2 text-[13px] text-foreground-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Montando a sugestão…
        </p>
      ) : sugerir.isError ? (
        <p className="text-[13px] text-pitanga-ink">{(sugerir.error as Error).message}</p>
      ) : itens.length === 0 ? (
        <p className="text-[13px] text-foreground-2">Nenhuma combinação sem choque com esses filtros.</p>
      ) : (
        <>
          <div className="flex flex-col border-t border-trilho">
            {itens.map(({ item, section }) => (
              <div key={`${item.codigo}-${item.turma_id ?? item.turma}`} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-b border-trilho py-2">
                <span className="font-mono text-xs font-semibold text-mar-ink">
                  {item.codigo}
                  {item.turma && <span className="text-foreground-2"> · T{item.turma}</span>}
                </span>
                <span className="truncate text-[13px] font-bold text-foreground">{section?.course?.name ? tituloCurso(section.course.name) : item.natureza ? item.natureza.toLowerCase() : ''}</span>
                <span className="font-mono text-[11.5px] text-foreground-2">
                  {item.carga_horaria ? `${item.carga_horaria} h` : ''}
                  {!section && <span className="ml-2 font-semibold text-dende-ink">fora do catálogo</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={usar} className="min-h-10 rounded-full bg-foreground px-4 text-[12.5px] font-extrabold text-background hover:bg-foreground/90">
              Salvar como nova grade
            </button>
            <button type="button" onClick={onFechar} className="min-h-10 rounded-full border-[1.5px] border-foreground/20 px-4 text-[12.5px] font-bold text-foreground hover:bg-nevoa">
              Manter a minha
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Previsao() {
  const previsao = useSigaaPrevisaoOferta(true);
  if (previsao.isLoading)
    return (
      <p className="flex items-center gap-2 text-[13px] text-foreground-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Analisando a oferta dos últimos semestres…
      </p>
    );
  if (previsao.isError) return <p className="text-[13px] text-pitanga-ink">{(previsao.error as Error).message}</p>;
  const comps = previsao.data?.componentes ?? [];
  if (comps.length === 0) return <p className="text-[13px] text-foreground-2">Sem histórico de oferta para as suas obrigatórias pendentes.</p>;
  const grupos = [
    { titulo: 'Devem abrir', cor: 'bg-mar', chip: 'bg-mar-claro text-mar-ink', itens: comps.filter((c) => c.previsao?.provavel === true) },
    { titulo: 'Improváveis', cor: 'bg-dende', chip: 'bg-dende-claro text-dende-ink', itens: comps.filter((c) => c.previsao?.provavel === false) },
    { titulo: 'Sem histórico', cor: 'bg-pedra', chip: 'bg-nevoa text-foreground-2', itens: comps.filter((c) => !c.previsao || c.previsao.provavel === null) },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {grupos.map(
        (g) =>
          g.itens.length > 0 && (
            <div key={g.titulo} className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex w-[120px] items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-foreground">
                <span className={cn('h-2 w-2 rounded-full', g.cor)} />
                {g.titulo}
              </span>
              {g.itens.map((c) => (
                <span key={c.codigo} title={[c.nome, c.previsao?.motivo].filter(Boolean).join(' — ')} className={cn('inline-flex gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold', g.chip)}>
                  {c.codigo}
                  {typeof c.previsao?.probabilidade === 'number' && <b className="font-bold">{Math.round(c.previsao.probabilidade * 100)}%</b>}
                </span>
              ))}
            </div>
          ),
      )}
    </div>
  );
}

/** Cartão com o resultado da ação escolhida, acima da grade. */
export function SigaaResultadoPlanejador({ painel, onFechar }: { painel: PainelSigaa; onFechar: () => void }) {
  const { isLoggedIn } = useSigaaAuth();
  const { mySections } = useMySections('ativa');
  const getPlano = usePlano();
  const previsao = useSigaaPrevisaoOferta(isLoggedIn && painel === 'previsao');

  const conferir = useMutation({
    mutationFn: async () => {
      const plano = await getPlano();
      const { escolhas, naoIdentificadas } = toEscolhas(mySections, plano);
      return { sim: await simularMatricula(escolhas), naoIdentificadas };
    },
  });
  const chave = mySections.map((s) => s.id_ref).join(',');
  useEffect(() => {
    if (painel === 'conferir' && mySections.length > 0) conferir.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painel, chave]);

  if (!isLoggedIn || !painel) return null;

  const problemas = conferir.data ? conferir.data.sim.choques.length + conferir.data.sim.problemas.length + (conferir.data.sim.excede_ch_maxima ? 1 : 0) : 0;
  const titulo =
    painel === 'conferir'
      ? mySections.length === 0
        ? 'Adicione turmas para conferir'
        : conferir.data
          ? problemas === 0
            ? 'Pronta para a matrícula'
            : `${problemas} ajuste${problemas > 1 ? 's' : ''} antes da matrícula`
          : 'Conferindo com o SIGAA…'
      : painel === 'sugestao'
        ? 'Grade sugerida pelo SIGAA'
        : `Obrigatórias que faltam${previsao.data?.alvo ? `, em ${previsao.data.alvo}` : ''}`;
  const sub =
    painel === 'conferir' ? 'regras oficiais do curso' : painel === 'sugestao' ? 'sem choque, priorizando atrasadas e as que destravam mais' : 'pela oferta de cada uma desde 2023';

  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] px-5 py-[18px] ring-[1.5px] ring-inset ring-trilho">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className={cn('text-[17px] font-black tracking-[-0.02em]', painel === 'conferir' && problemas > 0 ? 'text-dende-ink' : 'text-foreground')}>{titulo}</span>
          <span className="font-mono text-[11.5px] text-foreground-2">{sub}</span>
        </span>
        <button type="button" aria-label="Fechar" onClick={onFechar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho">
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
      {painel === 'conferir' &&
        mySections.length > 0 &&
        (conferir.isPending ? (
          <p className="flex items-center gap-2 text-[13px] text-foreground-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando o SIGAA…
          </p>
        ) : conferir.isError ? (
          <p className="text-[13px] text-pitanga-ink">{(conferir.error as Error).message}</p>
        ) : conferir.data ? (
          <Conferir sim={conferir.data.sim} naoIdentificadas={conferir.data.naoIdentificadas} />
        ) : null)}
      {painel === 'sugestao' && <Sugestao onFechar={onFechar} />}
      {painel === 'previsao' && <Previsao />}
    </div>
  );
}
