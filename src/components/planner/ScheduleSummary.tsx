import { Users, Trash2, Clock, Info, AlertTriangle, CheckCircle2, XCircle, Ban, ChevronDown, ChevronUp, Columns3, List, X, ArrowRight } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMySections } from '@/hooks/useMySections';
import { useMyCourses } from '@/hooks/useMyCourses.ts';
import { useApp } from '@/contexts/AppContext';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { useCourses, useSections, useCourseByCode } from '@/hooks/useApi';
import { DisciplineDetail } from '@/components/disciplines/DisciplineDetail';
import { fetchCourseByCode } from '@/services/api';
import type { Course, Section } from '@/services/api';
import type { DisciplineStatus } from '@/lib/semester';
import { Link } from 'react-router-dom';
import { formatTimeCodes, parseTimeCodes, type ParsedTimeSlot } from '@/lib/schedule';
import { mapaDeCores, type CorGrade } from '@/lib/grade-cores';
import { cn } from '@/lib/utils';
import { getBlockCourseBaseCode, isBlockCourseCode, resolveBlockCourseName, getBlockCourseVariantLabel, findCorrespondingBlockSections } from '@/lib/blockCourses';
import { usePlannedDisciplineCategories } from '@/hooks/usePlannedDisciplineCategories';

const STATUS_CONFIG: Record<DisciplineStatus, { label: string; icon: typeof CheckCircle2; activeClass: string }> = {
  approved: {
    label: 'Cursada',
    icon: CheckCircle2,
    activeClass: 'bg-mar text-white border-mar',
  },
  failed: {
    label: 'Reprovada',
    icon: XCircle,
    activeClass: 'bg-pitanga text-white border-pitanga',
  },
  dropped: {
    label: 'Trancada',
    icon: Ban,
    activeClass: 'bg-background text-foreground border-foreground border-2',
  },
};

// ---------- Grade / Lista de "Minhas turmas" ----------
const DIAS = [
  { nome: 'Segunda', curto: 'SEG', idx: 1 },
  { nome: 'Terça', curto: 'TER', idx: 2 },
  { nome: 'Quarta', curto: 'QUA', idx: 3 },
  { nome: 'Quinta', curto: 'QUI', idx: 4 },
  { nome: 'Sexta', curto: 'SEX', idx: 5 },
  { nome: 'Sábado', curto: 'SÁB', idx: 6 },
];

const FUNDO_STATUS: Record<DisciplineStatus | 'none', string> = {
  approved: 'bg-mar-claro',
  failed: 'bg-pitanga-tint',
  dropped: 'bg-trilho',
  none: 'bg-nevoa',
};

const RESULTADO_TEXTO: Record<DisciplineStatus, string> = {
  approved: 'Cursada',
  failed: 'Reprovado',
  dropped: 'Trancada',
};

const SEGMENTO_ATIVO: Record<DisciplineStatus, string> = {
  approved: 'bg-mar text-white',
  failed: 'bg-pitanga text-white',
  dropped: 'bg-foreground text-background',
};

type Visao = 'grade' | 'lista';
const VISAO_KEY = 'cadee:minhasTurmasVisao';

function lerVisao(): Visao {
  try {
    return localStorage.getItem(VISAO_KEY) === 'lista' ? 'lista' : 'grade';
  } catch {
    return 'grade';
  }
}

type Horario = { dia: string; inicio: string; fim: string };

/** Junta períodos seguidos do mesmo dia (ex.: 18:30–19:25 + 19:25–20:20 → 18:30–20:20). */
function juntarHorarios(slots: ParsedTimeSlot[]): Horario[] {
  const ordem = (dia: string) => DIAS.findIndex((d) => d.nome === dia);
  const sorted = [...slots].sort((a, b) =>
    ordem(a.dia) - ordem(b.dia) || (a.horarioInicio < b.horarioInicio ? -1 : a.horarioInicio > b.horarioInicio ? 1 : 0)
  );
  const out: Horario[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.dia === s.dia && last.fim === s.horarioInicio) last.fim = s.horarioFim;
    else if (!(last && last.dia === s.dia && last.inicio === s.horarioInicio)) out.push({ dia: s.dia, inicio: s.horarioInicio, fim: s.horarioFim });
  }
  return out;
}

