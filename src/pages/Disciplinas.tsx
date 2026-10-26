import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Search, AlertCircle, X, BookOpen, Upload, ChevronLeft, ChevronRight, ChevronDown, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { reduce, append } from 'ramda'
import { MainLayout } from '@/components/layout/MainLayout';
import { DisciplineCard } from '@/components/disciplines/DisciplineCard';
import { DisciplineDetail } from '@/components/disciplines/DisciplineDetail';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useApp } from '@/contexts/AppContext';
import { useCourses as useAllCourses, useSections, useCourseByCode } from '@/hooks/useApi';
import { useMyCourses } from '@/hooks/useMyCourses';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useMySections } from '@/hooks/useMySections';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';
import {Course, CourseApi, fetchCourseDetail, fetchCourseByCode} from '@/services/api';
import {cn, getSemesterTitle} from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { useMode } from '@/hooks/useMode';
import { useFavoriteCourses } from '@/hooks/useFavoriteCourses';
import { useFilter } from '@/hooks/useFilter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCompleteHistory, type WorkloadData, codeRegex } from '@/utils/historyParser';

const Disciplinas = () => {
  const { completedDisciplines, toggleCompletedDiscipline, getDisciplineStatus, setDisciplineStatus, clearDisciplineStatus } = useApp();
  const { myPrograms } = useMyPrograms();
  const { courses, isLoading, levels } = useMyCourses();
  const { isSimplified, isFull, setMode } = useMode();
  const { isFavorite, favoriteCodes, toggleFavorite } = useFavoriteCourses();
  const { data: allCourses = [] } = useAllCourses();
  const { mySections } = useMySections();
  const queryClient = useQueryClient();

  const selectedBaseCodes = useMemo(() => {
    const set = new Set<string>();
    for (const section of mySections) {
      const code = section.course?.code || (section as any).course_code;
      if (code) {
        // Adiciona tanto o código original quanto o código base
        // Isso garante que MATB59.0 no planejador marque tanto MATB59.0 quanto MATB59 como selecionados
        set.add(code);
        set.add(getBlockCourseBaseCode(code));
      }
    }
    return set;
  }, [mySections]);

  const selectedBaseCodesArray = useMemo(() => Array.from(selectedBaseCodes), [selectedBaseCodes]);
  const completedCodesArray = useMemo(() => {
    const set = new Set<string>();
    for (const code of completedDisciplines) {
      set.add(getBlockCourseBaseCode(code));
    }
    return Array.from(set);
  }, [completedDisciplines]);

  // Cache LOCAL de detalhes (code -> CourseApi) — usa em memória + cache do TanStack.
  // Não dispara fetch automático de TODAS as disciplinas — busca SOB DEMANDA.
  const [detailsCache, setDetailsCache] = useState<Map<string, CourseApi>>(new Map());
  // Set de códigos que já tentamos buscar (mesmo que 404) para não ficar repetindo.
  const [attemptedCodes, setAttemptedCodes] = useState<Set<string>>(new Set());

  // Helper extrai equivalentes de um detalhe já carregado (dev base codes)
  const extractEquivalentBaseCodes = useCallback((detail: CourseApi | undefined): Set<string> => {
    const out = new Set<string>();
    const equivalences = (detail as any)?.equivalences as any[][] | undefined;
    if (!equivalences) return out;
    for (const grp of equivalences) {
      if (!Array.isArray(grp)) continue;
      for (const eq of grp) {
        const eqCode = (eq as any)?.code as string | undefined;
        if (eqCode) out.add(getBlockCourseBaseCode(eqCode));
      }
    }
    return out;
  }, []);

  const getPersistedEquivalences = useCallback((): Record<string, string[]> => {
    try {
      return JSON.parse(localStorage.getItem('cadee_equivalences') || '{}');
    } catch {
      return {};
    }
  }, []);

  const persistEquivalences = useCallback((base: string, eqs: string[]) => {
    if (eqs.length === 0) return;
    try {
      const map = JSON.parse(localStorage.getItem('cadee_equivalences') || '{}');
      map[base] = eqs;
      localStorage.setItem('cadee_equivalences', JSON.stringify(map));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Helpers para ler/escrever cache do queryClient (devolve em memória se já existir)
  const getCachedDetail = useCallback((code: string): CourseApi | undefined => {
    const k = getBlockCourseBaseCode(code);
    if (detailsCache.has(k)) return detailsCache.get(k)!;
    // Também tenta pegar do cache do QueryClient (cache compartilhado)
    const fromQuery = queryClient.getQueryData<CourseApi>(['course-by-code', k]);
    if (fromQuery) return fromQuery;
    return undefined;
  }, [detailsCache, queryClient]);

  // Tenta trazer do cache, ou dispara fetch único e salva em cache
  const fetchDetailLazy = useCallback(async (code: string): Promise<CourseApi | null> => {
    const k = getBlockCourseBaseCode(code);
    if (attemptedCodes.has(k)) {
      const cached = getCachedDetail(k);
      return cached || null;
    }
    // Primeiro, checa novamente (poderia ter chegado via outro call)
    const existing = getCachedDetail(k);
    if (existing) return existing;
    try {
      // Usa o TanStack para garantir dedup de requisição e caching global
      const data = await queryClient.fetchQuery({
        queryKey: ['course-by-code', k],
        queryFn: () => fetchCourseByCode(k),
        staleTime: 1000 * 60 * 60,
      });
      if (data) {
        const eqs = extractEquivalentBaseCodes(data as CourseApi);
        if (eqs.size > 0) persistEquivalences(k, Array.from(eqs));
        
        setDetailsCache(prev => {
          const next = new Map(prev);
          next.set(k, data as CourseApi);
          return next;
        });
      }
      setAttemptedCodes(prev => { const next = new Set(prev); next.add(k); return next; });
      return (data as CourseApi) || null;
    } catch {
      setAttemptedCodes(prev => { const next = new Set(prev); next.add(k); return next; });
      return null;
    }
  }, [queryClient, attemptedCodes, getCachedDetail, extractEquivalentBaseCodes, persistEquivalences]);

  // Fetch INICIAL: apenas disciplinas SELECIONADAS + CURSADAS (pequeno conjunto, nunca todas).
  // Isso evita as ~300 requisições no carregamento.
  useEffect(() => {
    const priorities = new Set<string>();
    for (const b of selectedBaseCodesArray) priorities.add(b);
    for (const b of completedCodesArray) priorities.add(b);
    if (priorities.size === 0) return;

    let cancelled = false;
    (async () => {
      // Concorrência limitada: carrega em lotes de 5 com delay para não estourar o navegador
      const arr = Array.from(priorities).filter(c => !attemptedCodes.has(c));
      for (let i = 0; i < arr.length; i += 5) {
        if (cancelled) return;
        const chunk = arr.slice(i, i + 5);
        await Promise.all(chunk.map(c => fetchDetailLazy(c).catch(() => null)));
        // Pequeno delay entre lotes para não travar a UI
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    })();
    return () => { cancelled = true; };
    // Executar apenas quando listas mudarem e após mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Retorna lista de baseCodes relacionados a um código (ele próprio + equivalentes)
  // Funciona com lazy fetching: se precisar e não tiver, dispara fetch.
  // Quando chamados de useMemo (síncrono), devolve apenas o que já está em cache.
  const getRelatedBaseCodesSync = useCallback((code: string): Set<string> => {
    const out = new Set<string>();
    const base = getBlockCourseBaseCode(code);
    out.add(base);
    
    // 1. From current detail in cache
    const detail = getCachedDetail(base);
    if (detail) {
      for (const b of extractEquivalentBaseCodes(detail)) out.add(b);
    }
    
    // 2. From persisted cache (survives page reloads)
    const persisted = getPersistedEquivalences();
    if (persisted[base]) {
      for (const b of persisted[base]) out.add(b);
    }

    // 3. Inverse from detailsCache
    for (const [key, d] of detailsCache.entries()) {
      if (key === base) continue;
      const eqs = extractEquivalentBaseCodes(d);
      if (eqs.has(base)) out.add(key);
    }

    // 4. Inverse from persisted cache
    for (const [key, eqsArray] of Object.entries(persisted)) {
      if (key === base) continue;
      if ((eqsArray as string[]).includes(base)) out.add(key);
    }

    // 5. From courses array (fallback)
    for (const c of courses) {
      const cBase = getBlockCourseBaseCode(c.code);
      if (cBase === base) continue;
      const eqs = extractEquivalentBaseCodes(c as any);
      if (eqs.has(base)) out.add(cBase);
    }
    return out;
  }, [detailsCache, getCachedDetail, courses, extractEquivalentBaseCodes, getPersistedEquivalences]);

  // Verifica equivalência on-demand (usado em eventos/UI — pode disparar fetch)
  const getRelatedBaseCodesAsync = useCallback(async (code: string): Promise<Set<string>> => {
    const base = getBlockCourseBaseCode(code);
    // Garante que o próprio código está carregado (ou tentamos)
    await fetchDetailLazy(base);
    const out = getRelatedBaseCodesSync(code);
    // Também dispara fetch para todas as equivalências encontradas (preenche cache)
    const toFetch: string[] = [];
    for (const b of out) {
      if (!attemptedCodes.has(b)) toFetch.push(b);
    }
    for (let i = 0; i < toFetch.length; i += 8) {
      const chunk = toFetch.slice(i, i + 8);
      await Promise.all(chunk.map(c => fetchDetailLazy(c).catch(() => null)));
    }
    // Depois de buscar, calcula de novo (pode ter novas equivalências)
    return getRelatedBaseCodesSync(code);
  }, [getRelatedBaseCodesSync, attemptedCodes, fetchDetailLazy]);

  const equivalentCodesToSelected = useMemo(() => {
    const set = new Set<string>();
    for (const base of selectedBaseCodes) {
      // Direction 1: selected -> its equivalences
      const rel = getRelatedBaseCodesSync(base);
      for (const r of rel) if (r !== base) set.add(r);
      // Direction 2: any course (loaded) whose equivalence is selected -> mark it
      for (const [key, d] of detailsCache.entries()) {
        if (selectedBaseCodes.has(key)) continue;
        const eqs = extractEquivalentBaseCodes(d);
        if (eqs.has(base)) set.add(key);
      }
    }
    return set;
  }, [selectedBaseCodes, detailsCache, getRelatedBaseCodesSync]);

  const equivalentCodesToCompleted = useMemo(() => {
    const set = new Set<string>();
    const completedSet = new Set(completedCodesArray);
    for (const base of completedSet) {
      const rel = getRelatedBaseCodesSync(base);
      for (const r of rel) if (r !== base) set.add(r);
      for (const [key, d] of detailsCache.entries()) {
        if (completedSet.has(key)) continue;
        const eqs = extractEquivalentBaseCodes(d);
        if (eqs.has(base)) set.add(key);
      }
    }
    return set;
  }, [completedCodesArray, detailsCache, getRelatedBaseCodesSync]);

  // Equivalent codes (bidirectional) — on demand
  const getEquivalentCodesForCourse = useCallback(async (code: string): Promise<string[]> => {
    const relatedBases = await getRelatedBaseCodesAsync(code);
    const codes = new Set<string>();
    for (const base of relatedBases) {
      for (const c of courses) {
        if (getBlockCourseBaseCode(c.code) === base) codes.add(c.code);
      }
      // Também adiciona o próprio se o baseCode bater
      if (getBlockCourseBaseCode(code) === base) codes.add(code);
    }
    // Remove o próprio código do resultado de equivalentes
    codes.delete(code);
    // Se o próprio código tem variantes de bloco (ex: MATB59.0 / MATB59.1), mantém todas
    // Mas sempre retorna código completo e não só base
    return Array.from(codes);
  }, [getRelatedBaseCodesAsync, courses]);

  // Sync fallback para useCallbacks que precisam rodar em render (síncrono) — 
  // usamos SOMENTE onde é necessário para validar direto, e apenas com dados já em cache.
  const getEquivalentCodesForCourseSync = useCallback((code: string): string[] => {
    const relatedBases = getRelatedBaseCodesSync(code);
    const codes = new Set<string>();
    for (const base of relatedBases) {
      for (const c of courses) {
        if (getBlockCourseBaseCode(c.code) === base) codes.add(c.code);
      }
      if (getBlockCourseBaseCode(code) === base) codes.add(code);
    }
    return Array.from(codes);
  }, [getRelatedBaseCodesSync, courses]);

  // Helper: verifica se o código (ou algum equivalente/bloco) tem status failed ou dropped.
  const hasAnyFailedOrDropped = useCallback((code: string): boolean => {
    const codesSync = new Set<string>([code, ...getEquivalentCodesForCourseSync(code)]);
    const base = getBlockCourseBaseCode(code);
    for (const c of courses) {
      if (getBlockCourseBaseCode(c.code) === base) codesSync.add(c.code);
    }
    for (const c of codesSync) {
      const s = getDisciplineStatus(c);
      if (s === 'failed' || s === 'dropped') return true;
    }
    return false;
  }, [getEquivalentCodesForCourseSync, getDisciplineStatus, courses]);

  const isCourseSelected = useCallback((code: string): boolean => {
    const baseCode = getBlockCourseBaseCode(code);
    
    if (selectedBaseCodes.has(baseCode)) return true;
    if (equivalentCodesToSelected.has(baseCode)) return true;
    
    return false;
  }, [selectedBaseCodes, equivalentCodesToSelected]);

  const isCourseCompleted = useCallback((code: string): boolean => {
    if (hasAnyFailedOrDropped(code)) return false;
    const baseCode = getBlockCourseBaseCode(code);
    
    const status = getDisciplineStatus(code);
    const directCompleted = completedDisciplines.includes(code) || status === 'approved';
    if (directCompleted) return true;
    
    if (equivalentCodesToCompleted.has(baseCode)) return true;
    
    return false;
  }, [completedDisciplines, equivalentCodesToCompleted, hasAnyFailedOrDropped, getDisciplineStatus]);

  // Toggle completed for a course and all its equivalents (async, usa lazy fetch)
  const handleToggleCompletedForAllEquivalents = useCallback(async (code: string) => {
    const relatedCodesAsync = await getEquivalentCodesForCourse(code);
    const allCodes = new Set<string>([code, ...relatedCodesAsync]);
    const currentlyCompleted = completedDisciplines.includes(code) || getDisciplineStatus(code) === 'approved';
    allCodes.forEach(c => {
      if (currentlyCompleted) {
        const isCompletedNow = completedDisciplines.includes(c);
        if (isCompletedNow) {
          toggleCompletedDiscipline(c);
        } else {
          if (getDisciplineStatus(c) === 'approved') {
            clearDisciplineStatus(c);
          }
        }
      } else {
        const isCompletedNow = completedDisciplines.includes(c) || getDisciplineStatus(c) === 'approved';
        if (!isCompletedNow) {
          toggleCompletedDiscipline(c);
        }
      }
    });
  }, [completedDisciplines, getDisciplineStatus, getEquivalentCodesForCourse, toggleCompletedDiscipline, clearDisciplineStatus]);

  // Toggle completed for a single course (síncrono, não usa equivalentes)
  const handleToggleCompletedSingle = useCallback((code: string) => {
    const currentlyCompleted = completedDisciplines.includes(code) || getDisciplineStatus(code) === 'approved';
    if (currentlyCompleted) {
      if (completedDisciplines.includes(code)) {
        toggleCompletedDiscipline(code);
      } else if (getDisciplineStatus(code) === 'approved') {
        clearDisciplineStatus(code);
      }
    } else {
      toggleCompletedDiscipline(code);
      setDisciplineStatus(code, 'approved');
    }
  }, [completedDisciplines, getDisciplineStatus, toggleCompletedDiscipline, clearDisciplineStatus, setDisciplineStatus]);

  const selectedProgram = myPrograms.find(Boolean);
  
  const [search, setSearch] = useState('');
  // search, semester and modal states
  const [activeSemester, setActiveSemester] = useState<number | null>(null);
  const [selectedDiscipline, setSelectedDisciplineState] = useState<Course | null>(null);
  // Abre modal com prefetch em background (uso nos cards)
  const openDiscipline = useCallback((course: Course) => {
    setSelectedDisciplineState(course);
    fetchDetailLazy(course.code).catch(() => null);
  }, [fetchDetailLazy]);
  // Setter que aceita null também (uso no onClose)
  const setSelectedDiscipline = useCallback((course: Course | null) => {
    setSelectedDisciplineState(course);
    if (course) fetchDetailLazy(course.code).catch(() => null);
  }, [fetchDetailLazy]);
  const [showDisciplinesModal, setShowDisciplinesModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'completed' | 'favorite' | 'import'; course?: Course; codes?: string[]; mainCode?: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [parsedSemesters, setParsedSemesters] = useState<Map<string, { approved: number, failed: number, dropped: number, notDone: number }>>(new Map());
  const [parsedWorkload, setParsedWorkload] = useState<WorkloadData | null>(null);
  const [disciplinesBySemester, setDisciplinesBySemester] = useState<Map<string, { approved: string[]; total: string[] }>>(new Map());
  const [importError, setImportError] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [prereqCache, setPrereqCache] = useState<Map<string, string[][]>>(new Map());
  const [isPrereqsLoading, setIsPrereqsLoading] = useState(false);
  const [showLoadComplete, setShowLoadComplete] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem('firstVisitDisciplinas');
    if (!hasVisited) {
      setShowDisciplinesModal(true);
    }
  }, []);

  const handleRestrictedAction = async (type: 'completed' | 'favorite', course: Course, mainCode?: string) => {
    if (type === 'completed') {
      // Se já está cursada, permite desmarcar diretamente sem verificar bloqueio
      if (isCourseCompleted(course.code)) {
        await handleToggleCompletedForAllEquivalents(course.code);
        if (mainCode && mainCode !== course.code) {
          await handleToggleCompletedForAllEquivalents(mainCode);
        }
        return;
      }
      
      // Se não está cursada e está bloqueada, mostra modal
      if (!hasAllPrereqsDone(course)) {
        setPendingAction({ type, course, mainCode });
        setShowBlockedModal(true);
        return;
      }
    }

    if (isSimplified) {
      setPendingAction({ type, course, mainCode });
      setShowUpgradeModal(true);
    } else {
      if (type === 'completed') {
        await handleToggleCompletedForAllEquivalents(course.code);
        if (mainCode && mainCode !== course.code) {
          await handleToggleCompletedForAllEquivalents(mainCode);
        }
      } else {
        toggleFavorite(course.code);
      }
    }
  };

  const confirmUpgrade = async () => {
    if (pendingAction) {
      setMode('full');
      localStorage.setItem('mode', 'full');
      localStorage.setItem('experienceMode', 'completa');
      setShowUpgradeModal(false);
      // Executar a ação após upgrade
      if (pendingAction.type === 'completed' && pendingAction.course) {
        await handleToggleCompletedForAllEquivalents(pendingAction.course.code);
      } else if (pendingAction.type === 'favorite' && pendingAction.course) {
        toggleFavorite(pendingAction.course.code);
      } else if (pendingAction.type === 'import' && pendingAction.codes) {
        applyImportedCodes(pendingAction.codes);
      }
      setPendingAction(null);
    }
  };

  const getPrerequisitesList = (course: Course): string[] => {
    let prereqs = getPrereqCodes(course);

    // cache from detalhes já buscados
    if (prereqs.length === 0) {
      const cached = prereqCache.get(course.code);
      if (cached && cached.length > 0) {
        // Se tem múltiplas opções no cache, usa a primeira para compatibilidade
        // A lógica completa está em hasAllPrereqsDone
        prereqs = cached[0] || [];
      }
    }

    // fallback: índice global
    if (prereqs.length === 0) {
      const fallback = allCoursesByCode.get(course.code);
      if (fallback) {
        const fbCodes = getPrereqCodes(fallback as any);
        if (fbCodes.length > 0) prereqs = fbCodes;
      }
    }

    return prereqs;
  };

  const markPrereqsAsCompleted = async () => {
    if (pendingAction?.course) {
      const prereqs = getPrerequisitesList(pendingAction.course);
      for (const code of prereqs) {
        if (!isCourseCompleted(code)) {
          await handleToggleCompletedForAllEquivalents(code);
        }
      }
      // Marca a disciplina atual também
      await handleToggleCompletedForAllEquivalents(pendingAction.course.code);
      // Se for equivalente, marca também a disciplina principal
      if (pendingAction.mainCode && pendingAction.mainCode !== pendingAction.course.code) {
        await handleToggleCompletedForAllEquivalents(pendingAction.mainCode);
      }
    }
    setShowBlockedModal(false);
    setPendingAction(null);
  };

  const markOnlyCurrentAsCompleted = async () => {
    if (pendingAction?.course) {
      await handleToggleCompletedForAllEquivalents(pendingAction.course.code);
      // Se for equivalente, marca também a disciplina principal
      if (pendingAction.mainCode && pendingAction.mainCode !== pendingAction.course.code) {
        await handleToggleCompletedForAllEquivalents(pendingAction.mainCode);
      }
    }
    setShowBlockedModal(false);
    setPendingAction(null);
  };

  // Carrega progressData salvo (para manter sincronizado com tela de Progresso)
  useEffect(() => {
    const load = () => {
      const savedData = localStorage.getItem('progressData');
      if (!savedData) return;
      try {
        const parsed = JSON.parse(savedData);
        setParsedCodes(parsed.codes || []);
        setParsedSemesters(new Map(parsed.semesters || []));
        setParsedWorkload(parsed.workload || null);
        setDisciplinesBySemester(new Map(parsed.disciplinesBySemester || []));
      } catch (error) {
        console.error('Erro ao carregar progressData:', error);
      }
    };
    load();
    // recarrega quando o histórico é sincronizado pelo SIGAA
    window.addEventListener('progressDataUpdated', load);
    return () => window.removeEventListener('progressDataUpdated', load);
  }, []);

  const handleParseImport = (text: string) => {
    setImportError('');
    const result = parseCompleteHistory(text);
    setParsedCodes(result.codes);
    setParsedSemesters(result.semesters);
    setParsedWorkload(result.workload);
    setDisciplinesBySemester(result.disciplinesBySemester);
    setImportText(text);

    // Salva no mesmo formato usado pela Home/Progress
    const dataToSave = {
      codes: result.codes,
      semesters: Array.from(result.semesters.entries()),
      workload: result.workload,
      disciplinesBySemester: Array.from(result.disciplinesBySemester.entries()),
    };
    localStorage.setItem('progressData', JSON.stringify(dataToSave));

    if (result.codes.length === 0 && !result.workload) {
      setImportError('Não foi possível encontrar disciplinas com status aprovado ou tabela de carga horária. Confira o texto ou tente outro arquivo.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setImportError('');
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjs = await import('pdfjs-dist');
        const { getDocument, GlobalWorkerOptions } = pdfjs as any;
        
        // Configurar o worker corretamente para Vite
        const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        GlobalWorkerOptions.workerSrc = workerSrc;

        const data = await file.arrayBuffer();
        const pdf = await getDocument({ 
          data,
          // Desabilitar worker para evitar problemas de CORS
          disableWorker: true,
          isEvalSupported: false
        }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str || '').join(' ');
          fullText += strings + '\n';
        }
        handleParseImport(fullText);
      } else {
        const text = await file.text();
        handleParseImport(text);
      }
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      setImportError('Não foi possível ler o PDF. Tente copiar e colar o texto do histórico como alternativa.');
    } finally {
      setIsParsing(false);
      if (event.target) event.target.value = '';
    }
  };

  const applyImportedCodes = (codes: string[]) => {
    codes.forEach(code => {
      if (!isCourseCompleted(code)) {
        handleToggleCompletedForAllEquivalents(code);
      }
    });
  };

  const handleApplyImport = () => {
    if (parsedCodes.length === 0) {
      setImportError('Nenhum código aprovado encontrado para aplicar.');
      return;
    }
    
    // Mudar automaticamente para modo completo quando histórico é importado
    if (isSimplified) {
      setMode('full');
    }
    
    applyImportedCodes(parsedCodes);
    setShowImportModal(false);
  };

  const coursesByLevel = useMemo(
      () =>
          reduce<Course, Record<string, Course[]>>((acc, course) => {
            const level = course.level
            acc[level] = append(course, acc[level] ?? []);
            return acc;
          }, {}, courses),
      [courses]
  );

  const allCoursesByCode = useMemo(() => new Map(allCourses.map((c) => [c.code, c])), [allCourses]);

  // Prefetch prereqs from course detail for courses without prereqs info
  // Otimizado: busca apenas quando necessário (lazy loading) e em lotes menores
  useEffect(() => {
    const missing = courses
      .filter((c) => getPrereqCodes(c).length === 0 && !prereqCache.has(c.code) && (c as any).detail_url)
      .map((c) => ({ code: c.code, url: (c as any).detail_url }));
    if (missing.length === 0) return;

    setIsPrereqsLoading(true);
    (async () => {
      const updates = new Map(prereqCache);
      
      // Processa em lotes de 5 para não sobrecarregar
      for (let i = 0; i < missing.length; i += 5) {
        const chunk = missing.slice(i, i + 5);
        await Promise.all(chunk.map(async (item) => {
          try {
            const detail = await fetchCourseDetail(item.url);
            const prereqs = (detail as any)?.prerequisites ?? [];
            
            // Processa múltiplas opções de pré-requisitos
            if (Array.isArray(prereqs) && prereqs.length > 0) {
              // Verifica se é array de arrays (múltiplas opções)
              if (Array.isArray(prereqs[0])) {
                // Já está no formato correto: array de arrays
                const options = prereqs.map((option: any[]) => 
                  option.map(pr => pr.code || (typeof pr === 'string' ? pr : ''))
                ).filter((codes: string[]) => codes.length > 0);
                if (options.length > 0) {
                  updates.set(item.code, options);
                } else {
                  updates.set(item.code, []);
                }
              } else {
                // É uma lista simples, converte para formato de opções
                const codes = getPrereqCodes({ prerequisites: prereqs } as any);
                if (codes.length > 0) {
                  updates.set(item.code, [codes]);
                } else {
                  updates.set(item.code, []);
                }
              }
            } else {
              updates.set(item.code, []);
            }
          } catch (e) {
            console.warn('Falha ao buscar pré-requisitos para', item.code, e);
            updates.set(item.code, []); // Marca como tentado mesmo com erro
          }
        }));
        
        // Atualiza o cache após cada lote para mostrar progresso
        setPrereqCache(new Map(updates));
      }
      
      setIsPrereqsLoading(false);
      setShowLoadComplete(true);
      setTimeout(() => setShowLoadComplete(false), 2000);
    })();
  }, [courses, prereqCache]);


  const normalizeCode = (val: any) => String(val || '').trim();

  const extractCodesFromString = (str: string) => {
    if (!str) return [] as string[];
    const matches = str.match(codeRegex) || [];
    if (matches.length > 0) return matches;
    return str
      .split(/[,;/|]/)
      .map((p) => p.trim())
      .filter(Boolean);
  };

  const baseCode = (code: string) => {
    const clean = code.replace(/[^A-Z0-9]/gi, '');
    const m = clean.match(/^([A-Z]+\d+)([A-Z])?$/);
    if (!m) return clean;
    return m[1];
  };

  const getPrereqCodes = (course?: Course | null) => {
    if (!course) return [] as string[];
    const raw: any =
      (course as any).prerequisites ??
      (course as any).prereqs ??
      (course as any).prerequisite_codes ??
      (course as any).prereq_codes ??
      (course as any).pre_requisites ??
      (course as any).requisites ??
      [];

    const asArray = Array.isArray(raw) ? raw : [raw];

    const extractCodes = (item: any): string[] => {
      if (!item) return [] as string[];
      if (Array.isArray(item)) {
        return item.flatMap(extractCodes);
      }
      // Object with code field
      if (typeof item === 'object') {
        const maybeCode = (item as any).code ?? (item as any).id_ref ?? (item as any).sigla;
        if (maybeCode) return [normalizeCode(maybeCode)];
        return Object.values(item).flatMap(extractCodes);
      }
      // String with codes and description
      const str = normalizeCode(item);
      if (!str) return [] as string[];
      return extractCodesFromString(str);
    };

    const codes = asArray.flatMap(extractCodes);

    return Array.from(new Set(codes));
  };

  const hasAllPrereqsDone = (course: Course) => {
    let prereqsOptions: string[][] = [];
    
    // Tenta obter pré-requisitos do detalhe do curso (formato com múltiplas opções)
    const cached = prereqCache.get(course.code);
    if (cached && cached.length > 0) {
      // O cache agora sempre contém array de arrays (múltiplas opções)
      prereqsOptions = cached;
    } else {
      // Tenta obter do próprio curso
      let prereqs = getPrereqCodes(course);
      
      // fallback: índice global
      if (prereqs.length === 0) {
        const fallback = allCoursesByCode.get(course.code);
        if (fallback) {
          const fbCodes = getPrereqCodes(fallback as any);
          if (fbCodes.length > 0) prereqs = fbCodes;
        }
      }
      
      if (prereqs.length > 0) {
        prereqsOptions = [prereqs];
      }
    }

    // Se ainda não temos pré-req e há detail_url, considerar bloqueado até carregar
    if (prereqsOptions.length === 0) {
      const detailUrl = (course as any)?.detail_url;
      if (detailUrl && !prereqCache.has(course.code)) {
        return false;
      }
      // Se não há detail_url ou já foi buscado e não tem pré-req, assume que não tem pré-req
      return true;
    }

    // Verifica se ALGUMA opção de pré-requisitos está completamente atendida
    // Se todas as opções estão vazias, considera que não tem pré-req
    const hasValidPrereqs = prereqsOptions.some(option => option.length > 0);
    if (!hasValidPrereqs) {
      return true; // Não tem pré-requisitos válidos
    }

    return prereqsOptions.some(prereqs => {
      if (prereqs.length === 0) return true; // Opção vazia = sem pré-reqs
      return prereqs.every((code) => {
        const norm = normalizeCode(code);
        const base = baseCode(norm);
        return completedDisciplines.some((c) => {
          const cNorm = normalizeCode(c);
          return cNorm === norm || baseCode(cNorm) === base;
        });
      });
    });
  };

  const canTake = (code: string): boolean => {
    const course = courses?.find(c => c.code === code);
    if (!course) return false;
    if (completedDisciplines.includes(code)) return false;
    return hasAllPrereqsDone(course);
  };

  // Sections são carregadas internamente pelo DisciplineDetail

  // Type group (exclusive): all | obrigatoria | optativa
  const [typeFilter, setTypeFilter] = useState<'all' | 'obrigatoria' | 'optativa' | 'geral'>('all');

  // Multi-select filters (AND). Exclude type-related ones from this list.
  const filters = [
    ...(isFull ? [{ id: 'available', label: 'Disponíveis' }] as const : []),
    ...(!isSimplified ? [{ id: 'completed', label: 'Cursadas' }] as const : []),
    { id: 'not_completed', label: 'Não Concluídas' },
    { id: 'offered', label: 'Ofertada' },
    { id: 'selected', label: 'Selecionada nesse semestre' },
  ];

  // Build rules map for useFilter (excluding 'favorites' which controls layout)
  const rules = useMemo(() => ({
    completed: (c: Course) => isCourseCompleted(c.code),
    not_completed: (c: Course) => !isCourseCompleted(c.code),
    available: (c: Course) => canTake(c.code),
    offered: (c: Course) => (c.sections_count ?? 0) > 0,
    selected: (c: Course) => isCourseSelected(c.code),
  }), [isCourseCompleted, isCourseSelected]);

  const { isActive, isOnly, isAll, activeIds, apply, toggle } = useFilter<Course>({ rules });

  // Order select state: 'name' (default) | 'sections'
  const [orderBy, setOrderBy] = useState<'name' | 'sections'>('name');
  // View mode state: 'all' | 'semester' | 'electives'
  const [viewMode, setViewMode] = useState<'all' | 'semester' | 'electives'>('all');
  // Selected semester for semester view
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  
  // Auto-select first semester when switching to semester view
  useEffect(() => {
    if (viewMode === 'semester' && !selectedSemester && levels.length > 0) {
      const optCheck = (l: string) => /optat/i.test(l);
      const orderedLevels = [
        ...levels.filter((l) => !optCheck(l)),
      ];
      if (orderedLevels.length > 0) {
        setSelectedSemester(orderedLevels[0]);
      }
    }
  }, [viewMode, selectedSemester, levels]);
  // Catálogo global da universidade
  const [globalLimit, setGlobalLimit] = useState(60);
  useEffect(() => {
    if (typeFilter === 'geral') {
      setGlobalLimit(60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, orderBy, activeIds, typeFilter]);
  
  

  return (
    <MainLayout>
      <div className="px-5 pt-4 sm:px-[clamp(20px,4vw,56px)] sm:pt-8 animate-fade-in">
        <div className="mb-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(30px,2.8vw,40px)]">Catálogo de disciplinas</h1>
          </div>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            {myPrograms.length > 0 ? (
              <div className="flex flex-wrap gap-2 items-center justify-between w-full">
                <div className="flex flex-wrap gap-2 items-center">
                  {myPrograms.map((p) => (
                    <span
                      key={p.id_ref}
                      className="rotulo inline-flex items-center"
                    >
                      {p.title}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:bg-primary/85"
                >
                  <Upload className="h-4 w-4" />
                  Importar histórico
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-muted-foreground">
                    Selecione um curso nas configurações para ver apenas as disciplinas do seu curso
                  </p>
                </div>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:bg-primary/85"
                >
                  <Upload className="h-4 w-4" />
                  Importar histórico
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-[18px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-foreground-2" />
          <input
            type="text"
            placeholder="Pesquise por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[52px] w-full rounded-full border-0 bg-nevoa pl-12 pr-5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mar transition-all"
          />
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 max-w-[100vw] overflow-x-auto">
            {/* Filtros button */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-4 text-[13px] font-bold hover:bg-nevoa'
              )}>
                <span>Filtros</span>
                <Badge variant={isAll ? 'outline' : 'secondary'}>
                  {activeIds.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-2 mt-2 p-1 max-w-[100vw]">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(f.id)}
                      className={cn(
                        "h-10 rounded-full px-4 text-[13px] font-bold transition-all",
                        isActive(f.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-nevoa text-foreground-2 hover:bg-trilho hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Ordem button */}
            <Select value={orderBy} onValueChange={(v: 'name' | 'sections') => setOrderBy(v)}>
              <SelectTrigger className="inline-flex h-11 w-auto items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-4 text-[13px] font-bold hover:bg-nevoa">
                <span>Ordem</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sections">Por Turmas</SelectItem>
                <SelectItem value="name">Por Nome</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Visualização button */}
            <Select value={viewMode} onValueChange={(v: 'all' | 'semester' | 'electives') => setViewMode(v)}>
              <SelectTrigger className="inline-flex h-11 w-auto items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-4 text-[13px] font-bold hover:bg-nevoa">
                <span>Visualização</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tudo</SelectItem>
                <SelectItem value="semester">Por Semestre</SelectItem>
                <SelectItem value="electives">Optativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Semester navigation for semester view */}
        {viewMode === 'semester' && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => {
                  const optCheck = (l: string) => /optat/i.test(l);
                  const orderedLevels = [
                    ...levels.filter((l) => !optCheck(l)),
                  ];
                  const currentIndex = orderedLevels.indexOf(selectedSemester);
                  if (currentIndex > 0) {
                    setSelectedSemester(orderedLevels[currentIndex - 1]);
                  }
                }}
                disabled={!selectedSemester || (() => {
                  const optCheck = (l: string) => /optat/i.test(l);
                  const orderedLevels = [
                    ...levels.filter((l) => !optCheck(l)),
                  ];
                  const currentIndex = orderedLevels.indexOf(selectedSemester);
                  return currentIndex <= 0;
                })()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-nevoa hover:bg-trilho disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger className="h-11 w-auto min-w-[12rem] rounded-full border-0 bg-nevoa px-4 text-sm font-bold hover:bg-trilho">
                  <SelectValue placeholder="Selecione um semestre" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const optCheck = (l: string) => /optat/i.test(l);
                    const orderedLevels = [
                      ...levels.filter((l) => !optCheck(l)),
                    ];
                    return orderedLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
              
              <button
                onClick={() => {
                  const optCheck = (l: string) => /optat/i.test(l);
                  const orderedLevels = [
                    ...levels.filter((l) => !optCheck(l)),
                  ];
                  const currentIndex = orderedLevels.indexOf(selectedSemester);
                  if (currentIndex < orderedLevels.length - 1) {
                    setSelectedSemester(orderedLevels[currentIndex + 1]);
                  }
                }}
                disabled={!selectedSemester || (() => {
                  const optCheck = (l: string) => /optat/i.test(l);
                  const orderedLevels = [
                    ...levels.filter((l) => !optCheck(l)),
                  ];
                  const currentIndex = orderedLevels.indexOf(selectedSemester);
                  return currentIndex >= orderedLevels.length - 1;
                })()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-nevoa hover:bg-trilho disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!isSimplified && (
          <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2.5 text-xs font-bold">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-[5px] border-[1.5px] border-mar bg-mar-claro" />
              <span className="text-foreground-2">Cursada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-[5px] border-[1.5px] border-dende bg-dende-claro" />
              <span className="text-foreground-2">Disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-[5px] border-[1.5px] border-dashed border-tracejado bg-nevoa" />
              <span className="text-foreground-2">Bloqueada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-[5px] border-2 border-foreground bg-background" />
              <span className="text-foreground-2">Selecionada nesse semestre</span>
            </div>
          </div>
        )}

        {(isPrereqsLoading || showLoadComplete) && (
          <div className="fixed right-4 top-20 z-50 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg">
            {isPrereqsLoading ? (
              <>
                <div className="h-4 w-4 animate-gira rounded-full border-2 border-primary-foreground border-t-transparent" />
                <span className="text-[13px] font-bold">Carregando pré-requisitos...</span>
              </>
            ) : (
              <>
                <div className="h-4 w-4 rounded-full bg-mar" />
                <span className="text-[13px] font-bold">Carregamento completo</span>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : typeFilter === 'geral' ? (
          <div className="space-y-6">
            <motion.div
              key="catalogo-geral"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="border-t-2 border-foreground pt-3"
            >
              <h3 className="mb-4 text-[24px] font-black tracking-[-0.04em] text-foreground sm:text-[28px]">
                Catálogo Global
              </h3>
              {(() => {
                const searched = fuzzyFilter<CourseApi>(allCourses, search, ['name', 'code']);
                let filtered = apply(searched);
                // Ordenação
                filtered = [...filtered].sort((a, b) => {
                  if (orderBy === 'sections') {
                    const diff = (b.sections_count ?? 0) - (a.sections_count ?? 0);
                    if (diff !== 0) return diff;
                    return a.name.localeCompare(b.name);
                  }
                  return a.name.localeCompare(b.name);
                });
                const total = filtered.length;
                const items = filtered.slice(0, globalLimit);
                return (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                    <AnimatePresence mode="popLayout">
                      {items.map((course) => (
                        <motion.div
                          key={course.code}
                          layout
                          layoutId={`course-${course.code}`}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                          <DisciplineCard
                            discipline={course}
                            available={true}
                            blocked={false}
                            isSelected={isCourseSelected(course.code)}
                            isCompleted={isCourseCompleted(course.code)}
                            isFailed={getDisciplineStatus(course.code) === 'failed'}
                            isDropped={getDisciplineStatus(course.code) === 'dropped'}
                            onToggleCompleted={handleToggleCompletedSingle}
                            onClick={() => openDiscipline(course)}
                            onRestrictedAction={handleRestrictedAction}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {globalLimit < total && (
                      <div className="col-span-full mt-2 flex justify-center">
                        <Button
                          variant="secondary"
                          className="rounded-xl"
                          onClick={() => setGlobalLimit((v) => Math.min(v + 60, total))}
                        >
                          Mostrar mais ({Math.max(0, total - globalLimit)})
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </div>
        ) : courses.length > 0 ? (
          <div className="space-y-10">
            <AnimatePresence initial={false}>
            {(() => {
              const optCheck = (l: string) => /optat/i.test(l);
              const orderedLevels = [
                ...levels.filter((l) => !optCheck(l)),
                ...levels.filter((l) => optCheck(l)),
              ];
              
              // Filter levels based on view mode
              let levelsToShow = orderedLevels;
              if (viewMode === 'semester' && selectedSemester) {
                levelsToShow = orderedLevels.filter(level => level === selectedSemester);
              } else if (viewMode === 'electives') {
                levelsToShow = orderedLevels.filter(optCheck);
              }
              
              return levelsToShow;
            })().map((level) => {
              const semesterCourses = coursesByLevel[level] || [];
              const searched = fuzzyFilter<CourseApi>(semesterCourses, search, ['name', 'code']);
              // Apply AND filters (favorites, completed, available, etc.)
              let filteredSemesterCourses = apply(searched);
              // Apply type group (exclusive)
              if (typeFilter !== 'all') {
                const matchKey = typeFilter === 'obrigatoria' ? 'obrig' : 'optat';
                filteredSemesterCourses = filteredSemesterCourses.filter((c) =>
                  (c.type || '').toString().toLowerCase().includes(matchKey),
                );
              }
              // Apply ordering
              filteredSemesterCourses = [...filteredSemesterCourses].sort((a, b) => {
                if (orderBy === 'sections') {
                  const diff = (b.sections_count ?? 0) - (a.sections_count ?? 0);
                  if (diff !== 0) return diff;
                  return a.name.localeCompare(b.name);
                }
                return a.name.localeCompare(b.name);
              });

              if (filteredSemesterCourses.length === 0) return null;

              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="border-t-2 border-foreground pt-3 sm:grid sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6"
                >
                  <h3 className="mb-4 text-[24px] font-black leading-tight tracking-[-0.04em] text-foreground sm:text-[28px]">
                    {getSemesterTitle(level)}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                    <AnimatePresence mode="popLayout">
                    {filteredSemesterCourses.map((course) => {
                      const completed = completedDisciplines.includes(course.code);
                      const available = !completed && hasAllPrereqsDone(course);
                      const blocked = !completed && !available;
                      const availableProp = available;
                      const blockedProp = blocked;

                      return (
                        <motion.div
                          key={course.code}
                          layout
                          layoutId={`course-${course.code}`}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                          <DisciplineCard
                            discipline={course}
                            available={availableProp}
                            blocked={blockedProp}
                            isSelected={isCourseSelected(course.code)}
                            isCompleted={isCourseCompleted(course.code)}
                            isFailed={getDisciplineStatus(course.code) === 'failed'}
                            isDropped={getDisciplineStatus(course.code) === 'dropped'}
                            onToggleCompleted={handleToggleCompletedSingle}
                            onClick={() => openDiscipline(course)}
                            onRestrictedAction={handleRestrictedAction}
                          />
                        </motion.div>
                      );
                    })}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhuma disciplina encontrada
            </p>
          </div>
        )}

        {selectedDiscipline && (
          <AnimatePresence>
            <DisciplineDetail
              discipline={selectedDiscipline}
              onClose={() => setSelectedDiscipline(null)}
              onRestrictedAction={handleRestrictedAction}
            />
          </AnimatePresence>
        )}

        {/* Modal de Importar Histórico */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className="max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-t-[28px] bg-background p-6 pb-8 shadow-xl sm:rounded-[28px] sm:pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="hidden">
                      <Upload className="w-5 h-5 text-mar" />
                    </div>
                    <div>
                      <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Importar histórico</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">
                        Envie o PDF ou cole o texto do histórico para marcar disciplinas cursadas.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowImportModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="flex h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-tracejado bg-nevoa px-4 transition-colors hover:bg-trilho">
                    <Upload className="h-5 w-5 text-foreground" />
                    <span className="text-sm font-bold text-foreground">Selecionar PDF</span>
                    <input type="file" accept=".pdf,text/plain" className="hidden" onChange={handleFileChange} />
                  </label>

                  <div className="rounded-[18px] bg-mar-claro p-4 text-xs font-medium leading-relaxed text-mar-ink">
                    <p className="mb-1 flex items-center gap-1.5 text-[13px] font-extrabold">
                      <Shield className="w-3 h-3" />
                      Privacidade
                    </p>
                    <p>Seu histórico não é armazenado em nenhum local. É utilizado apenas para extração de texto sobre as disciplinas e progresso, sendo automaticamente descartado após a extração.</p>
                  </div>

                  {isParsing && <p className="text-sm text-muted-foreground">Lendo PDF...</p>}
                  {importError && <p className="text-sm text-destructive">{importError}</p>}

                  {/* Métricas de Progresso do Curso - mostra quando há dados importados */}
                  {parsedWorkload && (
                    <div className="hidden">
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-3">
                          Dados de Carga Horária Extraídos
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {/* Obrigatórias */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-blue-700 dark:text-blue-300">Obrigatórias</span>
                              <span className="font-semibold text-blue-700 dark:text-blue-300">
                                {parsedWorkload.mandatory.required > 0 
                                  ? Math.min(100, Math.round((parsedWorkload.mandatory.completed / parsedWorkload.mandatory.required) * 100)) 
                                  : 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-950 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, parsedWorkload.mandatory.required > 0 ? (parsedWorkload.mandatory.completed / parsedWorkload.mandatory.required) * 100 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>{Math.min(parsedWorkload.mandatory.completed, parsedWorkload.mandatory.required)}h / {parsedWorkload.mandatory.required}h</span>
                              {parsedWorkload.mandatory.completed > parsedWorkload.mandatory.required && (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  +{parsedWorkload.mandatory.completed - parsedWorkload.mandatory.required}h excedentes
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Optativas */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-purple-700 dark:text-purple-300">Optativas</span>
                              <span className="font-semibold text-purple-700 dark:text-purple-300">
                                {parsedWorkload.elective.required > 0 
                                  ? Math.min(100, Math.round((parsedWorkload.elective.completed / parsedWorkload.elective.required) * 100)) 
                                  : 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-purple-100 dark:bg-purple-950 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, parsedWorkload.elective.required > 0 ? (parsedWorkload.elective.completed / parsedWorkload.elective.required) * 100 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>{Math.min(parsedWorkload.elective.completed, parsedWorkload.elective.required)}h / {parsedWorkload.elective.required}h</span>
                              {parsedWorkload.elective.completed > parsedWorkload.elective.required && (
                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                  +{parsedWorkload.elective.completed - parsedWorkload.elective.required}h excedentes
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Complementares */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-green-700 dark:text-green-300">Complementares</span>
                              <span className="font-semibold text-green-700 dark:text-green-300">
                                {parsedWorkload.complementary.required > 0 
                                  ? Math.min(100, Math.round((parsedWorkload.complementary.completed / parsedWorkload.complementary.required) * 100)) 
                                  : 0}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-green-100 dark:bg-green-950 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, parsedWorkload.complementary.required > 0 ? (parsedWorkload.complementary.completed / parsedWorkload.complementary.required) * 100 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>{Math.min(parsedWorkload.complementary.completed, parsedWorkload.complementary.required)}h / {parsedWorkload.complementary.required}h</span>
                              {parsedWorkload.complementary.completed > parsedWorkload.complementary.required && (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  +{parsedWorkload.complementary.completed - parsedWorkload.complementary.required}h excedentes
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Total */}
                          <div className="border-t pt-3 mt-1 space-y-1">
                            {(() => {
                              const cappedTotal = Math.min(parsedWorkload.mandatory.completed, parsedWorkload.mandatory.required) +
                                Math.min(parsedWorkload.elective.completed, parsedWorkload.elective.required) +
                                Math.min(parsedWorkload.complementary.completed, parsedWorkload.complementary.required);
                              const totalReq = parsedWorkload.mandatory.required + parsedWorkload.elective.required + parsedWorkload.complementary.required;
                              const totalPct = totalReq > 0 ? Math.min(100, Math.round((cappedTotal / totalReq) * 100)) : 0;
                              return (
                                <>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="font-semibold text-foreground">Progresso Geral</span>
                                    <span className="font-bold text-foreground">{totalPct}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                                      style={{ width: `${totalPct}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{cappedTotal}h / {totalReq}h exigidas</span>
                                    <span>{totalPct}% concluído</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="rotulo">
                      Disciplinas aprovadas detectadas: {parsedCodes.length}
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-1.5 overflow-auto rounded-[18px] border-[1.5px] border-foreground/10 p-3">
                      {parsedCodes.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhuma encontrada ainda.</span>
                      ) : (
                        parsedCodes.map(code => (
                          <span key={code} className="rounded-full bg-mar-claro px-2.5 py-1 font-mono text-xs font-bold text-mar-ink">
                            {code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setParsedCodes([]);
                      setParsedSemesters(new Map());
                      setParsedWorkload(null);
                      setDisciplinesBySemester(new Map());
                      setImportText('');
                      setImportError('');
                      localStorage.removeItem('progressData');
                    }}
                    className="h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleApplyImport}
                    className="h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/85"
                    disabled={isParsing}
                  >
                    Aplicar e marcar cursadas
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Boas-Vindas da tela Disciplinas */}
        <AnimatePresence>
          {showDisciplinesModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
              onClick={() => setShowDisciplinesModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md rounded-t-[28px] bg-background p-6 pb-8 shadow-xl sm:rounded-[28px] sm:pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="hidden">
                      <BookOpen className="w-5 h-5 text-mar" />
                    </div>
                    <div>
                      <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Disciplinas</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">Gerencie sua grade curricular</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDisciplinesModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-sm text-foreground leading-relaxed">
                    Aqui você pode indicar quais disciplinas já realizou, ver detalhes sobre as disciplinas da grade, 
                    e ter uma visualização otimizada com base no semestre, optativas e obrigatórias.
                  </p>
                  {isFull && (
                    <p className="text-sm text-muted-foreground">
                      Na experiência completa, isso otimiza na hora de fazer o planejamento da grade, 
                      mostrando apenas as disciplinas disponíveis e compatíveis com seu progresso.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  {isSimplified && (
                    <button
                      onClick={() => {
                        setMode('full');
                        setShowDisciplinesModal(false);
                        localStorage.setItem('firstVisitDisciplinas', 'true');
                      }}
                      className="h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                    >
                      Mudar para modo completo
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDisciplinesModal(false);
                      localStorage.setItem('firstVisitDisciplinas', 'true');
                    }}
                    className="h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/85"
                  >
                    Continuar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Modal de Upgrade para Modo Completo */}
        <AnimatePresence>
          {showUpgradeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
              onClick={() => setShowUpgradeModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md rounded-t-[28px] bg-background p-6 pb-8 shadow-xl sm:rounded-[28px] sm:pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="hidden">
                      <BookOpen className="w-5 h-5 text-mar" />
                    </div>
                    <div>
                      <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Modo Completo</p>
                      <p className="mt-1 text-sm font-medium text-muted-foreground">Desbloqueie recursos avançados</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUpgradeModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <p className="text-sm text-foreground leading-relaxed">
                    {pendingAction?.type === 'favorite' 
                      ? 'Para favoritar disciplinas, você precisa usar o modo completo.'
                      : 'Para marcar disciplinas como cursadas, você precisa usar o modo completo.'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Deseja mudar para o modo completo para acessar esta funcionalidade?
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setPendingAction(null);
                    }}
                    className="h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmUpgrade}
                    className="h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/85"
                  >
                    Mudar para Completo
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Modal de disciplina bloqueada por pré-requisitos */}
          <AnimatePresence>
            {showBlockedModal && pendingAction?.course && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-overlay/55 flex items-end sm:items-center justify-center z-50 sm:p-4"
                onClick={() => setShowBlockedModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 20 }}
                  className="w-full max-w-md rounded-t-[28px] bg-background shadow-xl sm:rounded-[28px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-6 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="hidden">
                        <AlertCircle className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Disciplina Bloqueada</p>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">Pré-requisitos não cursados</p>
                      </div>
                    </div>
                    <button onClick={() => setShowBlockedModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                      <X className="h-[18px] w-[18px]" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{pendingAction.course.code} - {pendingAction.course.name}</span> possui pré-requisitos que ainda não foram cursados:
                    </p>
                    
                    <div className="space-y-2">
                      {getPrerequisitesList(pendingAction.course).map(prereqCode => {
                        const prereqCourse = allCourses.find(c => c.code === prereqCode);
                        const prereqName = prereqCourse?.name || '';
                        return (
                          <div key={prereqCode} className="flex items-center gap-2 text-sm">
                            <div className={cn(
                              "h-2.5 w-2.5 shrink-0 rounded-full",
                              completedDisciplines.includes(prereqCode) 
                                ? "bg-mar" 
                                : "border-[1.5px] border-dashed border-tracejado"
                            )} />
                            <span className={cn(
                              completedDisciplines.includes(prereqCode)
                                ? "font-semibold text-mar-ink line-through"
                                : "font-semibold text-foreground"
                            )}>
                              {prereqCode}{prereqName ? ` - ${prereqName}` : ''}
                            </span>
                            {completedDisciplines.includes(prereqCode) && (
                              <span className="text-xs font-bold text-mar">✓ Cursado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Como você deseja prosseguir?
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 p-6 pt-2">
                    <button
                      onClick={() => {
                        setShowBlockedModal(false);
                        setPendingAction(null);
                      }}
                      className="h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={markOnlyCurrentAsCompleted}
                      className="px-4 py-2 rounded-lg bg-warning/10 text-warning text-sm font-semibold hover:bg-warning/20"
                    >
                      Marcar apenas esta
                    </button>
                    <button
                      onClick={markPrereqsAsCompleted}
                      className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:bg-success/90"
                    >
                      Marcar pré-requisitos + esta
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatePresence>
      </div>
    </MainLayout>
  );
};

export default Disciplinas;
