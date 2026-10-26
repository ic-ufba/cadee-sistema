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
  fetchProgramaComponente,
  isSigaaApiConfigured,
  type ComponenteCurricular,
  type ProgramaComponente,
} from '@/services/sigaaApi';
import { mergeCourseDetail } from '@/lib/courseEnrichment';

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

export function useSections() {
  return useQuery<Section[], Error>({
    queryKey: ['sections'],
    queryFn: fetchSections,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 12,
  });
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
  return useQuery<Section[], Error>({
    queryKey: ['course-sections-by-code', courseCode],
    queryFn: () => courseCode ? fetchSectionsByCourseCode(courseCode) : Promise.reject(new Error('Código não fornecido')),
    enabled: !!courseCode,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
  });
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