type Turma = {
  section: Section;
  disciplineCode: string;
  classCode: string;
  variantLabel: string | null;
  teachers: string[];
  horarios: Horario[];
};

type Disc = {
  baseCode: string;
  disciplineCodes: string[];
  name: string;
  status?: DisciplineStatus;
  course?: Course;
  workload?: number;
  tipo: 'Obrigatória' | 'Optativa' | 'Equivalente' | 'Ofertada' | null;
  cor: CorGrade;
  conflitos: string[];
  turmas: Turma[];
};

type Entrada = { disc: Disc; turma: Turma; inicio: string; fim: string };

function getConflictCodes(conflicts: Array<{ code: string; section: Section }>): string[] {
  const codes = new Set<string>();
  for (const c of conflicts) {
    const code = c.section.course?.code || (c.section as { course_code?: string }).course_code;
    if (code) codes.add(code);
  }
  return [...codes];
}

export function ScheduleSummary() {
  const { mySections, toggleSection, getConflictsForSection } = useMySections();
  const { courses } = useMyCourses();
  const { data: coursesIndex = [] } = useCourses();
  const { data: allSections = [] } = useSections();
  const { plannedDisciplines: classifiedDisciplines } = usePlannedDisciplineCategories();
  const { getDisciplineStatus, setDisciplineStatus, clearDisciplineStatus } = useApp();
  const { currentTerm } = useCurrentTerm();
  const { pendingTransition, statusTerm, planningTerm, unresolvedCodes } = useSemesterTransition();
  const [selectedDiscipline, setSelectedDiscipline] = useState<Course | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<Set<string>>(new Set());
  const [visao, setVisao] = useState<Visao>(lerVisao);
  // null = nenhuma aberta; só abre quando o usuário escolhe uma disciplina
  const [aberta, setAberta] = useState<string | null>(null);
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    try {
      localStorage.setItem(VISAO_KEY, v);
    } catch {
      // sem armazenamento: a escolha vale só nesta visita
    }
  };

  const outcomeTerm = statusTerm || currentTerm;
  
  const coursesByCode = useMemo(() => new Map(courses.map((c) => [c.code, c])), [courses]);
  const coursesIndexByCode = useMemo(() => new Map(coursesIndex.map((c) => [c.code, c])), [coursesIndex]);
  const allProgramCourseCodesArray = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) set.add(c.code);
    for (const s of mySections) {
      const code = s.course?.code || (s as any).course_code;
      if (code) set.add(code);
    }
    return Array.from(set);
  }, [courses, mySections]);

  // Fetch details for all involved courses to find equivalences
  const allCourseDetails = useQueries({
    queries: allProgramCourseCodesArray.map(code => ({
      queryKey: ['course-by-code', code],
      queryFn: () => fetchCourseByCode(code),
      enabled: !!code,
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
    })),
  });

  // Get all equivalent codes for a given code (bidirectional)
  const getEquivalentCodesFor = useCallback((code: string): string[] => {
    const set = new Set<string>();
    const baseCode = getBlockCourseBaseCode(code);
    for (const result of allCourseDetails) {
      const detail = result.data;
      if (!detail?.equivalences || !detail?.code) continue;
      const courseBase = getBlockCourseBaseCode(detail.code);
      let isRelated = courseBase === baseCode;
      const eqBaseCodes = new Set<string>();
      for (const eqGroup of detail.equivalences) {
        for (const eq of eqGroup) {
          const eqCode = (eq as any).code;
          if (!eqCode) continue;
          const eqBase = getBlockCourseBaseCode(eqCode);
          eqBaseCodes.add(eqBase);
          if (eqBase === baseCode) isRelated = true;
        }
      }
      if (isRelated) {
        // Add this course's code
        set.add(detail.code);
        // Add all codes from courses that match any eqBase
        for (const eqBase of eqBaseCodes) {
          for (const c of courses) {
            if (getBlockCourseBaseCode(c.code) === eqBase) {
              set.add(c.code);
            }
          }
          for (const s of mySections) {
            const sCode = s.course?.code || (s as any).course_code;
            if (sCode && getBlockCourseBaseCode(sCode) === eqBase) {
              set.add(sCode);
            }
          }
          if (getBlockCourseBaseCode(code) === eqBase) {
            set.add(code);
          }
        }
      }
    }
    return Array.from(set);
  }, [allCourseDetails, courses, mySections]);
  
  // Group sections by base course code
  const groupedSections = useMemo(() => {
    const groups = new Map<string, Section[]>();
    for (const s of mySections) {
      const code = s.course?.code || (s as { course_code?: string }).course_code;
      if (code) {
        const baseCode = getBlockCourseBaseCode(code);
        const existing = groups.get(baseCode) || [];
        existing.push(s);
        groups.set(baseCode, existing);
      }
    }
    return groups;
  }, [mySections]);

  // Compute conflicts between selected sections, grouped by base course code
  const conflictsByBaseCode = useMemo(() => {
    const conflictsMap = new Map<string, Set<string>>();

    for (let i = 0; i < mySections.length; i++) {
      const sectionA = mySections[i];
      const codeA = sectionA.course?.code || (sectionA as any)?.course_code;
      if (!codeA) continue;
      const baseA = getBlockCourseBaseCode(codeA);

      for (let j = i + 1; j < mySections.length; j++) {
        const sectionB = mySections[j];
        const codeB = sectionB.course?.code || (sectionB as any)?.course_code;
        if (!codeB) continue;
        const baseB = getBlockCourseBaseCode(codeB);

        if (baseA === baseB) continue;

        const conflicts = getConflictsForSection(sectionA);
        const hasConflict = conflicts.some(c => c.section.id_ref === sectionB.id_ref);

        if (hasConflict) {
          if (!conflictsMap.has(baseA)) conflictsMap.set(baseA, new Set());
          conflictsMap.get(baseA)!.add(baseB);

          if (!conflictsMap.has(baseB)) conflictsMap.set(baseB, new Set());
          conflictsMap.get(baseB)!.add(baseA);
        }
      }
    }

    return conflictsMap;
  }, [mySections, getConflictsForSection]);

  if (mySections.length === 0) {
    return null;
  }

  const handleStatusClick = (codes: string[], status: DisciplineStatus) => {
    // Collect all codes + their equivalents
    const allCodes = new Set<string>();
    codes.forEach(code => {
      allCodes.add(code);
      getEquivalentCodesFor(code).forEach(c => allCodes.add(c));
    });
    Array.from(allCodes).forEach(code => {
      const current = getDisciplineStatus(code);
      if (current === status) {
        clearDisciplineStatus(code, outcomeTerm || undefined);
      } else {
        setDisciplineStatus(code, status, outcomeTerm || undefined);
      }
    });
  };

  const toggleStatusExpanded = (key: string) => {
    setExpandedStatus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---------- Modelo da visão (Grade / Lista) ----------
  const cores = mapaDeCores([...groupedSections.keys()]);
  const discs: Disc[] = [...groupedSections.entries()].map(([baseCode, sections]) => {
    const disciplineCodes = sections.map(s =>
      s.course?.code || (s as { course_code?: string }).course_code || ''
    );
    const name = resolveBlockCourseName(
      disciplineCodes[0],
      coursesIndexByCode,
      coursesByCode.get(baseCode)?.name ?? coursesByCode.get(disciplineCodes[0])?.name ?? baseCode
    );
    const status = disciplineCodes.reduce(
      (acc, code) => acc || getDisciplineStatus(code),
      undefined as DisciplineStatus | undefined
    ) as DisciplineStatus | undefined;
    const course = courses?.find((c) => c.code === baseCode) ||
                   courses?.find((c) => c.code === disciplineCodes[0]);
    const info = classifiedDisciplines.find((p) => p.baseCode === baseCode);
    const turmas: Turma[] = sections.map((s) => {
      const disciplineCode = s.course?.code || (s as { course_code?: string }).course_code || '';
      return {
        section: s,
        disciplineCode,
        classCode: (s as { section_code?: string }).section_code || s.id_ref,
        variantLabel: isBlockCourseCode(disciplineCode) ? getBlockCourseVariantLabel(disciplineCode, coursesByCode) : null,
        teachers: Array.isArray(s.teachers) ? s.teachers : [],
        horarios: juntarHorarios(parseTimeCodes(Array.isArray(s.time_codes) ? s.time_codes : [])),
      };
    });
    return {
      baseCode,
      disciplineCodes,
      name,
      status,
      course: course as Course | undefined,
      workload:
        (course as { workload?: number } | undefined)?.workload ??
        info?.workload ??
        (turmas.reduce((acc, t) => acc + parseTimeCodes(Array.isArray(t.section.time_codes) ? t.section.time_codes : []).length, 0) * 17 || 68),
      tipo: !info ? null : info.isEquivalent ? 'Equivalente' : info.category === 'mandatory' ? 'Obrigatória' : info.category === 'elective' ? 'Optativa' : 'Ofertada',
      cor: cores.get(baseCode)!,
      conflitos: Array.from(conflictsByBaseCode.get(baseCode) || []),
      turmas,
    };
  });

  const comResultado = discs.filter((d) => d.status).length;
  const sel = discs.find((d) => d.baseCode === aberta) || null;
  const escolher = (key: string) => setAberta(sel?.baseCode === key ? null : key);

  const hojeIdx = new Date().getDay(); // 0 = domingo
  const segunda = new Date();
  segunda.setDate(segunda.getDate() - ((hojeIdx + 6) % 7));
  const dias = DIAS.map((dia) => {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + dia.idx - 1);
    const entradas: Entrada[] = [];
    for (const d of discs) {
      for (const t of d.turmas) {
        for (const h of t.horarios) {
          if (h.dia === dia.nome) entradas.push({ disc: d, turma: t, inicio: h.inicio, fim: h.fim });
        }
      }
    }
    entradas.sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
    return {
      ...dia,
      data: `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`,
      hoje: dia.idx === hojeIdx,
      entradas,
    };
  });
  const semHorario = discs.filter((d) => d.turmas.every((t) => t.horarios.length === 0));
  const diaPadrao =
    dias.find((d) => d.hoje && d.entradas.length > 0)?.nome ??
    dias.find((d) => d.entradas.length > 0)?.nome ??
    dias[0].nome;
  const diaMobile = dias.find((d) => d.nome === (diaAtivo ?? diaPadrao)) ?? dias[0];

  const quando = (d: Disc) => {
    const todos = d.turmas.flatMap((t) => t.horarios);
    if (todos.length === 0) return 'Horário a definir';
    const curtos = DIAS.filter((dia) => todos.some((h) => h.dia === dia.nome)).map((dia) => dia.curto);
    return `${curtos.join(' ')} · ${todos[0].inicio}–${todos[0].fim}`;
  };

  const termo = pendingTransition ? planningTerm : currentTerm;

  // Turnos sem nenhuma aula na semana ("Manhãs e tardes livres")
  const todosHorarios = discs.flatMap((d) => d.turmas.flatMap((t) => t.horarios));
  const temAula = (de: string, ate: string) => todosHorarios.some((h) => h.inicio >= de && h.inicio < ate);
  const livres = [
    !temAula('00:00', '12:30') && 'manhãs',
    !temAula('12:30', '18:20') && 'tardes',
    !temAula('18:20', '24:00') && 'noites',
  ].filter(Boolean) as string[];
  const textoLivres = todosHorarios.length === 0 || livres.length === 0
    ? ''
    : (() => {
        const t = livres.length === 1 ? livres[0] : `${livres.slice(0, -1).join(', ')} e ${livres[livres.length - 1]}`;
        return `${t.charAt(0).toUpperCase()}${t.slice(1)} livres`;
      })();

  return (
    <div className="border-t-2 border-foreground pt-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 pb-4 sm:pb-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1 sm:flex-none sm:justify-start">
          <h3 className="text-xl font-black tracking-[-0.03em] text-foreground sm:text-2xl">Minhas turmas</h3>
          <span className="font-mono text-[11px] text-foreground-2 sm:hidden">{discs.length} · {comResultado} com resultado</span>
          <span className="hidden font-mono text-xs text-foreground-2 sm:inline">
            {termo ? `${termo} · ` : ''}{discs.length} disciplina{discs.length !== 1 ? 's' : ''} · {comResultado} com resultado
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
          <Link to="/planejador" className="hidden items-center gap-1 text-[13px] font-bold text-mar hover:text-foreground sm:inline-flex">
            Editar no Planejador <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <div role="group" aria-label="Visualização" className="flex flex-1 rounded-full bg-nevoa p-1 sm:flex-none">
            {(['grade', 'lista'] as const).map((v) => {
              const ativo = visao === v;
              const Icone = v === 'grade' ? Columns3 : List;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => trocarVisao(v)}
                  className={cn(
                    'inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition-colors sm:flex-none',
                    ativo ? 'bg-primary text-primary-foreground' : 'text-foreground-2 hover:text-foreground'
                  )}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {v === 'grade' ? 'Grade' : 'Lista'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {pendingTransition && (
        <div className="mb-4 rounded-2xl bg-dende-claro px-4 py-3 text-[13px] font-medium text-dende-ink">
          Semestre <strong>{currentTerm}</strong> disponível. Marque o resultado das {unresolvedCodes.length} disciplina{unresolvedCodes.length !== 1 ? 's' : ''} pendente{unresolvedCodes.length !== 1 ? 's' : ''} para avançar.
        </div>
      )}

      {visao === 'grade' ? (
        <>
          {/* GRADE — desktop: semana em colunas */}
          <div className="hidden overflow-x-auto md:block">
            <div className="flex min-w-[760px] border-t border-foreground/10">
              {dias.map((dia, i) => (
                <div
                  key={dia.nome}
                  className={cn('flex min-w-0 flex-1 flex-col gap-3 px-3 pb-5 pt-4', i > 0 && 'border-l border-foreground/10')}
                >
                  <div className="flex min-h-[22px] items-center justify-between gap-1">
                    <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                      {dia.curto}{' '}
                      <span className="font-mono text-[11px] font-medium tracking-normal text-muted-foreground">{dia.data}</span>
                    </span>
                    {dia.hoje && (
                      <span className="rounded-full bg-dende px-[7px] py-[3px] text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1C1B19]">Hoje</span>
                    )}
                  </div>
                  {dia.entradas.length === 0 ? (
                    <span className="text-xs font-medium text-muted-foreground/70">Livre</span>
                  ) : (
                    dia.entradas.map((e) => (
                      <BlocoAula
                        key={`${e.turma.section.id_ref}-${e.inicio}`}
                        entrada={e}
                        aberta={sel?.baseCode === e.disc.baseCode}
                        onClick={() => escolher(e.disc.baseCode)}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* GRADE — mobile: dia a dia */}
          <div className="md:hidden">
            <div role="tablist" aria-label="Dias" className="flex border-b border-foreground/10">
              {dias.map((dia) => {
                const ativo = dia.nome === diaMobile.nome;
                const cores = Array.from(new Map(dia.entradas.map((e) => [e.disc.baseCode, e.disc.cor.bg])).values()).slice(0, 4);
                return (
                  <button
                    key={dia.nome}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setDiaAtivo(dia.nome)}
                    className={cn(
                      'flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1.5 rounded-t-xl transition-colors',
                      ativo ? 'bg-primary text-primary-foreground' : 'text-foreground-2'
                    )}
                  >
                    <span className="text-xs font-black">{dia.curto}</span>
                    <span className="flex min-h-[6px] gap-[3px]">
                      {cores.map((cor, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pb-1 pt-3.5">
              {diaMobile.hoje && (
                <span className="rounded-full bg-dende px-[7px] py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#1C1B19]">Hoje</span>
              )}
              <span className="font-mono text-[11px] text-foreground-2">{diaMobile.data} · {diaMobile.entradas.length} {diaMobile.entradas.length === 1 ? 'aula' : 'aulas'}</span>
            </div>
            {diaMobile.entradas.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-muted-foreground">Nenhuma aula neste dia</p>
            ) : (
              diaMobile.entradas.map((e) => (
                <button
                  key={`${e.turma.section.id_ref}-${e.inicio}`}
                  type="button"
                  aria-expanded={sel?.baseCode === e.disc.baseCode}
                  onClick={() => escolher(e.disc.baseCode)}
                  className="flex w-full gap-3.5 border-b border-foreground/10 py-3 pr-2 text-left"
                >
                  <span className="flex w-[50px] shrink-0 flex-col gap-0.5 pt-2.5">
                    <span className="font-mono text-[15px] font-semibold text-foreground">{e.inicio}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{e.fim}</span>
                  </span>
                  <span
                    className={cn(
                      'flex min-w-0 flex-1 flex-col gap-1 rounded-b-[10px] border-t-4 px-2.5 pb-2.5 pt-2',
                      FUNDO_STATUS[e.disc.status ?? 'none'],
                      sel?.baseCode === e.disc.baseCode && 'ring-2 ring-inset ring-foreground'
                    )}
                    style={{ borderTopColor: e.disc.cor.bg }}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-extrabold uppercase leading-tight text-foreground">{e.disc.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {e.disc.conflitos.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-pitanga" />}
                        {e.disc.status && <StatusIcon status={e.disc.status} className="h-4 w-4" />}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-foreground-2">{e.disc.baseCode}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Rodapé da grade */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-foreground/10 py-3 md:mt-0 mt-3">
            {semHorario.length > 0 && (
              <>
                <span className="text-xs text-foreground-2"><span className="sm:hidden">Sem horário:</span><span className="hidden sm:inline">Sem horário definido:</span></span>
                {semHorario.map((d) => (
                  <button
                    key={d.baseCode}
                    type="button"
                    aria-expanded={sel?.baseCode === d.baseCode}
                    onClick={() => escolher(d.baseCode)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-dashed border-tracejado px-3 font-mono text-xs font-semibold text-foreground',
                      FUNDO_STATUS[d.status ?? 'none'],
                      sel?.baseCode === d.baseCode && 'ring-2 ring-inset ring-foreground'
                    )}
                  >
                    {d.baseCode}
                    <span className="hidden sm:inline">· {d.name}</span>
                  </button>
                ))}
              </>
            )}
            <span className="ml-auto text-xs font-medium text-foreground-2">
              {conflictsByBaseCode.size > 0 ? (
                <strong className="text-pitanga">
                  {conflictsByBaseCode.size} disciplina{conflictsByBaseCode.size !== 1 ? 's' : ''} com choque de horário
                </strong>
              ) : (
<>
                  {textoLivres && `${textoLivres} · `}<strong className="text-foreground">nenhum conflito</strong>
                </>
              )}
            </span>
          </div>
        </>
      ) : (
        /* LISTA */
        <div className="flex flex-col border-t border-foreground/10">
          {discs.map((d) => {
            const aberto = sel?.baseCode === d.baseCode;
            return (
              <button
                key={d.baseCode}
                type="button"
                aria-expanded={aberto}
                onClick={() => escolher(d.baseCode)}
                className={cn(
                  'flex min-h-[56px] w-full items-center gap-3 border-b border-foreground/10 px-2.5 py-2 text-left transition-colors hover:bg-nevoa/60',
                  'md:grid md:min-h-[52px] md:grid-cols-[12px_96px_minmax(0,1fr)_210px_130px] md:gap-4 md:px-3.5 md:py-0',
                  d.status && FUNDO_STATUS[d.status],
                  aberto && 'ring-2 ring-inset ring-foreground'
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.cor.bg }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:contents">
                  <span className="font-mono text-[12px] font-semibold text-foreground md:text-[13px]">
                    {d.baseCode}
                    <span className="font-normal text-muted-foreground md:hidden"> · {quando(d)}</span>
                  </span>
                  <span className="truncate text-[12px] font-extrabold uppercase text-foreground md:text-[13px]">{d.name}</span>
                  <span className="hidden truncate font-mono text-[11px] text-foreground-2 md:block">{quando(d)}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 text-xs font-bold text-foreground">
                  {d.conflitos.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-pitanga" aria-label="Choque de horário" />}
                  <StatusIcon status={d.status} className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  <span className="hidden md:inline">{d.status ? RESULTADO_TEXTO[d.status] : 'Sem resultado'}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* DETALHE + RESULTADO */}
      {sel ? (
        <div className="mt-4 flex flex-col gap-3 border-b border-t-2 border-b-foreground/10 border-t-foreground py-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-8 lg:gap-y-[18px] lg:py-[18px]">
          <div className="flex min-w-0 gap-3 lg:flex-[1_1_360px] lg:gap-3.5">
            <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: sel.cor.bg }} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-mar">{sel.baseCode}</span>
                {sel.tipo && (
                  <span
                    className={cn(
                      'rounded-full px-[7px] py-0.5 text-[10px] font-bold',
                      sel.tipo === 'Obrigatória' && 'bg-mar-tint text-mar-ink',
                      sel.tipo === 'Optativa' && 'bg-dende-tint text-dende-ink',
                      sel.tipo === 'Equivalente' && 'bg-nevoa text-foreground-2',
                      sel.tipo === 'Ofertada' && 'bg-trilho text-foreground-2'
                    )}
                  >
                    {sel.tipo}
                  </span>
                )}
                {sel.workload && <span className="font-mono text-[11px] text-muted-foreground">{sel.workload}h</span>}
              </span>
              <span className="text-sm font-extrabold uppercase leading-tight text-foreground lg:text-[15px]">{sel.name}</span>
              {sel.turmas.map((t) => (
                <div key={`${t.disciplineCode}-${t.classCode}`} className="flex flex-col gap-1.5">
                  <span className="text-xs text-foreground-2">
                    {t.variantLabel && (
                      <span className="mr-1.5 rounded-full bg-nevoa px-2 py-0.5 text-[10px] font-extrabold text-foreground">{t.variantLabel}</span>
                    )}
                    <span className="font-mono text-[11px]">Turma {t.classCode}</span>
                    {' · '}
                    {t.teachers.length > 0 ? t.teachers.join(', ') : 'Nenhum professor informado'}
                    {sel.turmas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleSection(t.section, allSections)}
                        className="ml-2 font-bold text-pitanga hover:underline"
                      >
                        remover
                      </button>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {t.horarios.length > 0 ? (
                      t.horarios.map((h, i) => (
                        <span key={i} className="rounded-xl bg-nevoa px-2.5 py-1.5 font-mono text-[11px] text-foreground">
                          {DIAS.find((x) => x.nome === h.dia)?.curto ?? h.dia} {h.inicio}–{h.fim}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-xl bg-nevoa px-2.5 py-1.5 font-mono text-[11px] text-foreground">Horário a definir</span>
                    )}
                  </span>
                </div>
              ))}
              {sel.conflitos.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {sel.conflitos.map((code) => {
                    const conflictingCourse = coursesIndexByCode.get(code) || coursesByCode.get(code);
                    const conflictingName = conflictingCourse?.name || code;
                    return (
                      <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-pitanga-tint px-2.5 py-1 text-[11px] font-extrabold text-pitanga-ink">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Choque com {code} {conflictingName !== code ? `— ${conflictingName}` : ''}
                      </span>
                    );
                  })}
                </span>
              )}
              {sel.course && (
                <button
                  type="button"
                  onClick={() => setSelectedDiscipline(sel.course as Course)}
                  className="mt-0.5 inline-flex items-center gap-1.5 self-start text-xs font-bold text-mar hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                  Ver detalhes da disciplina
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAberta(null)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground lg:hidden"
              aria-label="Fechar detalhes"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <span className="rotulo !text-foreground lg:hidden">Resultado da disciplina</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rotulo !text-foreground hidden lg:inline">Resultado</span>
            <div role="group" aria-label="Resultado da disciplina" className="flex flex-1 rounded-full bg-nevoa p-[3px] lg:flex-none">
              {(Object.keys(STATUS_CONFIG) as DisciplineStatus[]).map((status) => {
                const isActive = sel.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleStatusClick(sel.disciplineCodes, status)}
                    className={cn(
                      'min-h-11 flex-1 rounded-full px-3.5 text-xs font-bold transition-colors lg:min-h-10 lg:flex-none',
                      isActive ? SEGMENTO_ATIVO[status] : 'text-foreground hover:bg-background/60'
                    )}
                  >
                    {RESULTADO_TEXTO[status]}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => sel.turmas.forEach((t) => toggleSection(t.section, allSections))}
              className="hidden h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-pitanga-tint hover:text-pitanga lg:flex"
              aria-label="Remover da grade"
              title="Remover da grade"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setAberta(null)}
              className="hidden h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-nevoa lg:flex"
              aria-label="Fechar detalhes"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => sel.turmas.forEach((t) => toggleSection(t.section, allSections))}
            className="inline-flex min-h-10 items-center gap-2 self-start px-1 text-xs font-bold text-pitanga lg:hidden"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover da grade
          </button>
        </div>
      ) : null}

      {selectedDiscipline && (
        <DisciplineDetail
          discipline={selectedDiscipline}
          onClose={() => setSelectedDiscipline(null)}
        />
      )}
    </div>
  );
}

/** Bloco de aula da grade semanal (desktop). */
function BlocoAula({ entrada, aberta, onClick }: { entrada: Entrada; aberta: boolean; onClick: () => void }) {
  const d = entrada.disc;
  return (
    <button
      type="button"
      aria-expanded={aberta}
      aria-label={`${d.baseCode} — ${d.name}, ${d.status ? RESULTADO_TEXTO[d.status] : 'sem resultado'}`}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-b-[10px] border-t-4 px-2.5 pb-3 pt-2.5 text-left transition-[filter] hover:brightness-[0.97]',
        FUNDO_STATUS[d.status ?? 'none'],
        aberta && 'ring-2 ring-inset ring-foreground'
      )}
      style={{ borderTopColor: d.cor.bg }}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="font-mono text-[11px] text-foreground-2">{entrada.inicio} – {entrada.fim}</span>
        <span className="flex items-center gap-1">
          {d.conflitos.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-pitanga" />}
          {d.status && <StatusIcon status={d.status} />}
        </span>
      </span>
      <span className="line-clamp-3 text-[12px] font-extrabold uppercase leading-tight text-foreground">{d.name}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{d.baseCode}</span>
    </button>
  );
}

/** Ícone do resultado (cursada / reprovada / trancada / sem resultado). */
function StatusIcon({ status, className }: { status?: DisciplineStatus; className?: string }) {
  const cls = cn('h-3.5 w-3.5 shrink-0', className);
  if (status === 'approved') {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="11" className="fill-mar" />
        <path d="M8.4 12.3l2.5 2.5 4.8-5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'failed') {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="11" className="fill-pitanga" />
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
      </svg>
    );
  }
  if (status === 'dropped') {
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" className="stroke-foreground" strokeWidth="2" />
        <path d="M10 8v8M14 8v8" fill="none" className="stroke-foreground" strokeWidth="2.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" className="stroke-muted-foreground" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}
