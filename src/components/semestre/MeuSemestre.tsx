import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarDays, ChevronDown, ChevronUp, Columns3, Download, FileText, List, Loader2, Mail } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useSemestreAtual,
  useSigaaAtualizacoes,
  useSigaaAvaliacoes,
  useSigaaFrequencia,
  useSigaaGradeHoraria,
  useSigaaMensagens,
  useSigaaNotas,
  useSigaaTarefas,
} from '@/hooks/useSigaa';
import { useMySections } from '@/hooks/useMySections';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';
import { mapaDeCores, type CorGrade } from '@/lib/grade-cores';
import { abrirDocumentoSigaa } from '@/lib/sigaaActions';
import { tituloCurso } from '@/lib/curso-texto';
import { cn } from '@/lib/utils';
import type { AulaGrade, DocumentoSigaa, EventoCalendario } from '@/services/sigaaApi';

const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function dataLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  const dt = new Date(a, m - 1, d);
  const hora = iso.slice(11, 16);
  if (/^\d\d:\d\d$/.test(hora)) dt.setHours(Number(hora.slice(0, 2)), Number(hora.slice(3, 5)));
  return dt;
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const nota1 = (v: number | null | undefined) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
const minutos = (h: string | null) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : NaN);

/** Cores das disciplinas: as mesmas da grade do Planejador quando a turma também está lá. */
function useCores(codigos: string[]) {
  const { mySections } = useMySections();
  return useMemo(() => {
    const doPlanejador = mySections.map((s) => getBlockCourseBaseCode(s.course?.code || (s as { course_code?: string }).course_code || ''));
    return mapaDeCores([...doPlanejador, ...codigos.map((c) => getBlockCourseBaseCode(c))]);
  }, [mySections, codigos]);
}

const corDe = (mapa: Map<string, CorGrade>, codigo: string | null | undefined) =>
  (codigo && mapa.get(getBlockCourseBaseCode(codigo))) || { bg: 'hsl(var(--tracejado))', fg: 'hsl(var(--foreground))' };

function Titulo({ id, children, extra }: { id: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-xl font-black tracking-[-0.03em] text-foreground lg:text-[22px]">
        {children}
      </h2>
      {extra && <span className="font-mono text-[11.5px] text-foreground-2">{extra}</span>}
    </div>
  );
}

function Estado({ carregando, erro, vazio }: { carregando: boolean; erro: boolean; vazio: string }) {
  if (carregando)
    return (
      <p className="flex items-center gap-2 py-3 text-[13px] text-foreground-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Consultando o SIGAA…
      </p>
    );
  return <p className="py-3 text-[13px] text-foreground-2">{erro ? 'Não foi possível consultar o SIGAA agora.' : vazio}</p>;
}

// ------------------------------------------------------------------ cabeçalho

const EVENTOS_INTERESSANTES = /trancamento|matr[íi]cula|rematr[íi]cula|ajuste|f[ée]rias|recesso|t[ée]rmino|fim|consolida/i;

function eventosDoCalendario(eventos: EventoCalendario[] | undefined) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return (eventos ?? [])
    .filter((e) => e.definido && EVENTOS_INTERESSANTES.test(e.rotulo))
    .map((e) => ({ ...e, ini: dataLocal(e.inicio), end: dataLocal(e.fim) }))
    .filter((e) => (e.end ?? e.ini) && (e.end ?? e.ini)! >= hoje)
    .sort((a, b) => (a.ini?.getTime() ?? 0) - (b.ini?.getTime() ?? 0))
    .slice(0, 6);
}

