/**
 * Traduz os dados da {sigaa} api para os formatos que o CADEE já usa, pra que o histórico vindo do
 * login tenha exatamente o mesmo efeito que importar o PDF à mão (progresso, catálogo, transição).
 */
import type { DisciplineStatus } from '@/lib/semester';
import type { WorkloadData, SemesterDisciplineData } from '@/utils/historyParser';
import type { Section } from '@/services/api';
import type { ComponenteCandidato, EscolhaTurma, Historico, PlanejamentoMatricula, TurmaCandidata } from '@/services/sigaaApi';
import { getSpplitedCode } from '@/lib/schedule';

/** Mesmo formato que ProgressView/Disciplinas gravam em localStorage['progressData']. */
export interface StoredProgressData {
  codes: string[];
  semesters: Array<[string, { approved: number; failed: number; dropped: number; notDone: number }]>;
  workload: WorkloadData | null;
  disciplinesBySemester: Array<[string, SemesterDisciplineData]>;
  source?: 'sigaa-api' | 'pdf';
}

export interface StatusUpdate {
  code: string;
  status: DisciplineStatus;
  term?: string;
}

const FAILED = new Set(['REP', 'REPF', 'REPMF', 'REPN', 'REPNF']);
const DROPPED = new Set(['TRANC', 'CANC', 'DESIST']);

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function outcomeOf(situacao: string, aprovado: boolean): DisciplineStatus | null {
  if (aprovado) return 'approved';
  const s = situacao.toUpperCase();
  if (FAILED.has(s) || s.startsWith('REP')) return 'failed';
  if (DROPPED.has(s)) return 'dropped';
  return null; // MATR (cursando) e outros: sem desfecho ainda
}

export function buildWorkload(h: Historico): WorkloadData | null {
  const pick = (prefix: string) => h.carga_horaria.find((c) => normalize(c.categoria).startsWith(prefix));
  const toEntry = (c: ReturnType<typeof pick>) => ({
    required: c?.exigido ?? 0,
    completed: c?.integralizado ?? 0,
    pending: c?.pendente ?? Math.max(0, (c?.exigido ?? 0) - (c?.integralizado ?? 0)),
  });

  const mandatory = pick('obrig');
  const elective = pick('opta');
  const complementary = pick('compl');
  if (!mandatory && !elective && !complementary) return null;

  const m = toEntry(mandatory);
  const e = toEntry(elective);
  const c = toEntry(complementary);
  const total = pick('total');
  return {
    mandatory: m,
    elective: e,
    complementary: c,
    total: total
      ? toEntry(total)
      : {
          required: m.required + e.required + c.required,
          completed: m.completed + e.completed + c.completed,
          pending: m.pending + e.pending + c.pending,
        },
  };
}

/** Códigos que contam como cumpridos: aprovações + componentes do currículo cumpridos por equivalência. */
export function approvedCodes(h: Historico): string[] {
  const codes = new Set<string>();
  for (const c of h.componentes) if (c.aprovado) codes.add(c.codigo.toUpperCase());
  for (const eq of h.equivalencias) {
    const cumpriu = eq.atraves_de.every((a) => codes.has(a.codigo.toUpperCase()));
    if (cumpriu && eq.componente?.codigo) codes.add(eq.componente.codigo.toUpperCase());
  }
  return [...codes];
}

export function buildProgressData(h: Historico): StoredProgressData {
  const byTerm = new Map<string, SemesterDisciplineData>();
  for (const c of h.componentes) {
    const entry = byTerm.get(c.periodo) ?? { approved: [], failed: [], dropped: [], total: [] };
    entry.total.push(c.codigo);
    const outcome = outcomeOf(c.situacao, c.aprovado);
    if (outcome === 'approved') entry.approved.push(c.codigo);
    else if (outcome === 'failed') entry.failed.push(c.codigo);
    else if (outcome === 'dropped') entry.dropped.push(c.codigo);
    byTerm.set(c.periodo, entry);
  }

  const semesters: StoredProgressData['semesters'] = [...byTerm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([term, d]) => [
      term,
      {
        approved: d.approved.length,
        failed: d.failed.length,
        dropped: d.dropped.length,
        notDone: d.total.length - d.approved.length - d.failed.length - d.dropped.length,
      },
    ]);

  return {
    codes: approvedCodes(h),
    semesters,
    workload: buildWorkload(h),
    disciplinesBySemester: [...byTerm.entries()].sort(([a], [b]) => a.localeCompare(b)),
    source: 'sigaa-api',
  };
}

