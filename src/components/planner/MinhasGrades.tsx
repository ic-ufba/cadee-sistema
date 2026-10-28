import { useMemo, useState } from 'react';
import { AlertTriangle, Columns2, Copy, MoreHorizontal, Pencil, Plus, Rows3, Star, Trash2, CalendarRange } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGrades, type GradeSalva } from '@/hooks/useMySections';
import type { Section } from '@/services/api';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';
import { mapaDeCores } from '@/lib/grade-cores';
import {
  codigoDaTurma,
  codigosUnitarios,
  encontrarChoques,
  juntarDias,
  posicaoDoCodigo,
  ROTULO_DIA,
  SIGLAS_DIA,
  type Choque,
} from '@/lib/choques';
import { cn } from '@/lib/utils';
import { tituloCurso } from '@/lib/curso-texto';

const basesDe = (secoes: Section[]) => Array.from(new Set(secoes.map((s) => getBlockCourseBaseCode(codigoDaTurma(s))).filter(Boolean)));

function Estrela({ cheia, className }: { cheia: boolean; className?: string }) {
  return <Star className={cn('h-3.5 w-3.5', cheia ? 'fill-ouro text-[#B88700]' : '', className)} strokeWidth={cheia ? 1.6 : 2} />;
}

// ------------------------------------------------------------------ abas