/** Linha abaixo do título: andamento do semestre e o calendário acadêmico num botão discreto. */
export function SemestreAndamento() {
  const { inicio, fim, semana, totalSemanas, calendario } = useSemestreAtual();
  const eventos = eventosDoCalendario(calendario?.eventos);
  const pct = semana && totalSemanas ? Math.min(100, (semana / totalSemanas) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {inicio && fim && (
        <>
          <span aria-hidden className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-trilho sm:w-[220px]">
            <span className="block h-full rounded-full bg-mar" style={{ width: `${pct}%` }} />
          </span>
          <span className="font-mono text-xs text-foreground-2">
            semana {semana} de {totalSemanas} · aulas até {ddmm(fim)}/{fim.getFullYear()}
          </span>
        </>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-mar-ink underline underline-offset-[3px] hover:bg-mar-claro"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[300px] rounded-2xl px-4 py-2">
          {eventos.length === 0 ? (
            <p className="py-3 text-[13px] text-foreground-2">Nenhuma data definida no calendário do SIGAA.</p>
          ) : (
            eventos.map((e) => (
              <div key={e.rotulo + e.inicio} className="flex items-baseline justify-between gap-3 border-b border-trilho py-2.5 last:border-0">
                <span className="text-[13px] font-bold text-foreground">{e.rotulo}</span>
                <span className="whitespace-nowrap font-mono text-xs font-semibold text-foreground-2">
                  {e.ini && e.end && e.ini.getTime() !== e.end.getTime() ? `${ddmm(e.ini)} – ${ddmm(e.end)}` : ddmm((e.end ?? e.ini)!)}
                </span>
              </div>
            ))
          )}
          <p className="pb-1 pt-2 text-[11.5px] text-foreground-2">Calendário acadêmico da UFBA</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const DOCS: Array<{ tipo: DocumentoSigaa; nome: string }> = [
  { tipo: 'comprovante', nome: 'Comprovante de matrícula' },
  { tipo: 'declaracao', nome: 'Declaração de vínculo' },
  { tipo: 'historico', nome: 'Histórico escolar (PDF)' },
];

/** Documentos (menu fechado) e caixa postal (ícone), discretos no topo. */
export function SemestreAtalhos() {
  const mensagens = useSigaaMensagens();
  const lista = mensagens.data?.mensagens ?? [];
  const novas = lista.filter((m) => m.lida === false).length;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-foreground/15 bg-background px-3 text-xs font-bold text-foreground-2 transition-colors hover:bg-nevoa hover:text-foreground"
          >
            <FileText className="h-3.5 w-3.5" />
            Documentos
            <ChevronDown className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[260px] rounded-[14px] p-1.5">
          {DOCS.map((d) => (
            <DropdownMenuItem
              key={d.tipo}
              onSelect={() => void abrirDocumentoSigaa(d.tipo)}
              className="flex min-h-11 justify-between rounded-[10px] px-2.5 text-[13px] font-bold"
            >
              {d.nome}
              <Download className="h-4 w-4" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={novas ? `Caixa postal do SIGAA, ${novas} mensagens novas` : 'Caixa postal do SIGAA'}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-foreground/15 bg-background text-foreground-2 transition-colors hover:bg-nevoa hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            {novas > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mar px-1 text-[10px] font-extrabold text-white">
                {novas}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] rounded-[14px] px-3.5 py-1.5">
          {mensagens.isLoading || mensagens.isError || lista.length === 0 ? (
            <Estado carregando={mensagens.isLoading} erro={mensagens.isError} vazio="Nenhuma mensagem na caixa postal." />
          ) : (
            lista.slice(0, 4).map((m) => (
              <div key={(m.id ?? '') + m.assunto} className="flex flex-col gap-0.5 border-b border-trilho py-2.5 last:border-0">
                <span className="flex justify-between gap-2 text-xs font-bold text-foreground-2">
                  <span className="truncate">{m.remetente}</span>
                  {m.data && <span className="font-mono font-normal">{ddmm(dataLocal(m.data)!)}</span>}
                </span>
                <span className={cn('text-[13px] text-foreground', m.lida === false ? 'font-black' : 'font-bold')}>{m.assunto}</span>
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ------------------------------------------------------------------ conteúdo

type VisaoAulas = 'hoje' | 'grade' | 'lista';
const VISAO_KEY = 'cadee:meuSemestreVisao';

function lerVisaoAulas(): VisaoAulas {
  try {
    const v = localStorage.getItem(VISAO_KEY);
    return v === 'grade' || v === 'lista' ? v : 'hoje';
  } catch {
    return 'hoje';
  }
}

/** Junta horários seguidos da mesma turma no mesmo dia (07:00–07:55 + 07:55–08:50 → 07:00–08:50). */
function juntarAulas(aulas: AulaGrade[]): AulaGrade[] {
  const ordenadas = [...aulas].sort((a, b) => a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio));
  const out: AulaGrade[] = [];
  for (const a of ordenadas) {
    const ult = out[out.length - 1];
    if (ult && ult.dia === a.dia && ult.codigo === a.codigo && ult.fim && ult.fim === a.inicio) out[out.length - 1] = { ...ult, fim: a.fim };
    else if (!(ult && ult.dia === a.dia && ult.codigo === a.codigo && ult.inicio === a.inicio)) out.push(a);
  }
  return out;
}

const VISOES: Array<{ v: VisaoAulas; rotulo: string; Icone: typeof List }> = [
  { v: 'hoje', rotulo: 'Hoje', Icone: CalendarCheck },
  { v: 'grade', rotulo: 'Grade', Icone: Columns3 },
  { v: 'lista', rotulo: 'Lista', Icone: List },
];

function SeletorVisao({ visao, onVisao }: { visao: VisaoAulas; onVisao: (v: VisaoAulas) => void }) {
  return (
    <div role="group" aria-label="Visualização das aulas" className="flex rounded-full bg-nevoa p-1">
      {VISOES.map(({ v, rotulo, Icone }) => {
        const ativo = visao === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={ativo}
            onClick={() => onVisao(v)}
            className={cn(
              'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
              ativo ? 'bg-primary text-primary-foreground' : 'text-foreground-2 hover:text-foreground',
            )}
          >
            <Icone className="h-3.5 w-3.5" />
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

function CartaoAulaHoje({ a, cores, min }: { a: AulaGrade; cores: Map<string, CorGrade>; min: number }) {
  const cor = corDe(cores, a.codigo);
  const ativa = min >= minutos(a.inicio) && min <= minutos(a.fim);
  return (
    <div className={cn('grid grid-cols-[6px_minmax(0,1fr)] gap-3.5 rounded-2xl py-3.5 pl-3.5 pr-4', ativa ? 'bg-ouro/15' : 'bg-nevoa')}>
      <span className="rounded-full" style={{ background: cor.bg }} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-foreground">
            {a.inicio} – {a.fim}
          </span>
          {ativa && <span className="rounded-full bg-dende px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-foreground">AGORA</span>}
        </span>
        <span className="text-sm font-extrabold leading-tight text-foreground">{tituloCurso(a.nome)}</span>
        <span className="text-xs text-foreground-2">{[a.codigo, a.local].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  );
}

function BlocoGrade({ a, cores, hoje }: { a: AulaGrade; cores: Map<string, CorGrade>; hoje: boolean }) {
  return (
    <div
      className={cn('flex flex-col gap-1 rounded-b-[10px] border-t-4 px-2.5 pb-3 pt-2.5', hoje ? 'bg-ouro/15' : 'bg-nevoa')}
      style={{ borderTopColor: corDe(cores, a.codigo).bg }}
    >
      <span className="font-mono text-[11px] text-foreground-2">
        {a.inicio} – {a.fim}
      </span>
      <span className="line-clamp-3 text-[12px] font-extrabold uppercase leading-tight text-foreground">{a.nome}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{[a.codigo, a.local].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

function Aulas({
  aulas: brutas,
  cores,
  carregando,
  erro,
  visao,
  onVisao,
}: {
  aulas: AulaGrade[];
  cores: Map<string, CorGrade>;
  carregando: boolean;
  erro: boolean;
  visao: VisaoAulas;
  onVisao: (v: VisaoAulas) => void;
}) {
  const aulas = useMemo(() => juntarAulas(brutas), [brutas]);
  const agora = new Date();
  const diaSigaa = agora.getDay() + 1; // SIGAA: 1 = domingo … 7 = sábado
  const min = agora.getHours() * 60 + agora.getMinutes();
  const hoje = aulas.filter((a) => a.dia === diaSigaa);
  const amanha = aulas.filter((a) => a.dia === (diaSigaa % 7) + 1);

  // Grade: segunda a sábado (domingo só se houver aula)
  const segunda = new Date(agora);
  segunda.setDate(agora.getDate() - ((agora.getDay() + 6) % 7));
  const dias = [2, 3, 4, 5, 6, 7, ...(aulas.some((a) => a.dia === 1) ? [1] : [])].map((dia) => {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + (dia === 1 ? 6 : dia - 2));
    return { dia, curto: DIAS[dia - 1], data: ddmm(data), hoje: dia === diaSigaa, aulas: aulas.filter((a) => a.dia === dia) };
  });
  const [diaMobile, setDiaMobile] = useState<number | null>(null);
  const diaPadrao = dias.find((d) => d.hoje && d.aulas.length)?.dia ?? dias.find((d) => d.aulas.length)?.dia ?? dias[0].dia;
  const diaAtivo = dias.find((d) => d.dia === (diaMobile ?? diaPadrao)) ?? dias[0];

  // Lista: uma linha por disciplina
  const disciplinas = useMemo(() => {
    const m = new Map<string, { codigo: string; nome: string; turma: string | null; local: string | null; horarios: AulaGrade[] }>();
    for (const a of aulas) {
      const chave = a.codigo ?? a.nome;
      const d = m.get(chave) ?? { codigo: a.codigo ?? '', nome: a.nome, turma: a.turma, local: a.local, horarios: [] };
      d.horarios.push(a);
      m.set(chave, d);
    }
    return [...m.values()];
  }, [aulas]);

  return (
    <section aria-labelledby="ms-aulas" className={cn('flex flex-col gap-3 py-6', visao === 'hoje' && 'lg:pr-8')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <h2 id="ms-aulas" className="text-xl font-black tracking-[-0.03em] text-foreground lg:text-[22px]">
          {visao === 'hoje' ? 'Hoje' : 'Aulas da semana'}
        </h2>
        <SeletorVisao visao={visao} onVisao={onVisao} />
      </div>

      {carregando || erro ? (
        <Estado carregando={carregando} erro={erro} vazio="" />
      ) : aulas.length === 0 ? (
        <p className="rounded-2xl bg-nevoa px-4 py-3.5 text-[13px] font-semibold text-foreground-2">Nenhuma aula com horário no SIGAA.</p>
      ) : visao === 'hoje' ? (
        <>
          <span className="-mt-1 font-mono text-[11.5px] text-foreground-2">
            {DIAS_LONGOS[agora.getDay()]}, {ddmm(agora)}
          </span>
          {hoje.length === 0 ? (
            <p className="rounded-2xl bg-nevoa px-4 py-3.5 text-[13px] font-semibold text-foreground-2">Sem aulas hoje.</p>
          ) : (
            hoje.map((a) => <CartaoAulaHoje key={`${a.codigo}-${a.inicio}`} a={a} cores={cores} min={min} />)
          )}
          {amanha.length > 0 && (
            <span className="text-xs text-foreground-2">
              Amanhã: {Array.from(new Set(amanha.map((a) => a.codigo))).join(' e ')} a partir das {amanha[0].inicio}
            </span>
          )}
        </>
      ) : visao === 'grade' ? (
        <>
          {/* desktop: semana em colunas */}
          <div className="hidden overflow-x-auto md:block">
            <div className="flex min-w-[760px] border-t border-foreground/10">
              {dias.map((d, i) => (
                <div key={d.dia} className={cn('flex min-w-0 flex-1 flex-col gap-3 px-3 pb-2 pt-4', i > 0 && 'border-l border-foreground/10')}>
                  <div className="flex min-h-[22px] items-center justify-between gap-1">
                    <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                      {d.curto} <span className="font-mono text-[11px] font-medium tracking-normal text-muted-foreground">{d.data}</span>
                    </span>
                    {d.hoje && (
                      <span className="rounded-full bg-dende px-[7px] py-[3px] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1C1B19]">Hoje</span>
                    )}
                  </div>
                  {d.aulas.length === 0 ? (
                    <span className="text-xs font-medium text-muted-foreground/70">Livre</span>
                  ) : (
                    d.aulas.map((a) => <BlocoGrade key={`${a.codigo}-${a.inicio}`} a={a} cores={cores} hoje={d.hoje} />)
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* mobile: dia a dia */}
          <div className="md:hidden">
            <div role="tablist" aria-label="Dias" className="flex border-b border-foreground/10">
              {dias.map((d) => {
                const ativo = d.dia === diaAtivo.dia;
                const coresDia = Array.from(new Set(d.aulas.map((a) => corDe(cores, a.codigo).bg))).slice(0, 4);
                return (
                  <button
                    key={d.dia}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setDiaMobile(d.dia)}
                    className={cn(
                      'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 rounded-t-xl transition-colors',
                      ativo ? 'bg-primary text-primary-foreground' : 'text-foreground-2',
                    )}
                  >
                    <span className="text-xs font-black">{d.curto}</span>
                    <span className="flex min-h-[6px] gap-[3px]">
                      {coresDia.map((c, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2.5 pt-3.5">
              <span className="font-mono text-[11px] text-foreground-2">
                {diaAtivo.hoje ? 'hoje · ' : ''}
                {diaAtivo.data} · {diaAtivo.aulas.length} {diaAtivo.aulas.length === 1 ? 'aula' : 'aulas'}
              </span>
              {diaAtivo.aulas.length === 0 ? (
                <p className="py-4 text-center text-sm font-medium text-muted-foreground">Nenhuma aula neste dia</p>
              ) : (
                diaAtivo.aulas.map((a) => <CartaoAulaHoje key={`${a.codigo}-${a.inicio}`} a={a} cores={cores} min={diaAtivo.hoje ? min : -1} />)
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col border-t border-foreground/10">
          {disciplinas.map((d) => {
            const diasCurto = Array.from(new Set(d.horarios.map((h) => DIAS[h.dia - 1])));
            const quando = `${diasCurto.join(' ')} · ${d.horarios[0].inicio}–${d.horarios[0].fim}`;
            return (
              <div
                key={d.codigo || d.nome}
                className="flex min-h-[56px] items-center gap-3 border-b border-foreground/10 px-2.5 py-2 md:grid md:min-h-[52px] md:grid-cols-[12px_96px_minmax(0,1fr)_200px_160px] md:gap-4 md:px-3.5 md:py-0"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, d.codigo).bg }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:contents">
                  <span className="font-mono text-[12px] font-semibold text-foreground md:text-[13px]">
                    {d.codigo}
                    <span className="font-normal text-muted-foreground md:hidden"> · {quando}</span>
                  </span>
                  <span className="truncate text-[12px] font-extrabold uppercase text-foreground md:text-[13px]">{d.nome}</span>
                  <span className="hidden truncate font-mono text-[11px] text-foreground-2 md:block">{quando}</span>
                  <span className="truncate text-xs text-foreground-2">{[d.turma && `Turma ${d.turma}`, d.local].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Prazos({ primeira = false }: { primeira?: boolean }) {
  const avaliacoes = useSigaaAvaliacoes();
  const tarefas = useSigaaTarefas();
  const itens = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const provas = (avaliacoes.data ?? []).map((a) => ({
      quando: dataLocal(a.data),
      titulo: a.descricao,
      detalhe: [a.turma_codigo, a.hora].filter(Boolean).join(' · '),
      tipo: 'Prova' as const,
    }));
    const tarefasL = (tarefas.data ?? []).map((t) => {
      const fim = dataLocal(t.fim);
      return {
        quando: fim,
        titulo: t.titulo,
        detalhe: [t.turma_codigo, fim && (fim.getHours() || fim.getMinutes()) ? `até ${String(fim.getHours()).padStart(2, '0')}:${String(fim.getMinutes()).padStart(2, '0')}` : null, t.enviada ? 'enviada' : 'não enviada']
          .filter(Boolean)
          .join(' · '),
        tipo: t.enviada ? ('Enviada' as const) : ('Tarefa' as const),
      };
    });
    return [...provas, ...tarefasL]
      .filter((i) => i.quando && i.quando >= hoje)
      .sort((a, b) => a.quando!.getTime() - b.quando!.getTime())
      .slice(0, 6);
  }, [avaliacoes.data, tarefas.data]);

  const carregando = avaliacoes.isLoading || tarefas.isLoading;
  const erro = avaliacoes.isError && tarefas.isError;
  const PILL = { Prova: 'bg-foreground text-background', Tarefa: 'bg-dende-claro text-dende-ink', Enviada: 'bg-mar-claro text-mar-ink' };

  return (
    <section aria-labelledby="ms-prazos" className={cn('flex flex-col gap-2 border-foreground/10 py-6', primeira ? 'lg:pr-8' : 'lg:border-l lg:px-8')}>
      <Titulo id="ms-prazos" extra="provas e tarefas">
        Próximos prazos
      </Titulo>
      {carregando || erro || itens.length === 0 ? (
        <Estado carregando={carregando} erro={erro} vazio="Nenhuma prova ou tarefa pela frente." />
      ) : (
        <div className="flex flex-col">
          {itens.map((i, n) => (
            <div key={n} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-trilho py-2.5">
              <span className="flex flex-col items-center rounded-xl bg-nevoa py-1.5">
                <span className="text-[10px] font-extrabold tracking-[0.08em] text-foreground-2">{DIAS[i.quando!.getDay()]}</span>
                <span className="text-lg font-black leading-tight text-foreground">{String(i.quando!.getDate()).padStart(2, '0')}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-extrabold text-foreground">{i.titulo}</span>
                <span className="font-mono text-[11.5px] text-foreground-2">{i.detalhe}</span>
              </span>
              <span className={cn('rounded-full px-2.5 py-[3px] text-[10.5px] font-extrabold', PILL[i.tipo])}>{i.tipo === 'Enviada' ? 'Tarefa' : i.tipo}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Novidades({ cores, idParaCodigo }: { cores: Map<string, CorGrade>; idParaCodigo: Map<number, string> }) {
  const atualizacoes = useSigaaAtualizacoes();
  const lista = (atualizacoes.data ?? []).slice(0, 5);
  return (
    <section aria-labelledby="ms-novidades" className="flex flex-col gap-2 border-foreground/10 py-6 lg:border-l lg:pl-8">
      <Titulo id="ms-novidades">Novidades das turmas</Titulo>
      {atualizacoes.isLoading || atualizacoes.isError || lista.length === 0 ? (
        <Estado carregando={atualizacoes.isLoading} erro={atualizacoes.isError} vazio="Nada novo nas turmas." />
      ) : (
        <div className="flex flex-col">
          {lista.map((n, i) => {
            const codigo = n.turma_id ? idParaCodigo.get(n.turma_id) : undefined;
            return (
              <div key={i} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-trilho py-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: corDe(cores, codigo).bg }} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-bold text-foreground">{n.titulo || n.tipo}</span>
                  <span className="truncate font-mono text-[11.5px] text-foreground-2">
                    {[n.tipo, codigo ?? tituloCurso(n.turma)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {n.data && <span className="font-mono text-[11.5px] text-foreground-2">{ddmm(dataLocal(n.data)!)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NotasFrequencia({ cores }: { cores: Map<string, CorGrade> }) {
  const notas = useSigaaNotas();
  const frequencia = useSigaaFrequencia();
  const atualizacoes = useSigaaAtualizacoes();
  const [aberta, setAberta] = useState<string | null>(null);

  const linhas = useMemo(() => {
    const freq = new Map((frequencia.data ?? []).map((f) => [f.turma_id ?? f.codigo, f]));
    return (notas.data ?? []).map((n) => {
      const f = freq.get(n.turma_id ?? n.codigo)?.frequencia;
      const lancadas = n.unidades.map((u) => u.nota).filter((v): v is number => typeof v === 'number');
      const media = n.resultado ?? (lancadas.length ? lancadas.reduce((a, b) => a + b, 0) / lancadas.length : null);
      const max = f?.max_faltas ?? null;
      const faltas = f?.total_faltas ?? n.faltas ?? 0;
      const avaliacoes = n.unidades.flatMap((u) =>
        u.avaliacoes.length ? u.avaliacoes.map((a) => ({ nome: a.denominacao || a.abreviacao, nota: a.nota })) : [{ nome: u.rotulo, nota: u.nota }],
      );
      return {
        chave: String(n.turma_id ?? n.codigo),
        turmaId: n.turma_id,
        codigo: n.codigo ?? '',
        nome: tituloCurso(n.nome ?? ''),
        unidades: n.unidades.slice(0, 3),
        media,
        parcial: n.resultado === null && lancadas.length > 0,
        lancadas: n.lancadas,
        faltas,
        max,
        risco: max ? faltas / max >= 0.5 : false,
        avaliacoes,
      };
    });
  }, [notas.data, frequencia.data]);

  return (
    <section aria-labelledby="ms-notas" className="flex flex-col gap-3.5 border-t-2 border-foreground pt-6">
      <Titulo id="ms-notas" extra="toque numa turma para ver as avaliações">
        Notas e frequência
      </Titulo>
      {notas.isLoading || notas.isError || linhas.length === 0 ? (
        <Estado carregando={notas.isLoading} erro={notas.isError} vazio="Nenhuma turma neste semestre." />
      ) : (
        <div role="list" className="flex flex-col gap-2 lg:gap-0">
          <div aria-hidden className="hidden grid-cols-[12px_minmax(0,1fr)_240px_80px_220px_20px] gap-4 border-b border-trilho px-3.5 pb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-foreground-2 lg:grid">
            <span />
            <span>Turma</span>
            <span>Unidades</span>
            <span>Média</span>
            <span>Frequência</span>
            <span />
          </div>
          {linhas.map((l) => {
            const cor = corDe(cores, l.codigo);
            const aberto = aberta === l.chave;
            const novidades = (atualizacoes.data ?? []).filter((a) => l.turmaId && a.turma_id === l.turmaId).slice(0, 3);
            const freqPct = l.max ? Math.max(4, 100 - Math.round((l.faltas / (l.max * 2)) * 100)) : 100;
            return (
              <div
                role="listitem"
                key={l.chave}
                className={cn('rounded-2xl lg:rounded-none lg:border-b lg:border-trilho', aberto && 'lg:bg-nevoa/40')}
                style={{ boxShadow: `inset 4px 0 0 ${cor.bg}` }}
              >
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => setAberta(aberto ? null : l.chave)}
                  className="flex w-full flex-col gap-2 rounded-2xl py-3 pl-[18px] pr-3.5 text-left ring-1 ring-inset ring-trilho lg:grid lg:grid-cols-[12px_minmax(0,1fr)_240px_80px_220px_20px] lg:items-center lg:gap-4 lg:rounded-none lg:px-3.5 lg:py-3.5 lg:ring-0"
                >
                  <span aria-hidden className="hidden lg:block" />
                  <span className="flex items-start justify-between gap-2.5 lg:block lg:min-w-0">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[11.5px] font-semibold text-foreground-2">{l.codigo}</span>
                      <span className="text-[13.5px] font-extrabold leading-tight text-foreground lg:truncate lg:text-sm">{l.nome}</span>
                    </span>
                    <span className="text-[22px] font-black tracking-[-0.04em] text-foreground lg:hidden">{nota1(l.media)}</span>
                  </span>
                  <span className="hidden gap-1.5 lg:flex">
                    {l.unidades.map((u) => (
                      <span key={u.rotulo} className="flex min-w-16 flex-col gap-0.5 rounded-[10px] bg-nevoa px-2 py-1.5">
                        <span className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-foreground-2">{u.rotulo}</span>
                        <span className={cn('font-mono text-[13px] font-bold', typeof u.nota === 'number' && u.nota < 5 ? 'text-pitanga' : u.nota === null ? 'text-muted-foreground' : 'text-foreground')}>
                          {nota1(u.nota)}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className={cn('hidden text-[22px] font-black tracking-[-0.04em] lg:block', typeof l.media === 'number' && l.media < 5 ? 'text-pitanga' : 'text-foreground')}>
                    {nota1(l.media)}
                  </span>
                  <span className="flex items-center gap-2.5 lg:flex-col lg:items-stretch lg:gap-1.5">
                    <span className="flex h-[5px] flex-1 overflow-hidden rounded-full bg-trilho lg:h-1.5 lg:flex-none">
                      <span className={cn('rounded-full', l.risco ? 'bg-dende' : 'bg-mar')} style={{ width: `${freqPct}%` }} />
                    </span>
                    <span className={cn('font-mono text-[11px] lg:text-[11.5px]', l.risco ? 'text-dende-ink' : 'text-foreground-2')}>
                      {l.max ? `${l.faltas} de ${l.max} faltas` : `${l.faltas} faltas`}
                      {l.risco && <span className="hidden lg:inline"> · atenção</span>}
                    </span>
                  </span>
                  {aberto ? <ChevronUp className="hidden h-4 w-4 lg:block" /> : <ChevronDown className="hidden h-4 w-4 lg:block" />}
                </button>
                {aberto && (
                  <div className="grid gap-5 pb-4 pl-[18px] pr-3.5 lg:grid-cols-2 lg:gap-8 lg:pb-5 lg:pl-[42px]">
                    <div className="flex flex-col gap-1.5">
                      <span className="rotulo">Avaliações</span>
                      {!l.lancadas || l.avaliacoes.every((a) => a.nota === null) ? (
                        <span className="text-[13px] text-foreground-2">Notas ainda não lançadas.</span>
                      ) : (
                        l.avaliacoes.map((a, i) => (
                          <span key={i} className="flex justify-between gap-3 border-b border-trilho py-1.5 text-[13px]">
                            <span>{a.nome}</span>
                            <span className="font-mono font-bold">{nota1(a.nota)}</span>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="rotulo">Na turma virtual</span>
                      {novidades.length === 0 ? (
                        <span className="text-[13px] text-foreground-2">Nada publicado recentemente.</span>
                      ) : (
                        novidades.map((n, i) => (
                          <span key={i} className="flex items-baseline gap-2.5 border-b border-trilho py-1.5 text-[13px]">
                            <span className="shrink-0 rounded-full bg-nevoa px-2 py-0.5 text-[10.5px] font-extrabold text-foreground-2">{n.tipo}</span>
                            <span className="flex-1">{n.titulo}</span>
                            {n.data && <span className="font-mono text-[11.5px] text-foreground-2">{ddmm(dataLocal(n.data)!)}</span>}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** "Meu semestre": o portal do aluno com os dados do semestre em andamento, vindos do SIGAA. */
export function MeuSemestre() {
  const grade = useSigaaGradeHoraria();
  const notas = useSigaaNotas();
  const aulas = useMemo(() => grade.data?.aulas ?? [], [grade.data]);
  const codigos = useMemo(
    () => [...aulas.map((a) => a.codigo ?? ''), ...(notas.data ?? []).map((n) => n.codigo ?? '')].filter(Boolean),
    [aulas, notas.data],
  );
  const cores = useCores(codigos);
  const idParaCodigo = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of aulas) if (a.turma_id && a.codigo) m.set(a.turma_id, a.codigo);
    for (const n of notas.data ?? []) if (n.turma_id && n.codigo) m.set(n.turma_id, n.codigo);
    return m;
  }, [aulas, notas.data]);

  const [visao, setVisao] = useState<VisaoAulas>(lerVisaoAulas);
  const trocarVisao = (v: VisaoAulas) => {
    setVisao(v);
    try {
      localStorage.setItem(VISAO_KEY, v);
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  };
  const blocoAulas = (
    <Aulas aulas={aulas} cores={cores} carregando={grade.isLoading} erro={grade.isError} visao={visao} onVisao={trocarVisao} />
  );

  return (
    <div className="flex flex-col gap-2 pb-10">
      {visao === 'hoje' ? (
        <div className="grid border-t-2 border-foreground lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
          {blocoAulas}
          <div className="border-t-2 border-foreground lg:contents lg:border-0">
            <Prazos />
          </div>
          <div className="border-t-2 border-foreground lg:contents lg:border-0">
            <Novidades cores={cores} idParaCodigo={idParaCodigo} />
          </div>
        </div>
      ) : (
        <>
          <div className="border-t-2 border-foreground">{blocoAulas}</div>
          <div className="grid border-t-2 border-foreground lg:grid-cols-2">
            <Prazos primeira />
            <div className="border-t-2 border-foreground lg:contents lg:border-0">
              <Novidades cores={cores} idParaCodigo={idParaCodigo} />
            </div>
          </div>
        </>
      )}
      <NotasFrequencia cores={cores} />
      <p className="mt-6 flex items-center gap-2.5 border-t border-trilho pt-4 text-xs text-foreground-2">
        <span className="h-[7px] w-[7px] rounded-full bg-mar" />
        Dados do SIGAA
      </p>
    </div>
  );
}
