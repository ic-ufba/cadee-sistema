import { ProgressCard } from './ProgressCard';
import { AdvancedSemesterGrid } from './AdvancedSemesterGrid';
import { useApp } from '@/contexts/AppContext';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useMyCourses } from '@/hooks/useMyCourses';
import { useMySections } from '@/hooks/useMySections';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { useMode } from '@/hooks/useMode';
import { fetchProgramDetail, type ProgramDetail } from '@/services/api';
import { parseCompleteHistory, type WorkloadData, type SemesterDisciplineData } from '@/utils/historyParser';
import { getCourseWorkload, getWorkloadCategory, mergeSemesterOutcomes, sumWorkloadByCategory } from '@/lib/semester';
import { getBlockCourseBaseCode } from '@/lib/blockCourses';
import { InfoPopup } from '@/components/ui/info-popup';
import { Upload, X, Shield, GraduationCap, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImportarHistoricoModal } from './ImportarHistoricoModal';
import { useOverallProgress } from '@/hooks/useOverallProgress';
import { useSigaaAuth } from '@/hooks/useSigaa';
import { porcento } from '@/lib/curso-texto';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { Mare, PercentAnimado } from '@/components/brand/Mare';
import { useState, useEffect, useMemo } from 'react';

interface ProgressViewProps {
  /** Abre a importação de histórico assim que a tela monta (vem do menu da conta). */
  abrirImportacao?: boolean;
  onImportacaoAberta?: () => void;
}