export function AbasGrades({ comparando, onComparar }: { comparando: boolean; onComparar: () => void }) {
  const { lista, ativaId, favoritaId, abrir, criar } = useGrades();
  return (
    <div className="flex items-end gap-1 border-b-[1.5px] border-foreground/15">
      <div role="tablist" aria-label="Grades" className="-mb-[1.5px] flex min-w-0 flex-1 items-end gap-1 overflow-x-auto [scrollbar-width:none]">
        {lista.map((g) => {
          const n = encontrarChoques(g.secoes).length;
          const sel = !comparando && g.id === ativaId;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => {
                abrir(g.id);
                if (comparando) onComparar();
              }}
              className={cn(
                'inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-t-xl px-3.5 text-[13px] transition-colors',
                sel ? 'bg-primary font-extrabold text-primary-foreground' : 'font-bold text-foreground-2 hover:bg-nevoa hover:text-foreground',
              )}
            >
              {g.id === favoritaId && <Estrela cheia aria-label="Favorita" />}
              <span className="max-w-[160px] truncate">{g.nome}</span>
              {n > 0 && (
                <span
                  aria-label={`${n} ${n === 1 ? 'choque' : 'choques'}`}
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pitanga px-1 text-[10.5px] font-extrabold text-white"
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => criar()}
        aria-label="Nova grade"
        className="mb-1 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-foreground/30 px-3 text-xs font-bold text-foreground-2 hover:bg-nevoa hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Nova grade</span>
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ resumo e ações

export function AcoesGrade(_props: { cargaHoraria?: number }) {
  const { lista, ativa, favoritaId, favoritar, duplicar, renomear, excluir } = useGrades();
  const [nome, setNome] = useState(ativa.nome);
  const [renomeando, setRenomeando] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const choques = encontrarChoques(ativa.secoes).length;
  const disciplinas = basesDe(ativa.secoes).length;
  const ehFavorita = ativa.id === favoritaId;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
      <span className="inline-flex flex-wrap items-center gap-2.5">
        {disciplinas > 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
              choques ? 'bg-pitanga-tint text-pitanga-ink' : 'bg-mar-tint text-mar-ink',
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {choques ? `${choques} choque${choques > 1 ? 's' : ''}` : 'sem choques'}
          </span>
        )}
      </span>
      <span className="flex w-full gap-1.5 sm:w-auto">
        <button
          type="button"
          aria-pressed={ehFavorita}
          onClick={() => favoritar(ativa.id)}
          title={ehFavorita ? 'Esta é a grade que aparece em Minhas turmas, no Início' : 'A favorita aparece em Minhas turmas, no Início'}
          className={cn(
            'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] px-3 text-xs font-bold transition-colors sm:flex-none',
            ehFavorita ? 'border-ouro bg-ouro/15 text-foreground' : 'border-foreground/20 text-foreground hover:bg-nevoa',
          )}
        >
          <Estrela cheia={ehFavorita} />
          {ehFavorita ? 'Favorita' : 'Tornar favorita'}
        </button>
        <button
          type="button"
          onClick={duplicar}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-foreground/20 px-3 text-xs font-bold text-foreground hover:bg-nevoa sm:flex-none"
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicar
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais opções da grade"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground/20 text-foreground hover:bg-nevoa"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-[14px] p-1.5">
            <DropdownMenuItem
              onSelect={() => {
                setNome(ativa.nome);
                setRenomeando(true);
              }}
              className="min-h-10 gap-2 rounded-[10px] text-[13px] font-bold"
            >
              <Pencil className="h-4 w-4" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={lista.length <= 1}
              onSelect={() => setConfirmarExcluir(true)}
              className="min-h-10 gap-2 rounded-[10px] text-[13px] font-bold text-pitanga focus:text-pitanga"
            >
              <Trash2 className="h-4 w-4" /> Excluir grade
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>

      <Dialog open={renomeando} onOpenChange={setRenomeando}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Renomear grade</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renomear(ativa.id, nome);
              setRenomeando(false);
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="nome-grade" className="sr-only">
              Nome da grade
            </label>
            <input
              id="nome-grade"
              autoFocus
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              className="h-12 rounded-full bg-nevoa px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-mar"
            />
            <button type="submit" className="h-12 rounded-full bg-primary text-sm font-extrabold text-primary-foreground hover:bg-primary/90">
              Salvar
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarExcluir} onOpenChange={setConfirmarExcluir}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {ativa.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              As turmas desta grade somem. As outras grades continuam como estão.
              {ehFavorita && ' Outra grade passa a ser a favorita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-pitanga text-white hover:bg-pitanga/90" onClick={() => excluir(ativa.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------ semana compacta / completa

export type VisaoSemana = 'compacta' | 'completa';
const VISAO_KEY = 'cadee:planejadorVisaoSemana';

export function lerVisaoSemana(): VisaoSemana {
  try {
    return localStorage.getItem(VISAO_KEY) === 'completa' ? 'completa' : 'compacta';
  } catch {
    return 'compacta';
  }
}

export function salvarVisaoSemana(v: VisaoSemana) {
  try {
    localStorage.setItem(VISAO_KEY, v);
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
}

export function SeletorVisaoSemana({ visao, onVisao }: { visao: VisaoSemana; onVisao: (v: VisaoSemana) => void }) {
  return (
    <div role="group" aria-label="Visualização da semana" className="inline-flex rounded-full bg-nevoa p-1">
      {([
        ['compacta', 'Compacta', Rows3],
        ['completa', 'Completa', CalendarRange],
      ] as const).map(([v, rotulo, Icone]) => (
        <button
          key={v}
          type="button"
          aria-pressed={visao === v}
          onClick={() => onVisao(v)}
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
            visao === v ? 'bg-primary text-primary-foreground' : 'text-foreground-2 hover:text-foreground',
          )}
        >
          <Icone className="h-3.5 w-3.5" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ choques à parte

export function ChoquesDaGrade({
  secoes,
  onTrocar,
  onRemover,
}: {
  secoes: Section[];
  onTrocar: (codigo: string) => void;
  onRemover: (s: Section) => void;
}) {
  const choques = useMemo(() => encontrarChoques(secoes), [secoes]);
  const cores = useMemo(() => mapaDeCores(secoes.map((s) => getBlockCourseBaseCode(codigoDaTurma(s)))), [secoes]);
  if (choques.length === 0) return null;
  const nome = (s: Section) => tituloCurso(s.course?.name || codigoDaTurma(s));

  return (
    <section aria-labelledby="choques-grade" className="flex flex-col gap-2.5 border-t-2 border-pitanga pt-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="choques-grade" className="text-[17px] font-black tracking-[-0.02em] text-pitanga-ink">
          {choques.length === 1 ? '1 choque nesta grade' : `${choques.length} choques nesta grade`}
        </h3>
        <span className="font-mono text-[11.5px] text-foreground-2">só dá para cursar uma de cada par</span>
      </div>
      {choques.map((c: Choque) => {
        const baseA = getBlockCourseBaseCode(c.codigoA);
        const baseB = getBlockCourseBaseCode(c.codigoB);
        return (
          <div
            key={`${c.a.id_ref}-${c.b.id_ref}`}
            className="flex flex-col gap-3 rounded-2xl bg-pitanga-tint/60 px-3.5 py-3 sm:grid sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-center sm:gap-3.5"
          >
            <span aria-hidden className="hidden h-[26px] w-[26px] items-center justify-center rounded-full bg-pitanga text-white sm:flex">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-extrabold text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: cores.get(baseA)?.bg }} />
                  {baseA}
                </span>
                <span className="text-pitanga-ink">×</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: cores.get(baseB)?.bg }} />
                  {baseB}
                </span>
              </span>
              <span className="text-xs text-foreground-2">
                {nome(c.a)} e {nome(c.b)}
              </span>
              <span className="font-mono text-[11.5px] font-semibold text-pitanga-ink">
                {juntarDias(c.dias)} · {c.inicio}–{c.fim}
              </span>
            </span>
            <span className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onTrocar(c.codigoB)}
                className="min-h-9 flex-1 rounded-full border-[1.5px] border-foreground/20 bg-background px-3 text-xs font-bold text-foreground hover:bg-nevoa sm:flex-none"
              >
                Trocar turma
              </button>
              <button
                type="button"
                onClick={() => onRemover(c.b)}
                className="min-h-9 flex-1 rounded-full px-3 text-xs font-extrabold text-pitanga-ink hover:bg-pitanga-tint sm:flex-none"
              >
                Remover {baseB}
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

// ------------------------------------------------------------------ comparar

function MiniSemana({ secoes }: { secoes: Section[] }) {
  const cores = mapaDeCores(secoes.map((s) => getBlockCourseBaseCode(codigoDaTurma(s))));
  const choques = encontrarChoques(secoes);
  const emChoque = new Set(choques.flatMap((c) => [c.a.id_ref, c.b.id_ref]));
  const celulas: { dia: number; linha: number; cor: string; choque: boolean; faixa: number }[] = [];
  const ocupacao = new Map<string, number>();
  for (const s of secoes) {
    const cor = cores.get(getBlockCourseBaseCode(codigoDaTurma(s)))?.bg ?? 'hsl(var(--tracejado))';
    for (const c of codigosUnitarios(s)) {
      const p = posicaoDoCodigo(c);
      if (!p) continue;
      const k = `${p.dia}-${p.linha}`;
      const faixa = ocupacao.get(k) ?? 0;
      ocupacao.set(k, faixa + 1);
      celulas.push({ ...p, cor, choque: emChoque.has(s.id_ref), faixa });
    }
  }
  return (
    <div
      aria-hidden
      className="grid gap-[2px] rounded-xl bg-nevoa p-2"
      style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridTemplateRows: '14px repeat(16, 7px)' }}
    >
      {SIGLAS_DIA.map((d, i) => (
        <span key={d} className="text-center text-[8.5px] font-extrabold text-muted-foreground" style={{ gridColumn: i + 1, gridRow: 1 }}>
          {ROTULO_DIA[d]}
        </span>
      ))}
      {celulas.map((c, i) => {
        const dividida = (ocupacao.get(`${c.dia}-${c.linha}`) ?? 1) > 1;
        return (
          <span
            key={i}
            className={cn('rounded-[2px]', c.choque && 'outline outline-[1.5px] outline-pitanga')}
            style={{
              gridColumn: c.dia + 1,
              gridRow: c.linha + 2,
              background: c.cor,
              ...(dividida ? { width: 'calc(50% - 1px)', justifySelf: c.faixa ? 'end' : 'start' } : {}),
            }}
          />
        );
      })}
    </div>
  );
}

const TURNOS_TEXTO = [
  { nome: 'manhãs', de: 0, ate: 6 },
  { nome: 'tardes', de: 6, ate: 12 },
  { nome: 'noites', de: 12, ate: 16 },
];

function resumoLivre(secoes: Section[]) {
  const pos = secoes.flatMap((s) => codigosUnitarios(s)).map(posicaoDoCodigo).filter(Boolean) as { dia: number; linha: number }[];
  if (pos.length === 0) return 'semana toda';
  const turnos = TURNOS_TEXTO.filter((t) => !pos.some((p) => p.linha >= t.de && p.linha < t.ate)).map((t) => t.nome);
  const dias = SIGLAS_DIA.filter((_, d) => !pos.some((p) => p.dia === d)).map((d) => ROTULO_DIA[d]);
  const partes = [...dias, ...turnos];
  return partes.length ? partes.join(', ') : 'nenhum turno inteiro';
}

export function CompararGrades({ cargaDe, onAbrir }: { cargaDe: (codigo: string) => number; onAbrir: () => void }) {
  const { lista, favoritaId, abrir, favoritar } = useGrades();
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {lista.map((g: GradeSalva) => {
        const choques = encontrarChoques(g.secoes);
        const bases = basesDe(g.secoes);
        const ch = bases.reduce((t, b) => t + (cargaDe(b) || 0), 0);
        const fav = g.id === favoritaId;
        const cores = mapaDeCores(bases);
        const linhas = [
          { k: 'Disciplinas', v: String(bases.length) },
          { k: 'Carga horária', v: `${ch} h` },
          {
            k: 'Choques',
            v: choques.length ? `${choques.length} · ${juntarDias(choques[0].dias)} ${choques[0].inicio}` : 'nenhum',
            cor: choques.length ? 'text-pitanga-ink' : 'text-mar-ink',
          },
          { k: 'Fica livre', v: resumoLivre(g.secoes) },
        ];
        return (
          <div
            key={g.id}
            className={cn(
              'flex flex-col gap-3.5 rounded-[20px] p-4',
              fav ? 'bg-ouro/[0.06] ring-2 ring-inset ring-ouro' : 'ring-[1.5px] ring-inset ring-foreground/10',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-base font-black tracking-[-0.02em] text-foreground">
                {fav && <Estrela cheia />}
                <span className="truncate">{g.nome}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                  choques.length ? 'bg-pitanga-tint text-pitanga-ink' : 'bg-mar-tint text-mar-ink',
                )}
              >
                {choques.length ? `${choques.length} choque${choques.length > 1 ? 's' : ''}` : 'sem choques'}
              </span>
            </div>
            <MiniSemana secoes={g.secoes} />
            <div className="flex flex-col">
              {linhas.map((l) => (
                <div key={l.k} className="flex items-baseline justify-between gap-2 border-b border-trilho py-1.5">
                  <span className="text-xs font-semibold text-foreground-2">{l.k}</span>
                  <span className={cn('text-right text-[13px] font-extrabold text-foreground', l.cor)}>{l.v}</span>
                </div>
              ))}
            </div>
            {bases.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bases.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-nevoa px-2 py-0.5 font-mono text-[10.5px] font-semibold text-foreground">
                    <span className="h-[7px] w-[7px] rounded-[2px]" style={{ background: cores.get(b)?.bg }} />
                    {b}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-auto flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  abrir(g.id);
                  onAbrir();
                }}
                className="min-h-10 flex-1 rounded-full bg-primary text-xs font-extrabold text-primary-foreground hover:bg-primary/90"
              >
                Abrir
              </button>
              <button
                type="button"
                aria-pressed={fav}
                onClick={() => favoritar(g.id)}
                className={cn(
                  'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border-[1.5px] text-xs font-bold',
                  fav ? 'border-ouro bg-ouro/15 text-foreground' : 'border-foreground/20 text-foreground hover:bg-nevoa',
                )}
              >
                <Estrela cheia={fav} />
                {fav ? 'Favorita' : 'Favoritar'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BotaoComparar({ ativo, onClick }: { ativo: boolean; onClick: () => void }) {
  const { lista } = useGrades();
  if (lista.length < 2) return null;
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors',
        ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/20 text-foreground hover:bg-nevoa',
      )}
    >
      <Columns2 className="h-3.5 w-3.5" />
      Comparar
    </button>
  );
}