/**
 * Status a aplicar no AppContext.
 * - Toda aprovação vira "cursada" (sem semestre, como a importação do PDF faz).
 * - No semestre que o aluno está planejando, o desfecho real (aprovado/reprovado/trancado) também é gravado
 *   com o semestre, o que resolve sozinho a transição de semestre do CADEE.
 */
export function buildStatusUpdates(h: Historico, planningTerm: string | null): StatusUpdate[] {
  const updates: StatusUpdate[] = approvedCodes(h).map((code) => ({ code, status: 'approved' as const }));
  if (!planningTerm) return updates;

  for (const c of h.componentes) {
    if (c.periodo !== planningTerm) continue;
    const outcome = outcomeOf(c.situacao, c.aprovado);
    if (outcome) updates.push({ code: c.codigo.toUpperCase(), status: outcome, term: planningTerm });
  }
  return updates;
}

// ------------------------------------------------------------------- planejador ↔ SIGAA

function slotSet(codes: Array<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  for (const raw of codes) {
    if (!raw) continue;
    for (const part of raw.toUpperCase().split(/[\s,;]+/)) {
      if (!part) continue;
      for (const slot of getSpplitedCode(part)) set.add(slot);
    }
  }
  return set;
}

function sameSlots(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function sectionCourseCode(section: Section): string {
  return (section.course?.code || (section as { course_code?: string }).course_code || '').toUpperCase();
}

/** Acha, na oferta do SIGAA, a turma que corresponde a uma turma do CADEE (mesma disciplina e mesmo horário). */
export function findCandidateTurma(section: Section, plano: PlanejamentoMatricula | undefined): TurmaCandidata | null {
  if (!plano) return null;
  const code = sectionCourseCode(section);
  const comp = plano.candidatos.find((c) => c.codigo.toUpperCase() === code);
  if (!comp) return null;
  const slots = slotSet(section.time_codes || []);
  const match = comp.turmas.find((t) => sameSlots(slots, slotSet([t.horario_codigo])));
  if (match) return match;
  return comp.turmas.length === 1 ? comp.turmas[0] : null;
}

/** Converte as turmas do planejador em escolhas para POST /v1/planejamento/simular. */
export function toEscolhas(sections: Section[], plano: PlanejamentoMatricula | undefined) {
  const escolhas: EscolhaTurma[] = [];
  const naoIdentificadas: string[] = [];
  for (const section of sections) {
    const code = sectionCourseCode(section);
    if (!code) continue;
    const turma = findCandidateTurma(section, plano);
    if (turma?.turma_id) {
      escolhas.push({ turma_id: turma.turma_id });
    } else if (turma?.codigo_turma) {
      escolhas.push({ codigo: code, turma: turma.codigo_turma });
    } else {
      escolhas.push({ codigo: code });
      naoIdentificadas.push(code);
    }
  }
  return { escolhas, naoIdentificadas };
}

/** Caminho inverso: acha a turma do CADEE para um item sugerido pelo SIGAA. */
export function findStaticSection(
  item: { codigo: string; turma_id: number | null; turma: string | null },
  plano: PlanejamentoMatricula | undefined,
  allSections: Section[],
): Section | null {
  const code = item.codigo.toUpperCase();
  const candidates = allSections.filter((s) => sectionCourseCode(s) === code);
  if (candidates.length === 0) return null;

  const comp: ComponenteCandidato | undefined = plano?.candidatos.find((c) => c.codigo.toUpperCase() === code);
  const turma = comp?.turmas.find(
    (t) => (item.turma_id && t.turma_id === item.turma_id) || (item.turma && t.codigo_turma === item.turma),
  );
  if (turma?.horario_codigo) {
    const slots = slotSet([turma.horario_codigo]);
    const match = candidates.find((s) => sameSlots(slots, slotSet(s.time_codes || [])));
    if (match) return match;
  }
  return candidates.length === 1 ? candidates[0] : null;
}
