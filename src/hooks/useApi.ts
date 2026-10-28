import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  fetchPrograms, 
  fetchCourses, 
  fetchSections, 
  fetchCourseDetail,
  fetchCourseByCode,
  fetchSectionsByCourseCode,
  fetchProgramDetail,
  getProgramCourseCodes,
  Program, 
  Course, 
  Section,
  CourseDetail,
  ProgramDetail
} from '@/services/api';
import {
  fetchComponentePublico,
  fetchCursosPublicos,
  fetchProgramaComponente,
  fetchTurmasDoCursoPublico,
  isSigaaApiConfigured,
  type ComponenteCurricular,
  type ProgramaComponente,
} from '@/services/sigaaApi';
import { mergeCourseDetail } from '@/lib/courseEnrichment';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { extractCurrentTerm } from '@/lib/semester';
import { escolherCursoSigaa, mesclarOfertas, separarTermo, termoPelaData, turmasParaSections } from '@/lib/ofertaAoVivo';

export function usePrograms() {
  const result = useQuery<Program[], Error>({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const programs = result.data || [];
  return { ...result, data: programs };
}

export function useCourses() {
  return useQuery<Course[], Error>({
    queryKey: ['courses'],
    queryFn: fetchCourses,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

// Query config para um programa (ProgramDetail) por id_ref
// (removido) batch por código – use useQueries diretamente onde precisar

// ---------- Oferta do semestre: SIGAA ao vivo primeiro, API estática como reserva ----------

const CURSO_SIGAA_KEY = 'cadee:cursoSigaa';

function lerCursosSigaa(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CURSO_SIGAA_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Id público do curso no SIGAA (descoberto uma vez pelo nome e guardado no navegador). */
async function idDoCursoSigaa(programa: Program): Promise<number | null> {
  const salvos = lerCursosSigaa();
  if (salvos[programa.id_ref]) return salvos[programa.id_ref];
  const resposta = await fetchCursosPublicos(programa.title);
  const id = escolherCursoSigaa(resposta?.itens ?? [], programa);
  if (id) {
    try {
      localStorage.setItem(CURSO_SIGAA_KEY, JSON.stringify({ ...salvos, [programa.id_ref]: id }));
    } catch {
      /* sem armazenamento: descobre de novo na próxima vez */
    }
  }
  return id;
}

async function fetchOfertasAoVivo(programas: Program[], termo: string, estaticas: Section[]): Promise<Section[]> {
  const t = separarTermo(termo);
  if (!t) throw new Error('Período letivo desconhecido');
  const listas = await Promise.all(
    programas.map(async (p) => {
      const id = await idDoCursoSigaa(p);
      if (!id) return [];
      const r = await fetchTurmasDoCursoPublico(id, t.ano, t.periodo);
      const itens = Array.isArray(r) ? r : r?.itens ?? [];
      return turmasParaSections(itens, p, termo, estaticas);
    }),
  );
  const todas = listas.flat();
  // nada aproveitável = trata como falha, e a API estática segue valendo
  if (todas.length === 0) throw new Error('O SIGAA não devolveu turmas para o curso');
  return todas;
}

export type FonteOfertas = 'sigaa' | 'estatica';

/**
 * Turmas do semestre. Primeira opção: o SIGAA ao vivo (rota pública da {sigaa} api), para o curso do aluno.
 * Se a API não estiver configurada, cair ou não achar o curso, vale a API estática — que também cobre os
 * outros cursos e o catálogo global. Enquanto o SIGAA responde, a estática aparece para a tela não ficar vazia.
 */
export function useSections() {
  const estatica = useQuery<Section[], Error>({
    queryKey: ['sections'],
    queryFn: fetchSections,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 12,
  });
  const { myPrograms } = useMyPrograms();
  const termo = estatica.data ? extractCurrentTerm(estatica.data) ?? termoPelaData() : estatica.isError ? termoPelaData() : null;
  const chaveProgramas = myPrograms.map((p) => p.id_ref).join(',');

  const aoVivo = useQuery<Section[], Error>({
    queryKey: ['sections-sigaa', chaveProgramas, termo],
    queryFn: () => fetchOfertasAoVivo(myPrograms, termo!, estatica.data ?? []),
    enabled: isSigaaApiConfigured && myPrograms.length > 0 && !!termo,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 12,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const titulos = useMemo(() => myPrograms.map((p) => p.title), [myPrograms]);
  const data = useMemo(
    () => (aoVivo.data ? mesclarOfertas(estatica.data ?? [], aoVivo.data, titulos) : estatica.data),
    [aoVivo.data, estatica.data, titulos],
  );
  const fonte: FonteOfertas = aoVivo.data ? 'sigaa' : 'estatica';

  return {
    ...estatica,
    data,
    isLoading: estatica.isLoading && !aoVivo.data,
    isError: estatica.isError && !aoVivo.data,
    fonte,
    /** quando a oferta ao vivo foi buscada (ms) */
    atualizadoEm: aoVivo.data ? aoVivo.dataUpdatedAt : null,
    buscandoAoVivo: aoVivo.isFetching,
  };
}

export function useCourseDetail(detailUrl: string | null | undefined) {
  return useQuery<CourseDetail, Error>({
    queryKey: ['course-detail', detailUrl],
    queryFn: () => detailUrl ? fetchCourseDetail(detailUrl) : Promise.reject(new Error('URL não fornecida')),
    enabled: !!detailUrl,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useCourseByCode(code: string | null | undefined) {
  const staticQuery = useQuery<CourseDetail, Error>({
    queryKey: ['course-by-code', code],
    queryFn: () => code ? fetchCourseByCode(code) : Promise.reject(new Error('Código não fornecido')),
    enabled: !!code,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // Detalhe ao vivo do SIGAA público (ementa, CH e requisitos atualizados). Só pra disciplina aberta.
  const liveQuery = useLiveComponent(code);
  const { data: coursesIndex } = useCourses();

  const data = useMemo(() => {
    if (!code) return staticQuery.data;
    const names = new Map((coursesIndex ?? []).map((c) => [c.code, c.name] as const));
    return mergeCourseDetail(code, staticQuery.data, liveQuery.data, names);
  }, [code, staticQuery.data, liveQuery.data, coursesIndex]);

  return {
    ...staticQuery,
    data,
    isLoading: staticQuery.isLoading && (!isSigaaApiConfigured || liveQuery.isLoading),
    isLive: !!liveQuery.data,
  };
}

/** Componente pelo código no SIGAA público, via {sigaa} api. Desligado sem VITE_SIGAA_API_URL. */
export function useLiveComponent(code: string | null | undefined) {
  return useQuery<ComponenteCurricular, Error>({
    queryKey: ['sigaa-componente', code],
    queryFn: () => fetchComponentePublico(code as string),
    enabled: !!code && isSigaaApiConfigured,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0,
  });
}

/** Programa do componente (objetivos, conteúdo, referências). `null` quando o SIGAA não tem programa cadastrado. */
export function useComponentProgram(code: string | null | undefined, enabled = true) {
  return useQuery<ProgramaComponente | null, Error>({
    queryKey: ['sigaa-programa', code],
    queryFn: () => fetchProgramaComponente(code as string),
    enabled: enabled && !!code && isSigaaApiConfigured,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 0,
  });
}

export function useCourseSections(courseCode: string | null | undefined) {
  const estatica = useQuery<Section[], Error>({
    queryKey: ['course-sections-by-code', courseCode],
    queryFn: () => courseCode ? fetchSectionsByCourseCode(courseCode) : Promise.reject(new Error('Código não fornecido')),
    enabled: !!courseCode,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
  // Se a disciplina veio do SIGAA ao vivo, as turmas dela saem da oferta mesclada
  const { data: todas, fonte } = useSections();
  const doSigaa = useMemo(() => {
    if (fonte !== 'sigaa' || !courseCode || !todas) return null;
    const daDisciplina = todas.filter((s) => s.course?.code === courseCode);
    return daDisciplina.some((s) => (s as { fonte?: string }).fonte === 'sigaa') ? daDisciplina : null;
  }, [fonte, courseCode, todas]);
  return doSigaa ? { ...estatica, data: doSigaa, isLoading: false, isError: false } : estatica;
}

export function useProgramDetail(detailUrl: string | null | undefined) {
  return useQuery<ProgramDetail, Error>({
    queryKey: ['program-detail', detailUrl],
    queryFn: () => detailUrl ? fetchProgramDetail(detailUrl) : Promise.reject(new Error('URL não fornecida')),
    enabled: !!detailUrl,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useProgramCourseCodes(programIdRef: string | null | undefined) {
  return useQuery<string[], Error>({
    queryKey: ['program-course-codes', programIdRef],
    queryFn: () => programIdRef ? getProgramCourseCodes(programIdRef) : Promise.reject(new Error('ID não fornecido')),
    enabled: !!programIdRef,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
