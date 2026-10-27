import { atomWithStorage } from 'jotai/utils';
import { useAtom } from 'jotai';
import { produce } from 'immer';
import type { Section } from '@/services/api';
import { useMemo } from 'react';
import { getSpplitedCode } from '@/lib/schedule';
import { findCorrespondingBlockSections } from '@/lib/blockCourses';

// Persisted sections selected by the user (sempre as da grade favorita: é o que o Início e o Progresso mostram)
const mySectionsAtom = atomWithStorage<Section[]>('mySections', []);

// ---------- Várias grades ----------
export type GradeSalva = { id: string; nome: string; secoes: Section[] };
export type EstadoGrades = { lista: GradeSalva[]; ativa: string; favorita: string };

const gradesAtom = atomWithStorage<EstadoGrades | null>('cadee:grades', null);

const GRADE_INICIAL: EstadoGrades = { lista: [{ id: 'g1', nome: 'Grade 1', secoes: [] }], ativa: 'g1', favorita: 'g1' };

function normalizarGrades(e: EstadoGrades | null | undefined): EstadoGrades {
  if (!e || !Array.isArray(e.lista) || e.lista.length === 0) return GRADE_INICIAL;
  const ids = e.lista.map((g) => g.id);
  const favorita = ids.includes(e.favorita) ? e.favorita : ids[0];
  const ativa = ids.includes(e.ativa) ? e.ativa : favorita;
  return { lista: e.lista, ativa, favorita };
}

type Atualizacao = Section[] | ((atual: Section[]) => Section[]);

/**
 * Grades salvas no Planejador. A favorita guarda as turmas em `mySections` (o que o resto do sistema lê);
 * as outras ficam em `cadee:grades`.
 */
export function useGrades() {
  const [favoritaSecoes, setFavoritaSecoes] = useAtom(mySectionsAtom);
  const [bruto, setBruto] = useAtom(gradesAtom);
  const estado = normalizarGrades(bruto);

  const lista: GradeSalva[] = estado.lista.map((g) => (g.id === estado.favorita ? { ...g, secoes: favoritaSecoes } : g));
  const ativa = lista.find((g) => g.id === estado.ativa) ?? lista[0];

  const salvar = (fn: (e: EstadoGrades) => EstadoGrades) => setBruto((prev) => fn(normalizarGrades(prev)));
  const proximoNome = () => {
    let n = estado.lista.length + 1;
    const nomes = new Set(estado.lista.map((g) => g.nome));
    while (nomes.has(`Grade ${n}`)) n++;
    return `Grade ${n}`;
  };
  const novoId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const abrir = (id: string) => salvar((e) => ({ ...e, ativa: id }));

  const criar = (secoes: Section[] = [], nome?: string) => {
    const id = novoId();
    salvar((e) => ({ ...e, lista: [...e.lista, { id, nome: nome ?? proximoNome(), secoes }], ativa: id }));
    return id;
  };

  const duplicar = () => criar([...ativa.secoes], `${ativa.nome} (cópia)`);

  const renomear = (id: string, nome: string) => {
    const limpo = nome.trim().slice(0, 40);
    if (!limpo) return;
    salvar((e) => ({ ...e, lista: e.lista.map((g) => (g.id === id ? { ...g, nome: limpo } : g)) }));
  };

  const favoritar = (id: string) => {
    if (id === estado.favorita) return;
    const nova = estado.lista.find((g) => g.id === id);
    if (!nova) return;
    const atuais = favoritaSecoes;
    salvar((e) => ({
      ...e,
      favorita: id,
      lista: e.lista.map((g) => (g.id === e.favorita ? { ...g, secoes: atuais } : g)),
    }));
    setFavoritaSecoes(nova.secoes);
  };

  const excluir = (id: string) => {
    if (estado.lista.length <= 1) return;
    const restantes = estado.lista.filter((g) => g.id !== id);
    if (id === estado.favorita) {
      const nova = restantes[0];
      setFavoritaSecoes(nova.secoes);
      setBruto({ lista: restantes, favorita: nova.id, ativa: estado.ativa === id ? nova.id : estado.ativa });
    } else {
      setBruto({ lista: restantes, favorita: estado.favorita, ativa: estado.ativa === id ? estado.favorita : estado.ativa });
    }
  };

  return { lista, ativa, ativaId: estado.ativa, favoritaId: estado.favorita, abrir, criar, duplicar, renomear, favoritar, excluir } as const;
}

/**
 * Turmas de uma grade.
 * `alvo: 'favorita'` (padrão) é a grade que vale para o resto do sistema; o Planejador usa `'ativa'`,
 * a grade aberta nas abas (que pode ser a favorita ou não).
 */
