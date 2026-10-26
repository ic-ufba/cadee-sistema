import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Loader2, ShieldCheck, Sparkles, TrendingUp, TriangleAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMySections } from '@/hooks/useMySections';
import { useSections } from '@/hooks/useApi';
import { SIGAA_USER_KEY, useSigaaAuth, useSigaaLoginDialog, useSigaaPrevisaoOferta } from '@/hooks/useSigaa';
import { findStaticSection, toEscolhas } from '@/lib/sigaaSync';
import {
  fetchPlanejamentoMatricula,
  fetchSugestaoMatricula,
  simularMatricula,
  type PlanejamentoMatricula,
  type SimulacaoMatricula,
} from '@/services/sigaaApi';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TURNOS = [
  { id: 'M', label: 'Manhã' },
  { id: 'T', label: 'Tarde' },
  { id: 'N', label: 'Noite' },
];

function usePlanejamentoFetcher() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.fetchQuery<PlanejamentoMatricula>({
      queryKey: [SIGAA_USER_KEY, 'planejamento'],
      queryFn: fetchPlanejamentoMatricula,
      staleTime: 1000 * 60 * 10,
    });
}

function ResultadoSimulacao({ sim }: { sim: SimulacaoMatricula }) {
  return (
    <div className="space-y-3 text-sm">
      <div
        className={cn(
          'flex items-start gap-2 rounded-[18px] p-4',
          sim.valida ? 'bg-mar-claro text-mar-ink' : 'bg-dende-claro text-dende-ink',
        )}
      >
        {sim.valida ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-extrabold">{sim.valida ? 'Grade válida pelas regras do SIGAA' : 'Atenção antes de se matricular'}</p>
          <p className="text-xs opacity-90">
            {sim.ch_total}h no semestre
            {sim.ch_maxima_periodo ? ` · máximo do curso: ${sim.ch_maxima_periodo}h` : ''}
            {typeof sim.percentual_integralizado_depois === 'number'
              ? ` · você chega a ${sim.percentual_integralizado_depois.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do curso`
              : ''}
          </p>
        </div>
      </div>

      {sim.choques.length > 0 && (
        <div>
          <p className="rotulo mb-1.5">Choques de horário</p>
          <ul className="space-y-1">
            {sim.choques.map((c, i) => (
              <li key={i} className="rounded-xl bg-pitanga-tint px-3 py-1.5 text-xs font-semibold text-pitanga-ink">
                {c.turmas.join(' × ')} — {c.dia}, {c.horario}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sim.problemas.length > 0 && (
        <ul className="space-y-1">
          {sim.problemas.map((p) => (
            <li key={p} className="flex gap-2 text-xs text-muted-foreground">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dende" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ValidarTab() {
  const { mySections } = useMySections();
  const getPlano = usePlanejamentoFetcher();

  const validar = useMutation({
    mutationFn: async () => {
      const plano = await getPlano();
      const { escolhas, naoIdentificadas } = toEscolhas(mySections, plano);
      const sim = await simularMatricula(escolhas);
      return { sim, naoIdentificadas };
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Confere a sua grade com as regras oficiais: pré-requisitos (com as suas equivalências), choque de horário, carga horária máxima e
        turmas lotadas. Nada é enviado para a matrícula.
      </p>
      <button
        onClick={() => validar.mutate()}
        disabled={validar.isPending || mySections.length === 0}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {validar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {mySections.length === 0 ? 'Adicione turmas para validar' : validar.isPending ? 'Consultando o SIGAA…' : 'Validar minha grade'}
      </button>
      {validar.isError && <p className="text-xs text-destructive">{validar.error.message}</p>}
      {validar.data && (
        <>
          <ResultadoSimulacao sim={validar.data.sim} />
          {validar.data.naoIdentificadas.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Não achei a turma exata de {validar.data.naoIdentificadas.join(', ')} na oferta reservada ao seu curso; usei a primeira turma
              ofertada para essas.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SugestaoTab() {
  const { mySections, toggleSection, clearSections } = useMySections();
  const { data: allSections = [] } = useSections();
  const getPlano = usePlanejamentoFetcher();
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

  const matches = useMemo(() => {
    if (!sugerir.data) return [];
    return sugerir.data.sim.itens.map((item) => ({
      item,
      section: findStaticSection(item, sugerir.data!.plano, allSections),
    }));
  }, [sugerir.data, allSections]);

  const aplicar = () => {
    const encontradas = matches.filter((m) => m.section);
    if (encontradas.length === 0) return;
    if (mySections.length > 0 && !confirm('Substituir a grade atual pela sugestão do SIGAA?')) return;
    clearSections();
    for (const { section } of encontradas) toggleSection(section!, allSections);
    toast({
      title: 'Sugestão aplicada',
      description: `${encontradas.length} turma(s) adicionada(s) à grade${
        encontradas.length < matches.length ? `; ${matches.length - encontradas.length} não encontrada(s) no catálogo` : ''
      }.`,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Monta uma combinação sem choque, priorizando obrigatórias atrasadas e as que destravam mais disciplinas, até a CH máxima.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {TURNOS.map((t) => {
          const active = turnos.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTurnos((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
              className={cn(
                'h-9 rounded-full px-4 text-xs font-bold transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'bg-nevoa text-foreground-2 hover:bg-trilho',
              )}
            >
              {t.label}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={optativas} onChange={(e) => setOptativas(e.target.checked)} className="accent-mar" />
          Incluir optativas
        </label>
      </div>
      <button
        onClick={() => sugerir.mutate()}
        disabled={sugerir.isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {sugerir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {sugerir.isPending ? 'Montando sugestão…' : 'Sugerir grade'}
      </button>
      {sugerir.isError && <p className="text-xs text-destructive">{sugerir.error.message}</p>}

      {sugerir.data && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma combinação encontrada com esses filtros.</p>
          ) : (
            <ul className="divide-y divide-foreground/10 overflow-hidden rounded-[18px] border-[1.5px] border-foreground/10">
              {matches.map(({ item, section }) => (
                <li key={`${item.codigo}-${item.turma_id ?? item.turma}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <span>
                    <span className="font-mono font-bold text-mar">{item.codigo}</span>
                    {item.turma && <span className="text-muted-foreground"> · T{item.turma}</span>}
                    {item.natureza && <span className="text-muted-foreground"> · {item.natureza.toLowerCase()}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {item.carga_horaria ? `${item.carga_horaria}h` : ''}
                    {!section && <span className="ml-2 font-semibold text-dende-ink">fora do catálogo</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ResultadoSimulacao sim={sugerir.data.sim} />
          {matches.some((m) => m.section) && (
            <button
              onClick={aplicar}
              className="h-11 w-full rounded-full border-[1.5px] border-foreground/20 px-5 text-sm font-bold text-foreground hover:bg-nevoa"
            >
              Usar esta sugestão na grade
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PrevisaoTab({ active }: { active: boolean }) {
  const previsao = useSigaaPrevisaoOferta(active);

  if (previsao.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando a oferta dos últimos semestres…
      </p>
    );
  }
  if (previsao.isError) return <p className="text-xs text-destructive">{previsao.error.message}</p>;
  if (!previsao.data) return null;

  const { alvo, componentes } = previsao.data;
  if (componentes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        O SIGAA não trouxe histórico de oferta para as suas obrigatórias pendentes{previsao.data.avisos[0] ? `: ${previsao.data.avisos[0]}` : '.'}
      </p>
    );
  }
  const grupos = [
    { titulo: 'Devem abrir', cor: 'border-transparent bg-mar-claro text-mar-ink', itens: componentes.filter((c) => c.previsao?.provavel === true) },
    {
      titulo: 'Improváveis',
      cor: 'border-transparent bg-dende-claro text-dende-ink',
      itens: componentes.filter((c) => c.previsao?.provavel === false),
    },
    {
      titulo: 'Sem histórico de oferta',
      cor: 'border-transparent bg-nevoa text-foreground-2',
      itens: componentes.filter((c) => !c.previsao || c.previsao.provavel === null),
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Previsão para <strong className="text-foreground">{alvo || 'o próximo semestre'}</strong> das obrigatórias que você ainda precisa cursar, com base em quando
        cada uma abriu desde 2023.
      </p>
      {grupos.map(
        (g) =>
          g.itens.length > 0 && (
            <div key={g.titulo}>
              <p className="mb-1 text-xs font-medium text-foreground">
                {g.titulo} <span className="text-muted-foreground">({g.itens.length})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.itens.map((c) => (
                  <span
                    key={c.codigo}
                    title={[c.nome, c.previsao?.motivo, c.sem_turma ? 'Atividade: matrícula pelo colegiado' : ''].filter(Boolean).join(' — ')}
                    className={cn('rounded-full border px-2.5 py-1 font-mono text-[11px] font-bold', g.cor)}
                  >
                    {c.codigo}
                    {typeof c.previsao?.probabilidade === 'number' && ` · ${Math.round(c.previsao.probabilidade * 100)}%`}
                  </span>
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}

/** Painel do Planejador que usa as regras oficiais do SIGAA (só aparece com a API configurada). */
export function SigaaPlannerPanel() {
  const { isConfigured, isLoggedIn } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();
  const [tab, setTab] = useState('validar');

  if (!isConfigured) return null;

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-2 rounded-[18px] bg-mar-claro p-4 text-sm sm:flex-row sm:items-center">
        <ShieldCheck className="hidden h-6 w-6 shrink-0 text-mar sm:block" />
        <p className="flex-1 text-muted-foreground">
          Entre com o SIGAA para validar esta grade com as regras oficiais, receber uma sugestão automática e ver a previsão de oferta.
        </p>
        <button onClick={openLogin} className="h-9 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-primary/90">
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border-[1.5px] border-foreground/10 bg-background p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[17px] font-black tracking-[-0.02em] text-foreground">
        <ShieldCheck className="h-4 w-4 text-mar" />
        Conferir com o SIGAA
      </h3>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 grid w-full grid-cols-3">
          <TabsTrigger value="validar" className="text-xs">
            Validar
          </TabsTrigger>
          <TabsTrigger value="sugestao" className="text-xs">
            Sugestão
          </TabsTrigger>
          <TabsTrigger value="previsao" className="text-xs">
            <TrendingUp className="mr-1 h-3.5 w-3.5" />
            Previsão
          </TabsTrigger>
        </TabsList>
        <TabsContent value="validar">
          <ValidarTab />
        </TabsContent>
        <TabsContent value="sugestao">
          <SugestaoTab />
        </TabsContent>
        <TabsContent value="previsao">
          <PrevisaoTab active={tab === 'previsao'} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
