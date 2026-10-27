// CADEE — textos do curso para a interface (só formatação, sem regra de negócio).

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'com']);

/** "CIÊNCIA DA COMPUTAÇÃO" → "Ciência da Computação" */
export function tituloCurso(title?: string): string {
  if (!title) return 'Curso';
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

const TURNOS: Record<string, string> = {
  M: 'Manhã',
  T: 'Tarde',
  N: 'Noite',
  I: 'Integral',
  MT: 'Manhã e tarde',
  MN: 'Manhã e noite',
  TN: 'Tarde e noite',
  MTN: 'Integral',
};

/** Código de turno do SIGAA → texto ("N" → "Noite"). Devolve null quando não é turno. */
export function turnoCurso(code?: string): string | null {
  if (!code) return null;
  return TURNOS[code] ?? null;
}

type ProgramaBasico = { title?: string; program_type?: string; time_code?: string; location?: string };

/** "Licenciatura · Noite" (tipo e turno, quando existirem) */
export function detalheCurso(p?: ProgramaBasico): string {
  if (!p) return '';
  const partes = [p.program_type ? tituloCurso(p.program_type) : null, turnoCurso(p.time_code)].filter(Boolean);
  return partes.join(' · ');
}

/** "Computação · Licenciatura · Noite" */
export function descricaoCurso(p?: ProgramaBasico): string {
  if (!p) return '';
  return [tituloCurso(p.title), detalheCurso(p)].filter(Boolean).join(' · ');
}

/** 72.24 → "72,2%" (casas decimais no padrão brasileiro) */
export function porcento(valor: number, casas = 1): string {
  const v = Number.isFinite(valor) ? valor : 0;
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** "Eduarda Maria Almeida" → "EA" */
export function iniciais(nome?: string): string {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/** "EDUARDA MARIA ALMEIDA" → "Eduarda Almeida" */
export function nomeCurto(nome?: string): string {
  if (!nome) return '';
  const p = nome.trim().split(/\s+/);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return p.length > 1 ? `${cap(p[0])} ${cap(p[p.length - 1])}` : cap(p[0]);
}
