import type { Section } from '@/services/api';
import { getSpplitedCode, parseTimeCodes } from '@/lib/schedule';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';

/** Siglas na ordem da grade (o dígito do SIGAA 2..7 vira SEG..SAB). */
export const SIGLAS_DIA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as const;
export const ROTULO_DIA: Record<string, string> = { SEG: 'SEG', TER: 'TER', QUA: 'QUA', QUI: 'QUI', SEX: 'SEX', SAB: 'SÁB' };
export const HORARIOS_GRADE = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35', '13:00', '13:55', '14:50', '15:45', '16:40', '17:35', '18:30', '19:25', '20:20', '21:15'];

export const codigoDaTurma = (s: Section) => s.course?.code || (s as { course_code?: string }).course_code || '';

/** Códigos unitários de horário de uma turma (ex.: 35N12 → 3N1, 3N2, 5N1, 5N2). */
export function codigosUnitarios(s: Section): string[] {
  const codes = Array.isArray(s.time_codes) ? s.time_codes : [];
  return codes.flatMap((c) => getSpplitedCode(c)).filter((c) => /^[2-7][MTN][1-6]$/i.test(c)).map((c) => c.toUpperCase());
}

/** Posição na grade: dia 0..5 (SEG..SAB) e linha 0..15 (07:00..21:15). */
export function posicaoDoCodigo(codigo: string): { dia: number; linha: number } | null {
  const m = codigo.match(/^([2-7])([MTN])([1-6])$/i);
  if (!m) return null;
  const dia = Number(m[1]) - 2;
  const slot = Number(m[3]) - 1;
  const turno = m[2].toUpperCase();
  const linha = turno === 'M' ? slot : turno === 'T' ? 6 + slot : 12 + slot;
  if (linha > 15) return null;
  return { dia, linha };
}

export type Choque = {
  a: Section;
  b: Section;
  codigoA: string;
  codigoB: string;
  dias: string[]; // SEG..SAB
  inicio: string;
  fim: string;
};

/** Pares de turmas (de disciplinas diferentes) que têm aula no mesmo dia e horário. */
export function encontrarChoques(secoes: Section[]): Choque[] {
  const unit = secoes.map((s) => new Set(codigosUnitarios(s)));
  const out: Choque[] = [];
  for (let i = 0; i < secoes.length; i++) {
    for (let j = i + 1; j < secoes.length; j++) {
      const codA = codigoDaTurma(secoes[i]);
      const codB = codigoDaTurma(secoes[j]);
      if (!codA || !codB || getBlockCourseBaseCode(codA) === getBlockCourseBaseCode(codB)) continue;
      const comuns = [...unit[i]].filter((c) => unit[j].has(c));
      if (comuns.length === 0) continue;
      const faixas = parseTimeCodes(comuns);
      const dias = SIGLAS_DIA.filter((_, d) => comuns.some((c) => Number(c[0]) - 2 === d));
      const inicio = faixas.map((f) => f.horarioInicio).sort()[0];
      const fim = faixas.map((f) => f.horarioFim).sort().slice(-1)[0];
      out.push({ a: secoes[i], b: secoes[j], codigoA: codA, codigoB: codB, dias: [...dias], inicio, fim });
    }
  }
  return out;
}

/** Se a turma choca com alguma da grade, devolve o código da primeira e o dia/horário do choque. */
export function chocaCom(turma: Section, grade: Section[]): { codigo: string; quando: string } | null {
  const minha = new Set(codigosUnitarios(turma));
  const base = getBlockCourseBaseCode(codigoDaTurma(turma));
  for (const s of grade) {
    const cod = codigoDaTurma(s);
    if (!cod || getBlockCourseBaseCode(cod) === base) continue;
    const comum = codigosUnitarios(s).find((c) => minha.has(c));
    if (comum) {
      const f = parseTimeCodes([comum])[0];
      const dia = SIGLAS_DIA[Number(comum[0]) - 2];
      return { codigo: getBlockCourseBaseCode(cod), quando: `${ROTULO_DIA[dia]} ${f?.horarioInicio ?? ''}`.trim() };
    }
  }
  return null;
}

export const juntarDias = (dias: string[]) => {
  const r = dias.map((d) => ROTULO_DIA[d] ?? d);
  return r.length <= 1 ? r.join('') : `${r.slice(0, -1).join(', ')} e ${r[r.length - 1]}`;
};
