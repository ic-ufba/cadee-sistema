// CADEE — oferta do semestre direto do SIGAA (rota pública da {sigaa} api), com a API estática como reserva.
//
// A rota pública /v1/publico/cursos/{id}/turmas devolve as turmas do período com vaga reservada pro curso,
// docentes e horário. Aqui ela vira o mesmo formato `Section` da API estática, para o resto do sistema
// não precisar saber de onde veio. A leitura dos campos é tolerante (aceita nomes alternativos), porque
// o SIGAA muda e a API pode ganhar campos; o que não der para ler fica de fora e a estática cobre.
import type { Program, Section } from '@/services/api';

type Bruto = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const primeiro = (o: Bruto, chaves: string[]): unknown => {
  for (const k of chaves) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

function normalizar(t: string) {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Período letivo pela data, para quando a API estática não informa: jan–jun = x.1, jul–dez = x.2. */
export function termoPelaData(d = new Date()): string {
  return `${d.getFullYear()}.${d.getMonth() >= 6 ? 2 : 1}`;
}

export function separarTermo(termo: string): { ano: number; periodo: number } | null {
  const m = termo.match(/^(\d{4})\.(\d)$/);
  return m ? { ano: Number(m[1]), periodo: Number(m[2]) } : null;
}

// ------------------------------------------------------------------ curso do SIGAA

const TURNOS: Record<string, string[]> = {
  N: ['NOTURNO', 'NOITE'],
  M: ['MATUTINO', 'MANHA'],
  T: ['VESPERTINO', 'TARDE'],
  MT: ['MATUTINO E VESPERTINO', 'DIURNO'],
  I: ['INTEGRAL'],
};

/** Acha, na lista pública de cursos do SIGAA, o curso que corresponde ao do CADEE. Devolve o id ou null. */
export function escolherCursoSigaa(cursos: Bruto[], programa: Program): number | null {
  const titulo = normalizar(programa.title || '');
  if (!titulo) return null;
  let melhor: number | null = null;
  let melhorNota = 0;
  for (const c of cursos) {
    const id = numero(primeiro(c, ['id', 'curso_id', 'id_curso', 'codigo']));
    if (id === null) continue;
    const nome = normalizar(texto(primeiro(c, ['nome', 'curso', 'titulo', 'descricao'])));
    const tudo = ` ${normalizar(Object.values(c).map(texto).filter(Boolean).join(' '))} `;
    let nota = 0;
    if (nome === titulo) nota += 100;
    else if (nome.startsWith(`${titulo} `) || ` ${nome} `.includes(` ${titulo} `)) nota += 60;
    else continue;
    if (programa.program_type && tudo.includes(` ${normalizar(programa.program_type)} `)) nota += 10;
    if (programa.location && tudo.includes(` ${normalizar(programa.location)} `)) nota += 6;
    if (programa.mode && tudo.includes(` ${normalizar(programa.mode)} `)) nota += 3;
    const turnos = programa.time_code ? TURNOS[programa.time_code] : undefined;
    if (turnos?.some((w) => tudo.includes(` ${w} `))) nota += 4;
    if (nota > melhorNota) {
      melhor = id;
      melhorNota = nota;
    }
  }
  return melhor;
}

// ------------------------------------------------------------------ turmas → Section

const CODIGO_HORARIO = /^[2-7]+[MTN]+[1-7]+$/i;

function codigosDeHorario(t: Bruto): string[] {
  const cru = texto(primeiro(t, ['horario_codigo', 'codigo_horario', 'horario']));
  const doTexto = cru
    .split(/[\s,;/]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => CODIGO_HORARIO.test(c));
  if (doTexto.length > 0) return doTexto;
  // sem código: monta pelo horário decodificado (dia 2..7, turno, aula)
  const horarios = Array.isArray(t.horarios) ? (t.horarios as Bruto[]) : [];
  return horarios
    .map((h) => {
      const dia = numero(h.dia_numero);
      const turno = texto(h.turno).toUpperCase();
      const aula = numero(h.aula);
      return dia && /^[MTN]$/.test(turno) && aula ? `${dia}${turno}${aula}` : '';
    })
    .filter(Boolean);
}

function docentes(t: Bruto): string[] {
  const lista = primeiro(t, ['docentes', 'professores', 'docente']);
  if (Array.isArray(lista)) {
    return lista.map((d) => (typeof d === 'string' ? d : texto((d as Bruto)?.nome))).filter(Boolean);
  }
  const s = texto(lista);
  return s ? s.split(/\s*[,;]\s*/).filter(Boolean) : [];
}

function vagasReservadas(t: Bruto): number {
  const v = primeiro(t, ['vagas_reservadas', 'reservadas', 'reserva', 'vagas_curso', 'vagas']);
  const n = numero(v);
  if (n !== null) return n;
  if (Array.isArray(v)) {
    return v.reduce((soma: number, r) => {
      const o = r as Bruto;
      const direto = numero(o.vagas) ?? numero(o.total);
      return soma + (direto ?? (numero(o.ingressantes) ?? 0) + (numero(o.demais) ?? 0));
    }, 0);
  }
  if (v && typeof v === 'object') {
    const o = v as Bruto;
    return numero(o.total) ?? (numero(o.ingressantes) ?? 0) + (numero(o.demais) ?? 0);
  }
  return 0;
}

const chaveHorario = (codes: string[]) => [...codes].map((c) => c.toUpperCase()).sort().join(' ');

/**
 * Converte as turmas da rota pública em `Section`. Usa a turma da API estática equivalente (mesma disciplina
 * e mesmo horário) para manter o id (assim a grade salva continua reconhecendo a turma) e completar vagas.
 */
export function turmasParaSections(turmas: Bruto[], programa: Program, termo: string, estaticas: Section[]): Section[] {
  const estaticasPorCodigo = new Map<string, Section[]>();
  for (const s of estaticas) {
    const c = s.course?.code;
    if (!c) continue;
    if (!estaticasPorCodigo.has(c)) estaticasPorCodigo.set(c, []);
    estaticasPorCodigo.get(c)!.push(s);
  }

  const out: Section[] = [];
  for (const t of turmas) {
    const comp = (t.componente && typeof t.componente === 'object' ? (t.componente as Bruto) : {}) as Bruto;
    const codigo = texto(primeiro(t, ['componente_codigo', 'codigo_componente', 'codigo'])) || texto(comp.codigo);
    if (!codigo) continue;
    const nome = texto(primeiro(t, ['componente_nome', 'nome_componente', 'nome'])) || texto(comp.nome) || codigo;
    const turma = texto(primeiro(t, ['codigo_turma', 'turma', 'numero_turma']));
    const time_codes = codigosDeHorario(t);
    const gemea = (estaticasPorCodigo.get(codigo) ?? []).find(
      (s) => chaveHorario(Array.isArray(s.time_codes) ? s.time_codes.flatMap((c) => c.split(/\s+/)) : []) === chaveHorario(time_codes),
    );
    const capacidade = numero(primeiro(t, ['capacidade', 'vagas_total', 'vagas_ofertadas']));
    const matriculados = numero(primeiro(t, ['matriculados', 'ocupadas', 'vagas_ocupadas']));
    const reservadas = vagasReservadas(t);
    const idSigaa = texto(primeiro(t, ['id', 'id_turma', 'turma_id']));

    out.push({
      course: { code: codigo, name: nome },
      term: termo,
      id_ref: gemea?.id_ref ?? (idSigaa || `sigaa-${termo}-${codigo}-${turma || chaveHorario(time_codes) || out.length}`),
      location_table: texto(primeiro(t, ['local', 'sala'])) || gemea?.location_table || '',
      mode: texto(primeiro(t, ['modalidade'])) || gemea?.mode || 'Presencial',
      seats_count: capacidade ?? gemea?.seats_count ?? 0,
      seats_accepted: matriculados ?? gemea?.seats_accepted ?? 0,
      seats_requested: gemea?.seats_requested ?? 0,
      seats_rerequested: gemea?.seats_rerequested ?? 0,
      spots_reserved: [
        {
          program: {
            title: programa.title,
            location: programa.location,
            program_type: programa.program_type,
            mode: programa.mode,
            time_code: programa.time_code,
            id_ref: programa.id_ref,
            code: programa.code,
            detail_url: programa.detail_url,
          },
          seats_count: reservadas,
        },
      ],
      teachers: docentes(t),
      time_codes,
      ...(turma ? { section_code: turma } : {}),
      fonte: 'sigaa',
    } as Section);
  }
  return out;
}

/**
 * Junta as duas fontes. Nas disciplinas que vieram do SIGAA, as turmas com reserva pro curso do aluno passam a
 * ser as de lá (atualizadas; as canceladas somem). Turmas reservadas a outros cursos e as disciplinas que não
 * vieram do SIGAA seguem com a API estática.
 */
export function mesclarOfertas(estaticas: Section[], aoVivo: Section[], titulosDoCurso: string[]): Section[] {
  if (aoVivo.length === 0) return estaticas;
  const cobertas = new Set(aoVivo.map((s) => s.course.code));
  const titulos = new Set(titulosDoCurso.map((t) => normalizar(t)));
  const idsAoVivo = new Set(aoVivo.map((s) => s.id_ref));
  const ficam = estaticas.filter((s) => {
    if (idsAoVivo.has(s.id_ref)) return false;
    if (!cobertas.has(s.course?.code)) return true;
    const reservadaPraMim = (s.spots_reserved ?? []).some((r) => titulos.has(normalizar(r.program?.title ?? '')));
    return !reservadaPraMim;
  });
  return [...ficam, ...aoVivo];
}