export function ProgressView({ abrirImportacao = false, onImportacaoAberta }: ProgressViewProps = {}) {
  const { completedDisciplines, toggleCompletedDiscipline, semesterOutcomes, getDisciplineStatus, customCourseWorkload } = useApp();
  const { myPrograms } = useMyPrograms();
  const { courses, isLoading: coursesLoading } = useMyCourses();
  const { mySections } = useMySections();
  const { currentTerm } = useCurrentTerm();
  const { setMode } = useMode();
  const overall = useOverallProgress();
  const { session: sigaaSession } = useSigaaAuth();
  
  // Estados para importação de histórico
  const [showImportModal, setShowImportModal] = useState(false);
  useEffect(() => {
    if (abrirImportacao) {
      setShowImportModal(true);
      onImportacaoAberta?.();
    }
  }, [abrirImportacao, onImportacaoAberta]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedCodes, setParsedCodes] = useState<string[]>([]);
  const [parsedSemesters, setParsedSemesters] = useState<Map<string, { approved: number, failed: number, dropped: number, notDone: number }>>(new Map());
  const [parsedWorkload, setParsedWorkload] = useState<WorkloadData | null>(null);
  const [disciplinesBySemester, setDisciplinesBySemester] = useState<Map<string, SemesterDisciplineData>>(new Map());
  const [importError, setImportError] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [courseLevelsLoaded, setCourseLevelsLoaded] = useState(false);
  
  // Estado para dados do programa
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [courseLevels, setCourseLevels] = useState<string[]>([]); // Níveis/semestres do curso

  // Função para extrair níveis únicos das disciplinas
  const extractCourseLevels = (coursesList: any[]) => {
    if (!coursesList || !Array.isArray(coursesList)) return [];
    
    const levels = new Set<string>();
    coursesList.forEach(course => {
      if (course.level && course.type !== 'OPT' && course.type !== 'OPTATIVO') {
        levels.add(course.level);
      }
    });
    
    return Array.from(levels).sort((a, b) => {
      // Ordena numericamente: "1º Período", "2º Período", etc.
      const aNum = parseInt(a.match(/(\d+)/)?.[1] || '0');
      const bNum = parseInt(b.match(/(\d+)/)?.[1] || '0');
      return aNum - bNum;
    });
  };

  // Carregar níveis do curso quando as disciplinas carregarem
  useEffect(() => {
    if (courses && courses.length > 0 && !coursesLoading && !courseLevelsLoaded) {
      const levels = extractCourseLevels(courses);
      setCourseLevels(levels);
      setCourseLevelsLoaded(true);
    }
  }, [courses, coursesLoading, courseLevelsLoaded]);

  // Carregar dados salvos do localStorage ao iniciar (e de novo quando o histórico é sincronizado pelo SIGAA)
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
        console.error('Erro ao carregar dados do localStorage:', error);
      }
    };
    load();
    window.addEventListener('progressDataUpdated', load);
    return () => window.removeEventListener('progressDataUpdated', load);
  }, []);

  // Função para salvar dados no localStorage
  const saveToLocalStorage = () => {
    const dataToSave = {
      codes: parsedCodes,
      semesters: Array.from(parsedSemesters.entries()),
      workload: parsedWorkload,
      disciplinesBySemester: Array.from(disciplinesBySemester.entries())
    };
    localStorage.setItem('progressData', JSON.stringify(dataToSave));
    // Disparar evento customizado para notificar mudanças na mesma aba
    window.dispatchEvent(new Event('progressDataUpdated'));
  };

  // Função para limpar todos os dados salvos
  const clearSavedData = () => {
    localStorage.removeItem('progressData');
    setParsedCodes([]);
    setParsedSemesters(new Map());
    setParsedWorkload(null);
    setDisciplinesBySemester(new Map());
    setImportText('');
    setImportError('');
    // Disparar evento customizado para notificar mudanças na mesma aba
    window.dispatchEvent(new Event('progressDataUpdated'));
  };

  const pedirLimpeza = () => {
    if (confirm('Tem certeza que deseja limpar todos os dados importados?')) {
      clearSavedData();
    }
  };

  // "Limpar dados" fica no cabeçalho da tela (Index) e chega aqui por evento
  useEffect(() => {
    const onLimpar = () => pedirLimpeza();
    window.addEventListener('cadee:limpar-progresso', onLimpar);
    return () => window.removeEventListener('cadee:limpar-progresso', onLimpar);
  });

  const handleParseImport = (text: string) => {
    setImportError('');
    const result = parseCompleteHistory(text);
    
    setParsedCodes(result.codes);
    setParsedSemesters(result.semesters);
    setParsedWorkload(result.workload);
    setDisciplinesBySemester(result.disciplinesBySemester);
    setImportText(text);
    
    // Salvar após atualizar o estado
    setTimeout(() => saveToLocalStorage(), 0);
    
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
  
  const handleApplyImport = () => {
    if (parsedCodes.length === 0 && !parsedWorkload) {
      setImportError('Nenhum código aprovado ou dados de carga horária encontrados para aplicar.');
      return;
    }
    
    // Aplicar códigos ao contexto global
    parsedCodes.forEach(code => {
      if (!completedDisciplines.includes(code)) {
        toggleCompletedDiscipline(code);
      }
    });
    
    // Manter os dados de carga horária extraídos para uso nas métricas
    // parsedWorkload já está no estado, não precisa limpar aqui
    
    // Mudar automaticamente para modo completo quando histórico é importado
    setMode('full');
    
    // Salvar dados no localStorage
    saveToLocalStorage();
    
    setShowImportModal(false);
    // Não limpar os dados parseados para que possam ser usados nas métricas
    setImportText('');
    setImportError('');
  };
  
  // Carregar dados do programa quando houver programas selecionados
  useEffect(() => {
    const loadProgramDetail = async () => {
      if (myPrograms.length > 0) {
        setLoadingProgram(true);
        try {
          const program = myPrograms[0]; // Usar o primeiro programa selecionado
          if (program.detail_url) {
            const detail = await fetchProgramDetail(program.detail_url);
            setProgramDetail(detail);
          }
        } catch (error) {
          console.error('Erro ao carregar detalhes do programa:', error);
        } finally {
          setLoadingProgram(false);
        }
      }
    };

    loadProgramDetail();
  }, [myPrograms]);

  // Determinar se há dados importados (considera workload ou códigos/semestres carregados do histórico)
  const hasImportedData = !!parsedWorkload || parsedCodes.length > 0 || parsedSemesters.size > 0;

  // Mostrar modal de boas-vindas apenas na primeira vez que acessa a tela
  useEffect(() => {
    const hasVisitedProgress = localStorage.getItem('firstVisitProgresso');
    if (!hasVisitedProgress) {
      setShowWelcomeModal(true);
    }
  }, []);

  const curriculumRequirements = useMemo(
    () => sumWorkloadByCategory(courses),
    [courses]
  );

  // Calcular horas adicionais de disciplinas marcadas manualmente (fora do histórico importado)
  const manualWorkloadBonus = useMemo(() => {
    const importedCodes = new Set(parsedCodes);
    const bonus = { mandatory: 0, elective: 0, complementary: 0 };

    const allApproved = new Set([
      ...completedDisciplines,
      ...Object.values(semesterOutcomes).flatMap((o) => o.approved),
    ]);

    for (const code of allApproved) {
      if (importedCodes.has(code)) continue;
      const course = courses.find((c) => c.code === code);
      if (!course) continue;
      const hours = getCourseWorkload(course);
      const category = getWorkloadCategory(course.type);
      bonus[category] += hours;
    }

    return bonus;
  }, [completedDisciplines, semesterOutcomes, parsedCodes, courses]);

  const plannedDisciplinesList = useMemo(() => {
    const map = new Map<string, { code: string; name?: string; baseCode: string }>();
    mySections.forEach((s) => {
      const code = s.course?.code || (s as any).course_code || '';
      if (!code) return;
      const baseCode = getBlockCourseBaseCode(code);
      if (!map.has(baseCode)) {
        map.set(baseCode, {
          code: baseCode,
          name: s.course?.name || (s as any).course_name || (courses.find((c) => getBlockCourseBaseCode(c.code) === baseCode)?.name),
          baseCode,
        });
      }
    });
    return Array.from(map.values());
  }, [mySections, courses]);

  const enrolledCodes = useMemo(
    () => plannedDisciplinesList.map((d) => d.baseCode),
    [plannedDisciplinesList]
  );

  const usesCurriculumTotals = !parsedWorkload && !customCourseWorkload?.enabled;

  // Calcular métricas baseadas no histórico importado + marcações manuais + grade curricular + ajuste manual
  const progressData = useMemo(() => {
    // Requisitos: se a carga horária manual estiver ativa, usa os valores manuais;
    // senão: histórico importado ou grade curricular
    let mandatoryTotal = parsedWorkload?.mandatory.required || curriculumRequirements.mandatory || 0;
    let electivesTotal = parsedWorkload?.elective.required || curriculumRequirements.elective || 0;
    let complementaryTotal = parsedWorkload?.complementary.required || curriculumRequirements.complementary || 0;

    if (customCourseWorkload?.enabled) {
      mandatoryTotal = customCourseWorkload.mandatory;
      electivesTotal = customCourseWorkload.elective;
      complementaryTotal = customCourseWorkload.complementary;
    }

    const mandatoryCompleted =
      (parsedWorkload?.mandatory.completed ?? 0) + manualWorkloadBonus.mandatory;
    const electivesCompleted =
      (parsedWorkload?.elective.completed ?? 0) + manualWorkloadBonus.elective;
    const complementaryCompleted =
      (parsedWorkload?.complementary.completed ?? 0) + manualWorkloadBonus.complementary;
    const rawTotalHours = mandatoryCompleted + electivesCompleted + complementaryCompleted;

    const cappedMandatory = Math.min(mandatoryCompleted, mandatoryTotal);
    const cappedElectives = Math.min(electivesCompleted, electivesTotal);
    const cappedComplementary = Math.min(complementaryCompleted, complementaryTotal);
    const effectiveTotalHours = cappedMandatory + cappedElectives + cappedComplementary;

    return {
      rawTotalHours,
      effectiveTotalHours,
      mandatory: { completed: mandatoryCompleted, total: mandatoryTotal },
      electives: { completed: electivesCompleted, total: electivesTotal },
      complementary: { completed: complementaryCompleted, total: complementaryTotal },
      totalSemesters: parsedSemesters.size || courseLevels.length || 8,
    };
  }, [
    parsedWorkload,
    parsedSemesters,
    manualWorkloadBonus,
    curriculumRequirements,
    courseLevels.length,
    customCourseWorkload,
  ]);

  const mergedSemesters = useMemo(() => {
    let result = mergeSemesterOutcomes(parsedSemesters, semesterOutcomes, currentTerm);

    if (currentTerm && !result.find((s) => s.term === currentTerm)) {
      const outcome = semesterOutcomes[currentTerm];
      const approved = outcome?.approved.length ?? 0;
      const failed = outcome?.failed.length ?? 0;
      const dropped = outcome?.dropped.length ?? 0;
      const notDone = Math.max(0, plannedDisciplinesList.length - approved - failed - dropped);

      if (plannedDisciplinesList.length > 0 || approved + failed + dropped > 0) {
        result = [
          ...result,
          { term: currentTerm, approved, failed, dropped, notDone, isCurrent: true },
        ];
      }
    } else if (currentTerm) {
      result = result.map((s) => {
        if (s.term === currentTerm) {
          const outcome = semesterOutcomes[currentTerm];
          const approved = outcome?.approved.length ?? s.approved;
          const failed = outcome?.failed.length ?? s.failed;
          const dropped = outcome?.dropped.length ?? s.dropped;
          const notDone = Math.max(0, plannedDisciplinesList.length - approved - failed - dropped);
          return {
            ...s,
            approved,
            failed,
            dropped,
            notDone,
            isCurrent: true,
          };
        }
        return s;
      });
    }

    return result.sort((a, b) => a.term.localeCompare(b.term));
  }, [parsedSemesters, semesterOutcomes, currentTerm, plannedDisciplinesList]);

  const totalRequiredHours = progressData.mandatory.total + progressData.electives.total + progressData.complementary.total;
  const overallProgress = totalRequiredHours > 0 
    ? Math.min(100, (progressData.effectiveTotalHours / totalRequiredHours) * 100)
    : 0;

  // Quanto a grade planejada deste semestre somaria, se tudo for aprovado (parte listrada das barras)
  const planejadoExtra = {
    mandatory: Math.max(0, overall.projected.mandatory.completed - overall.mandatory.completed),
    elective: Math.max(0, overall.projected.electives.completed - overall.electives.completed),
  };

  const categorias = [
    {
      key: 'mandatory' as const,
      nome: 'Obrigatórias',
      cor: 'bg-mar',
      listra: 'bg-[repeating-linear-gradient(135deg,hsl(var(--mar))_0_2px,hsl(var(--mar-tint))_2px_5px)]',
      completed: progressData.mandatory.completed,
      total: progressData.mandatory.total,
      extra: planejadoExtra.mandatory,
    },
    {
      key: 'elective' as const,
      nome: 'Optativas',
      cor: 'bg-dende',
      listra: 'bg-[repeating-linear-gradient(135deg,hsl(var(--dende))_0_2px,hsl(var(--dende-tint))_2px_5px)]',
      completed: progressData.electives.completed,
      total: progressData.electives.total,
      extra: planejadoExtra.elective,
    },
    {
      key: 'complementary' as const,
      nome: 'Complementares',
      cor: 'bg-pedra',
      listra: '',
      completed: progressData.complementary.completed,
      total: progressData.complementary.total,
      extra: 0,
    },
  ].map((c) => {
    const pct = c.total > 0 ? Math.min(100, (c.completed / c.total) * 100) : 0;
    const pctComGrade = c.total > 0 ? Math.min(100, ((c.completed + c.extra) / c.total) * 100) : 0;
    return { ...c, pct, listraPct: Math.max(0, pctComGrade - pct) };
  });

  const faltam = Math.max(0, totalRequiredHours - progressData.effectiveTotalHours);
  const termoGrade = currentTerm || 'deste semestre';

  // Aproveitamento: totais de todos os semestres
  const aprovTotais = mergedSemesters.reduce(
    (acc, s) => ({ aprovadas: acc.aprovadas + s.approved, total: acc.total + s.approved + s.failed + s.dropped + s.notDone }),
    { aprovadas: 0, total: 0 }
  );
  const aprovPct = aprovTotais.total > 0 ? Math.round((aprovTotais.aprovadas / aprovTotais.total) * 100) : 0;

  const pilula = (status: 'approved' | 'failed' | 'dropped' | 'none') =>
    status === 'approved'
      ? 'bg-mar'
      : status === 'failed'
        ? 'bg-pitanga'
        : status === 'dropped'
          ? 'shadow-[inset_0_0_0_1.5px_hsl(var(--foreground))]'
          : 'shadow-[inset_0_0_0_1.5px_hsl(var(--tracejado))]';

  const Pilula = ({ status, dica }: { status: 'approved' | 'failed' | 'dropped' | 'none'; dica: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`h-2.5 w-[26px] shrink-0 cursor-default rounded-full ${pilula(status)}`} aria-label={dica} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{dica}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const fonteTexto = hasImportedData
    ? sigaaSession?.sincronizadoEm
      ? `Dados do histórico escolar importado do SIGAA · `
      : 'Dados do histórico escolar importado'
    : 'Progresso estimado pela grade do curso. Importe o histórico para dados precisos.';

  return (
    <div>
      {/* Aviso sobre necessidade de importar histórico */}
      {!hasImportedData && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-mar-claro p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="text-sm">
            <p className="mb-1 font-extrabold text-mar-ink">Importe seu histórico acadêmico</p>
            <p className="font-medium text-foreground-2">Os números abaixo são uma estimativa pela grade do curso. Com o histórico, o progresso fica exato.</p>
          </div>
          <button
            onClick={() => {
              setShowWelcomeModal(false);
              setShowImportModal(true);
            }}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar histórico
          </button>
        </div>
      )}

      {/* VISÃO GERAL */}
      <section aria-label="Visão geral" className="flex flex-col border-t-2 border-foreground lg:flex-row lg:flex-wrap">
        <div className="flex items-center gap-[18px] py-6 lg:flex-[1.2_1_380px] lg:gap-7 lg:pb-8 lg:pr-8 lg:pt-7">
          <Mare percent={Math.min(100, overallProgress)} size={96} className="lg:hidden" />
          <Mare percent={Math.min(100, overallProgress)} size={132} className="hidden lg:block" />
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5">
              <span className="rotulo !text-foreground">Progresso geral</span>
              <InfoPopup
                iconClassName="w-3.5 h-3.5"
                content="Progresso total baseado nas horas cursadas em relação às horas exigidas do curso (limitado ao teto de cada categoria)."
              />
            </span>
            <span className="numero text-[44px] leading-[0.9] text-foreground lg:text-[52px]">
              <PercentAnimado value={overallProgress} />
            </span>
            <span className="font-mono text-xs text-foreground-2">
              {progressData.effectiveTotalHours} / {totalRequiredHours} h
              <span className="hidden lg:inline"> · faltam {faltam} h</span>
            </span>
          </div>
        </div>

        {categorias.map((c) => (
          <div
            key={c.key}
            className="flex flex-col gap-2.5 border-t border-foreground/10 py-4 lg:flex-[1_1_200px] lg:justify-center lg:gap-3 lg:border-l lg:border-t-0 lg:px-7 lg:pb-8 lg:pt-7 lg:last:pr-0"
          >
            <div className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground lg:text-[11px] lg:uppercase lg:tracking-[0.12em]">
                <span className={`h-2 w-2 rounded-full ${c.cor}`} />
                {c.nome}
              </span>
              <span className="numero text-2xl leading-[0.9] text-foreground lg:text-4xl">{porcento(c.pct, c.pct % 1 === 0 ? 0 : 1)}</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-trilho">
              <span className={c.cor} style={{ width: `${c.pct}%` }} />
              {c.listraPct > 0 && <span className={c.listra} style={{ width: `${c.listraPct}%` }} />}
            </div>
            <span className="font-mono text-[11px] text-foreground-2">
              {Math.min(c.completed, c.total)} / {c.total} h
              {c.completed > c.total && <span className="text-mar-ink"> · +{c.completed - c.total} h excedentes</span>}
              {c.key === 'complementary' && c.completed === 0 && (
                <>
                  {' · '}
                  <Link to="/configuracoes" className="font-semibold text-mar hover:text-foreground">registrar</Link>
                </>
              )}
              {usesCurriculumTotals && <span className="text-dende-ink"> · estimado</span>}
            </span>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-foreground/10 pt-3 text-xs text-foreground-2">
        <span className="hidden items-center gap-2 lg:inline-flex">
          <span className="h-1.5 w-[18px] rounded-full bg-mar" />
          Concluído
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-[18px] rounded-full bg-[repeating-linear-gradient(135deg,hsl(var(--mar))_0_2px,hsl(var(--mar-tint))_2px_5px)]" />
          <span className="lg:hidden">Listrado: na grade de {termoGrade}</span>
          <span className="hidden lg:inline">Na grade de {termoGrade}, se aprovado</span>
        </span>
      </div>

      {/* DETALHE: por semestre + aproveitamento */}
      <div className="mt-10 flex flex-col border-t-2 border-foreground lg:flex-row lg:flex-wrap">
        <div className="min-w-0 pb-8 pt-6 lg:flex-[1_1_400px] lg:pr-8">
          <AdvancedSemesterGrid
            courses={courses}
            completedDisciplines={completedDisciplines}
            enrolledCodes={enrolledCodes}
            courseLevels={courseLevels}
            currentTerm={currentTerm}
            optativasPct={categorias[1].pct}
            embutido
          />
        </div>

        <section
          aria-labelledby="aprov"
          className="flex min-w-0 flex-col gap-4 border-t-2 border-foreground pb-8 pt-6 lg:flex-[1.3_1_480px] lg:border-l lg:border-t-0 lg:border-l-border lg:pl-8"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2">
              <h2 id="aprov" className="text-xl font-black tracking-[-0.03em] text-foreground lg:text-2xl">Aproveitamento</h2>
              <InfoPopup
                iconClassName="w-3.5 h-3.5"
                content={`Aproveitamento por período letivo. O semestre vigente (${currentTerm || '—'}) é destacado e inclui resultados marcados na tela inicial.`}
              />
            </span>
            {aprovTotais.total > 0 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                <span className="lg:hidden">{aprovTotais.aprovadas} / {aprovTotais.total} · {aprovPct}%</span>
                <span className="hidden lg:inline">{aprovTotais.aprovadas} de {aprovTotais.total} disciplinas · {aprovPct}%</span>
              </span>
            )}
          </div>

          <div className="flex flex-col border-t border-foreground/10">
            {mergedSemesters.map(({ term, approved, failed, dropped, notDone, isCurrent }) => {
              const isCurrentTerm = isCurrent || term === currentTerm;

              // Semestre vigente com turmas planejadas: uma pílula por disciplina da grade
              if (isCurrentTerm && plannedDisciplinesList.length > 0) {
                const currentItems = plannedDisciplinesList.map((d) => {
                  const rawStatus = getDisciplineStatus(d.baseCode);
                  const isOutcomeApproved = semesterOutcomes[currentTerm || '']?.approved?.includes(d.baseCode);
                  const isOutcomeFailed = semesterOutcomes[currentTerm || '']?.failed?.includes(d.baseCode);
                  const isOutcomeDropped = semesterOutcomes[currentTerm || '']?.dropped?.includes(d.baseCode);
                  const isCompleted = completedDisciplines.includes(d.baseCode);

                  let status: 'approved' | 'failed' | 'dropped' | 'none' = 'none';
                  if (rawStatus === 'approved' || isOutcomeApproved || isCompleted) status = 'approved';
                  else if (rawStatus === 'failed' || isOutcomeFailed) status = 'failed';
                  else if (rawStatus === 'dropped' || isOutcomeDropped) status = 'dropped';

                  const titulo = status === 'approved' ? 'Aprovação' : status === 'failed' ? 'Reprovação' : status === 'dropped' ? 'Trancamento' : 'Em curso';
                  return { code: d.baseCode, status, dica: `${titulo}: ${d.baseCode}${d.name ? ` — ${d.name}` : ''}` };
                });
                const aprovadasAtual = currentItems.filter((i) => i.status === 'approved').length;

                return (
                  <div key={term} className="-mx-2.5 grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] bg-nevoa px-2.5 py-[11px] lg:grid-cols-[72px_minmax(0,1fr)_96px] lg:gap-4">
                    <span className="flex flex-col gap-[3px]">
                      <span className="font-mono text-xs font-semibold text-foreground">{term}</span>
                      <span className="self-start rounded-full bg-foreground px-1.5 py-px text-[9px] font-extrabold uppercase tracking-[0.08em] text-background">Atual</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {currentItems.map((item) => <Pilula key={item.code} status={item.status} dica={item.dica} />)}
                    </span>
                    <span className="text-right font-mono text-[11px] text-foreground-2">
                      {aprovadasAtual}/{currentItems.length}<span className="hidden lg:inline"> · em curso</span>
                    </span>
                  </div>
                );
              }

              const total = approved + failed + dropped + notDone;
              const semesterDisciplines = disciplinesBySemester.get(term);
              const itens = Array.from({ length: total }).map((_, index) => {
                if (index < approved) return { status: 'approved' as const, dica: `Aprovação${semesterDisciplines?.approved[index] ? `: ${semesterDisciplines.approved[index]}` : ''}` };
                if (index < approved + failed) return { status: 'failed' as const, dica: `Reprovação${semesterDisciplines?.failed[index - approved] ? `: ${semesterDisciplines.failed[index - approved]}` : ''}` };
                if (index < approved + failed + dropped) return { status: 'dropped' as const, dica: `Trancamento${semesterDisciplines?.dropped[index - approved - failed] ? `: ${semesterDisciplines.dropped[index - approved - failed]}` : ''}` };
                return { status: 'none' as const, dica: isCurrentTerm ? 'Em curso' : 'Não concluída' };
              });

              return (
                <div
                  key={term}
                  className={`grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 py-[11px] lg:grid-cols-[72px_minmax(0,1fr)_96px] lg:gap-4 ${isCurrentTerm ? '-mx-2.5 rounded-[10px] bg-nevoa px-2.5' : 'border-b border-foreground/10'}`}
                >
                  <span className="flex flex-col gap-[3px]">
                    <span className="font-mono text-xs font-semibold text-foreground">{term}</span>
                    {isCurrentTerm && (
                      <span className="self-start rounded-full bg-foreground px-1.5 py-px text-[9px] font-extrabold uppercase tracking-[0.08em] text-background">Atual</span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {itens.map((it, i) => <Pilula key={i} status={it.status} dica={it.dica} />)}
                  </span>
                  <span className="text-right font-mono text-[11px] text-foreground-2">{approved}/{total}</span>
                </div>
              );
            })}

            {mergedSemesters.length === 0 && (
              <div className="py-8 text-center">
                <p className="mb-1 text-sm font-bold text-foreground">Nenhum dado de aproveitamento encontrado</p>
                <p className="text-[13px] text-muted-foreground">Importe seu histórico para ver o aproveitamento por semestre.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground-2">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-mar" />Aprovação / dispensa</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-pitanga" />Reprovação</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full shadow-[inset_0_0_0_1.5px_hsl(var(--foreground))]" />Trancamento</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-5 rounded-full shadow-[inset_0_0_0_1.5px_hsl(var(--tracejado))]" />Em curso</span>
          </div>
        </section>
      </div>

      {/* FONTE DOS DADOS */}
      <div className="flex flex-col gap-3 border-t-2 border-foreground pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="hidden items-center gap-2.5 text-[13px] text-foreground-2 sm:inline-flex">
          <FileText className="h-4 w-4 text-mar" strokeWidth={2.4} />
          <span>
            {fonteTexto}
            {hasImportedData && sigaaSession?.sincronizadoEm && (
              <span className="font-mono text-xs">{new Date(sigaaSession.sincronizadoEm).toLocaleDateString('pt-BR')}</span>
            )}
          </span>
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {hasImportedData && (
            <button
              onClick={pedirLimpeza}
              className="order-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-bold text-pitanga hover:bg-pitanga-tint sm:order-1 lg:hidden"
            >
              Limpar dados importados
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="order-1 inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-primary px-5 text-[15px] font-extrabold text-primary-foreground hover:bg-primary/90 sm:order-2 sm:h-11 sm:text-xs sm:font-bold"
          >
            <Upload className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={2.4} />
            {hasImportedData ? 'Atualizar histórico' : 'Importar histórico'}
          </button>
        </div>
      </div>

      {/* Boas-vindas da tela de Progresso */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
            onClick={() => setShowWelcomeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-t-[28px] bg-background px-6 pb-7 pt-3 sm:rounded-[28px] sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-trilho sm:hidden" />
              <span className="rotulo !text-foreground">Progresso</span>
              <h3 className="mt-2 text-[26px] font-black leading-[1.08] tracking-[-0.035em] text-foreground">Veja quanto do curso você já fez</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-foreground-2">
                Para ver seu progresso com dados precisos, importe o histórico escolar do SIGAA. Dele saem:
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mar" />Horas obrigatórias concluídas</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-dende" />Horas optativas concluídas</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pedra" />Horas complementares concluídas</li>
                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-foreground" />Semestres cursados</li>
              </ul>
              <div className="mt-7 flex gap-2.5">
                <button
                  onClick={() => {
                    setShowWelcomeModal(false);
                    localStorage.setItem('firstVisitProgresso', 'true');
                  }}
                  className="h-12 flex-1 rounded-full border-[1.5px] border-foreground/20 px-5 text-sm font-bold text-foreground hover:bg-nevoa"
                >
                  Agora não
                </button>
                <button
                  onClick={() => {
                    setShowWelcomeModal(false);
                    localStorage.setItem('firstVisitProgresso', 'true');
                    setShowImportModal(true);
                  }}
                  className="h-12 flex-1 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:bg-primary/90"
                >
                  Importar histórico
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ImportarHistoricoModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        titulo={hasImportedData ? 'Atualizar histórico' : 'Importar histórico para progresso'}
        descricao="Envie o PDF do SIGAA ou cole o texto do histórico para recalcular seu progresso real no curso."
        onFileChange={handleFileChange}
        texto={importText}
        onTextoChange={setImportText}
        onTextoPronto={handleParseImport}
        isParsing={isParsing}
        erro={importError}
        detectadas={parsedCodes.length}
        onCancelar={() => {
          setShowImportModal(false);
          // Mantém dados já importados; limpa apenas campos temporários
          setImportText('');
          setImportError('');
        }}
        onAplicar={handleApplyImport}
        rotuloAplicar="Aplicar"
      />
    </div>
  );
}
