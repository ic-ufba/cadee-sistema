// CADEE — acha, na lista de cursos, o curso que o SIGAA informou no vínculo do aluno.

interface ProgramaComparavel {
  title: string;
  program_type?: string;
  location?: string;
  time_code?: string;
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const TURNO_PALAVRAS: Record<string, string[]> = {
  N: ['NOTURNO', 'NOITE'],
  M: ['MATUTINO', 'MANHA'],
  T: ['VESPERTINO', 'TARDE'],
  MT: ['MATUTINO E VESPERTINO', 'DIURNO', 'MT'],
  I: ['INTEGRAL'],
};

/**
 * Compara o texto do vínculo (ex.: "CIÊNCIA DA COMPUTAÇÃO - SALVADOR - BACHARELADO - NOTURNO")
 * com os cursos da lista. O nome do curso precisa aparecer inteiro; grau, cidade e turno desempatam.
 * Devolve null quando nada bate — aí o aluno escolhe na lista.
 */
export function encontrarCursoDoSigaa<T extends ProgramaComparavel>(cursoSigaa: string | undefined | null, programas: T[]): T | null {
  if (!cursoSigaa) return null;
  const alvo = ` ${normalizar(cursoSigaa)} `;
  let melhor: T | null = null;
  let melhorNota = 0;

  for (const p of programas) {
    const titulo = normalizar(p.title || '');
    if (!titulo || !alvo.includes(` ${titulo} `)) continue;
    let nota = titulo.length * 10;
    if (p.program_type && alvo.includes(` ${normalizar(p.program_type)} `)) nota += 5;
    if (p.location && alvo.includes(` ${normalizar(p.location)} `)) nota += 3;
    const palavras = p.time_code ? TURNO_PALAVRAS[p.time_code] : undefined;
    if (palavras?.some((w) => alvo.includes(` ${w} `))) nota += 3;
    if (nota > melhorNota) {
      melhor = p;
      melhorNota = nota;
    }
  }
  return melhor;
}