export function useMySections(alvo: 'favorita' | 'ativa' = 'favorita') {
  const [favoritaSecoes, setFavoritaSecoes] = useAtom(mySectionsAtom);
  const [bruto, setBruto] = useAtom(gradesAtom);
  const estado = normalizarGrades(bruto);
  const usaFavorita = alvo === 'favorita' || estado.ativa === estado.favorita;
  const secoesDaAtiva = estado.lista.find((g) => g.id === estado.ativa)?.secoes;
  const mySections = useMemo(
    () => (usaFavorita ? favoritaSecoes : secoesDaAtiva ?? []),
    [usaFavorita, favoritaSecoes, secoesDaAtiva],
  );

  const setMySections = (atualizacao: Atualizacao) => {
    if (usaFavorita) {
      setFavoritaSecoes(atualizacao as Section[] | ((a: Section[]) => Section[]));
      return;
    }
    setBruto((prev) => {
      const e = normalizarGrades(prev);
      return {
        ...e,
        lista: e.lista.map((g) =>
          g.id === e.ativa ? { ...g, secoes: typeof atualizacao === 'function' ? atualizacao(g.secoes) : atualizacao } : g,
        ),
      };
    });
  };

  const toggleSection = (aSection: Section, allSections: Section[] = []) => {
    setMySections((current) => {
      const next = produce(current, (draft) => {
        // First, find all corresponding block sections
        const correspondingSections = findCorrespondingBlockSections(aSection, allSections);
        
        // Function to toggle a single section
        const toggleSingleSection = (section: Section) => {
          const courseCode = section.course?.code || (section as any)?.course_code;
          const existingSectionIndex = draft.findIndex((s) => {
            const sCourseCode = s.course?.code || (s as any)?.course_code;
            return sCourseCode === courseCode;
          });
          
          if (existingSectionIndex >= 0) {
            const existingSection = draft[existingSectionIndex];
            
            // Se é a mesma turma, remove ela
            if (existingSection.id_ref === section.id_ref) {
              draft.splice(existingSectionIndex, 1);
            } else {
              // Se é outra turma da mesma disciplina, substitui
              draft[existingSectionIndex] = section;
            }
          } else {
            // Se não existe nenhuma turma desta disciplina, adiciona
            draft.push(section);
          }
        };

        // Toggle the main section first
        toggleSingleSection(aSection);

        // Then toggle all corresponding sections
        correspondingSections.forEach(correspondingSection => {
          toggleSingleSection(correspondingSection);
        });
      });
      return next;
    });
  };

  const clearSections = () => setMySections([]);

  // Record keyed by each time code (if any)
  const byTimeCode = useMemo(() =>
    mySections
      .flatMap((s) => (s.time_codes || []).map((code) => [code, s] as const))
      .reduce((acc, [code, s]) => {
        acc[code] = s;
        return acc;
      }, {} as Record<string, Section>)
  , [mySections]);

  const timeCodeKeys = useMemo(() => Object.keys(byTimeCode), [byTimeCode]);

  // Record keyed by id_ref
  const byIdRef = useMemo(() =>
    mySections.reduce((acc, s) => {
      acc[s.id_ref] = s;
      return acc;
    }, {} as Record<string, Section>)
  , [mySections]);

  // Record keyed by course.code (last one wins if multiple)
  const byCourseCode = useMemo(() =>
    mySections.reduce((acc, s) => {
      const code = s.course.code;
      acc[code] = s;
      return acc;
    }, {} as Record<string, Section>)
  , [mySections]);

  // Record keyed by cartesian split codes from time_codes
  const byCartesianCode = useMemo(() =>
    Object.entries(byTimeCode)
      .flatMap(([time, s]) => getSpplitedCode(time).map((k) => [k, s] as const))
      .reduce((acc, [k, s]) => {
        acc[k] = s;
        return acc;
      }, {} as Record<string, Section>)
  , [byTimeCode]);

  const hasSectionOnCourse = (code: string): boolean => {
    if (!code) return false;
    return !!byCourseCode[code];
  };

  // Nova função para verificar se uma turma específica está selecionada
  const hasSection = (sectionId: string): boolean => {
    return !!byIdRef[sectionId];
  };

  // Função para obter a turma atual de uma disciplina
  const getSectionForCourse = (courseCode: string): Section | null => {
    return byCourseCode[courseCode] || null;
  };

  const hasSectionOnCode = (code: string): Array<{ code: string; section: Section }> => {
    if (!code) return [];
    const keys = getSpplitedCode(code);
    return keys
      .map((k) => (byCartesianCode[k] ? { code: k, section: byCartesianCode[k] } : null))
      .filter((x): x is { code: string; section: Section } => !!x);
  };

  const getConflictsForSection = (aSection: Section): Array<{ code: string; section: Section }> => {
    if (!aSection.time_codes) return [];
    
    const conflicts: Array<{ code: string; section: Section }> = [];
    const seen = new Set<string>();
    
    // Para cada time_code da seção
    for (const timeCode of aSection.time_codes) {
      // Quebra o time_code em códigos individuais (dias e horários)
      const codes = getSpplitedCode(timeCode);
      
      // Para cada código individual
      for (const code of codes) {
        // Encontra todas as seções que compartilham este código
        const sectionsWithSameCode = hasSectionOnCode(code);
        
        // Adiciona à lista de conflitos, se não for a própria seção e não for duplicada
        for (const { section, code: conflictCode } of sectionsWithSameCode) {
          if (section.id_ref !== aSection.id_ref && !seen.has(section.id_ref)) {
            conflicts.push({ code: conflictCode, section });
            seen.add(section.id_ref);
          }
        }
      }
    }
    
    return conflicts;
  };

  return {
    mySections,
    toggleSection,
    clearSections,
    byTimeCode,
    timeCodeKeys,
    byIdRef,
    byCourseCode,
    byCartesianCode,
    hasSectionOnCourse,
    hasSection,
    getSectionForCourse,
    hasSectionOnCode,
    getConflictsForSection,
  } as const;
}
