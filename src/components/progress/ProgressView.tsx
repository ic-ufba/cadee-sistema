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
import { Upload, X, Shield, GraduationCap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { Mare, PercentAnimado } from '@/components/brand/Mare';
import { useState, useEffect, useMemo } from 'react';

export function ProgressView() {
  const { completedDisciplines, toggleCompletedDiscipline, semesterOutcomes, getDisciplineStatus, customCourseWorkload } = useApp();
  const { myPrograms } = useMyPrograms();
  const { courses, isLoading: coursesLoading } = useMyCourses();
  const { mySections } = useMySections();
  const { currentTerm } = useCurrentTerm();
  const { setMode } = useMode();
  
  // Estados para importação de histórico
  const [showImportModal, setShowImportModal] = useState(false);
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

  return (
    <div className="space-y-10">
      {/* Header with program info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.035em] text-foreground sm:text-[26px]">Progresso</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasImportedData && (
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar todos os dados importados?')) {
                    clearSavedData();
                  }
                }}
                className="hidden h-10 items-center gap-2 rounded-full border-[1.5px] border-pitanga/35 px-4 text-[13px] font-bold text-pitanga hover:bg-pitanga-tint sm:inline-flex"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar dados</span>
              </button>
            )}
            {hasImportedData && (
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-nevoa px-3 text-[13px] font-bold text-foreground hover:bg-trilho sm:px-4"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar histórico</span>
              </button>
            )}
            {hasImportedData && (
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar todos os dados importados?')) {
                    clearSavedData();
                  }
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-pitanga/35 px-3 text-[13px] font-bold text-pitanga hover:bg-pitanga-tint sm:hidden"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Aviso sobre necessidade de importar histórico */}
        {!hasImportedData && (
          <div className="rounded-2xl bg-mar-claro p-4 sm:p-5">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mar">
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <div className="text-sm">
                <p className="mb-1 font-extrabold text-foreground">
                  Importe seu histórico acadêmico
                </p>
                <p className="font-medium text-foreground-2">
                  Para visualizar seu progresso no curso, 
                  <button 
                    onClick={() => {
                      setShowWelcomeModal(false);
                      setShowImportModal(true);
                    }}
                    className="ml-1 font-extrabold text-mar underline-offset-2 hover:underline"
                  >
                    importe seu histórico acadêmico
                  </button>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progresso geral: a maré + números + categorias */}
      <div className="grid grid-cols-1 items-center gap-8 border-t-2 border-foreground pt-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="-ml-[72px] flex justify-start sm:ml-0 md:justify-center">
          <Mare percent={Math.min(100, overallProgress)} size={232} className="md:hidden" />
          <Mare percent={Math.min(100, overallProgress)} size={300} className="hidden md:block" />
        </div>

        <div className="space-y-6">
          {/* Geral */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="rotulo">Progresso geral</h2>
              <InfoPopup 
                iconClassName="w-4 h-4"
                content="Progresso total baseado nas horas cursadas em relação às horas exigidas do curso (limitado ao teto de cada categoria)."
              />
            </div>
            <span className="numero block text-[48px] text-foreground sm:text-[56px]">
              <PercentAnimado value={overallProgress} />
            </span>
            <div className="mt-2 font-mono text-[13px] text-muted-foreground">
              <span>{progressData.effectiveTotalHours} / {totalRequiredHours} horas</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-trilho">
              <div 
                className="h-full rounded-full bg-foreground transition-all duration-500"
                style={{ width: `${Math.min(100, overallProgress)}%` }}
              />
            </div>
          </div>

          {/* Categorias */}
          <div className="border-t border-border pt-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
              <ProgressCard 
                title="Obrigatórias" 
                current={progressData.mandatory.completed} 
                total={progressData.mandatory.total}
                category="mandatory"
                showInfo
                isEstimated={usesCurriculumTotals}
                infoText="Horas de disciplinas obrigatórias do curso."
              />
              <ProgressCard 
                title="Optativas" 
                current={progressData.electives.completed} 
                total={progressData.electives.total}
                category="elective"
                showInfo
                isEstimated={usesCurriculumTotals}
                infoText="Horas de disciplinas optativas."
              />
              <ProgressCard 
                title="Complementares" 
                current={progressData.complementary.completed} 
                total={progressData.complementary.total}
                category="complementary"
                showInfo
                isEstimated={usesCurriculumTotals}
                infoText="Horas de atividades complementares."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Semester Grid */}
      <AdvancedSemesterGrid
        courses={courses}
        completedDisciplines={completedDisciplines}
        enrolledCodes={enrolledCodes}
        courseLevels={courseLevels}
        currentTerm={currentTerm}
        showInfo
        infoText="Progresso real por semestre baseado nas disciplinas obrigatórias do curso e nas que você já concluiu ou planejou."
      />

      {/* Aproveitamento Section */}
      <div className="border-t-2 border-foreground pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[22px] font-black tracking-[-0.035em] text-foreground">Aproveitamento</h3>
            {currentTerm && (
              <span className="rounded-full bg-nevoa px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground">
                Vigente: {currentTerm}
              </span>
            )}
            <InfoPopup 
              iconClassName="w-3.5 h-3.5"
              content={`Aproveitamento por período letivo. O semestre vigente (${currentTerm || '—'}) é destacado e inclui resultados marcados na tela inicial.`}
            />
          </div>
        </div>

        <div className="space-y-3">
          {mergedSemesters.map(({ term, approved, failed, dropped, notDone, isCurrent }) => {
            const isCurrentTerm = isCurrent || term === currentTerm;

            // Se for o semestre vigente e houver disciplinas planejadas:
            if (isCurrentTerm && plannedDisciplinesList.length > 0) {
              const currentItems = plannedDisciplinesList.map((d) => {
                const rawStatus = getDisciplineStatus(d.baseCode);
                const isOutcomeApproved = semesterOutcomes[currentTerm || '']?.approved?.includes(d.baseCode);
                const isOutcomeFailed = semesterOutcomes[currentTerm || '']?.failed?.includes(d.baseCode);
                const isOutcomeDropped = semesterOutcomes[currentTerm || '']?.dropped?.includes(d.baseCode);
                const isCompleted = completedDisciplines.includes(d.baseCode);

                let status: 'approved' | 'failed' | 'dropped' | 'none' = 'none';
                if (rawStatus === 'approved' || isOutcomeApproved || isCompleted) {
                  status = 'approved';
                } else if (rawStatus === 'failed' || isOutcomeFailed) {
                  status = 'failed';
                } else if (rawStatus === 'dropped' || isOutcomeDropped) {
                  status = 'dropped';
                }

                let colorClass = 'border-[1.5px] border-dashed border-tracejado';
                let title = 'Não finalizado / Em andamento';

                if (status === 'approved') {
                  colorClass = 'bg-mar';
                  title = 'Aprovação';
                } else if (status === 'failed') {
                  colorClass = 'bg-pitanga';
                  title = 'Reprovação';
                } else if (status === 'dropped') {
                  colorClass = 'border-2 border-foreground';
                  title = 'Trancamento';
                }

                return {
                  code: d.baseCode,
                  name: d.name,
                  status,
                  colorClass,
                  tooltip: `${title}: ${d.baseCode}${d.name ? ` — ${d.name}` : ''}`,
                };
              });

              const currentApprovedCount = currentItems.filter((i) => i.status === 'approved').length;
              const currentTotalCount = currentItems.length;

              return (
                <div
                  key={term}
                  className="space-y-2.5 rounded-2xl bg-nevoa px-3 py-3 -mx-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-foreground">
                        {term}
                      </span>
                      <span className="rounded-full bg-dende px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-foreground">
                        Atual
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-foreground-2">
                      {currentApprovedCount}/{currentTotalCount} disciplinas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-[5px]">
                    {currentItems.map((item, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-[11px] w-[26px] rounded-full ${item.colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{item.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              );
            }

            // Para semestres passados ou quando não há turmas planejadas:
            const total = approved + failed + dropped + notDone;
            const semesterDisciplines = disciplinesBySemester.get(term);

            return (
              <div
                key={term}
                className={`space-y-2.5 border-b border-border py-3 ${isCurrentTerm ? 'rounded-2xl border-b-0 bg-nevoa px-3 -mx-3' : ''}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={isCurrentTerm ? 'font-mono text-[13px] font-semibold text-foreground' : 'font-mono text-[13px] font-semibold text-foreground-2'}>
                      {term}
                    </span>
                    {isCurrentTerm && (
                      <span className="rounded-full bg-dende px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-foreground">
                        Atual
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground-2">
                    {approved}/{total} disciplinas
                  </span>
                </div>
                <div className="flex flex-wrap gap-[5px]">
                  {Array.from({ length: total }).map((_, index) => {
                    let colorClass: string;
                    let title: string;
                    let disciplineCode: string | undefined;

                    if (index < approved) {
                      colorClass = 'bg-mar';
                      title = 'Aprovação';
                      disciplineCode = semesterDisciplines?.approved[index];
                    } else if (index < approved + failed) {
                      colorClass = 'bg-pitanga';
                      title = 'Reprovação';
                      disciplineCode = semesterDisciplines?.failed[index - approved];
                    } else if (index < approved + failed + dropped) {
                      colorClass = 'border-2 border-foreground';
                      title = 'Trancamento';
                      disciplineCode = semesterDisciplines?.dropped[index - approved - failed];
                    } else {
                      colorClass = 'border-[1.5px] border-dashed border-tracejado';
                      title = 'Não feito';
                    }

                    const tooltipContent = disciplineCode ? `${title}: ${disciplineCode}` : title;

                    return (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-[11px] w-[26px] rounded-full ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{tooltipContent}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {mergedSemesters.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2">Nenhum dado de aproveitamento encontrado</p>
              <p className="text-sm text-muted-foreground">Importe seu histórico para visualizar seu aproveitamento por semestre</p>
            </div>
          )}
          
          {/* Estatísticas gerais */}
          <div className="pt-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold sm:flex sm:flex-wrap">
              <div className="flex items-center gap-2">
                <div className="h-[9px] w-[22px] rounded-full bg-mar" />
                <span className="text-muted-foreground">Aprovação/Dispensa</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[9px] w-[22px] rounded-full bg-pitanga" />
                <span className="text-muted-foreground">Reprovação</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[9px] w-[22px] rounded-full border-2 border-foreground" />
                <span className="text-muted-foreground">Trancamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[9px] w-[22px] rounded-full border-[1.5px] border-dashed border-tracejado" />
                <span className="text-muted-foreground">Não feito</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Boas-vindas/Importação Obrigatória */}
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
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Bem-vindo à tela de Progresso
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Para visualizar seu progresso acadêmico com dados precisos, 
                    você precisa importar seu histórico acadêmico.
                  </p>
                </div>

                <div className="rounded-2xl bg-mar-claro p-4 sm:p-5">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                    📊 O que será extraído:
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <div>• Horas obrigatórias concluídas</div>
                    <div>• Horas optativas concluídas</div>
                    <div>• Horas complementares concluídas</div>
                    <div>• Semestres cursados</div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowWelcomeModal(false);
                      localStorage.setItem('firstVisitProgresso', 'true');
                    }}
                    className="flex-1 h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                  >
                    Agora não
                  </button>
                  <button
                    onClick={() => {
                      setShowWelcomeModal(false);
                      localStorage.setItem('firstVisitProgresso', 'true');
                      setShowImportModal(true);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                  >
                    Importar histórico
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className="min-w-0">
                    <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Importar histórico para progresso</p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Envie o PDF ou cole o texto do histórico para calcular seu progresso real no curso.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowImportModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-tracejado bg-nevoa px-4 transition-colors hover:bg-trilho">
                  <Upload className="h-5 w-5 shrink-0 text-foreground" />
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

                {/* Retorno visual simples (as métricas do curso ficam ocultas no novo visual) */}
                {parsedCodes.length > 0 && (
                  <div className="flex items-center gap-2 rounded-[14px] bg-nevoa px-4 py-3 text-sm font-semibold text-foreground">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mar" />
                    {parsedCodes.length} disciplina{parsedCodes.length > 1 ? 's' : ''} aprovada{parsedCodes.length > 1 ? 's' : ''} detectada{parsedCodes.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Métricas de Progresso do Curso - só mostra quando há dados importados */}
                {(parsedWorkload || parsedCodes.length > 0) && (
                  <div className="hidden">
                    <p className="text-sm font-medium text-foreground">
                      Métricas do Curso
                    </p>
                    
                    {/* Se encontrou dados de carga horária do histórico, mostra os dados reais */}
                    {parsedWorkload ? (
                      <div className="space-y-3">
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-3">
                            Dados Extraídos do Histórico
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
                    ) : (
                      /* Se não encontrou dados de carga horária, mostra estimativa baseada em disciplinas */
                      <div className="space-y-3">
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">
                            Estimativa Baseada em Disciplinas
                          </div>
                          <div className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                            Tabela de carga horária não encontrada. Calculando com base nas disciplinas aprovadas.
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-mar-claro p-4 sm:p-5">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                              Horas Obrigatórias
                            </div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                              {Math.floor(parsedCodes.length * 0.7 * 60)}h
                            </div>
                          </div>
                          
                          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                              Horas Optativas
                            </div>
                            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                              {Math.floor(parsedCodes.length * 0.2 * 60)}h
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                              Horas Complementares
                            </div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {Math.floor(parsedCodes.length * 0.1 * 60)}h
                            </div>
                          </div>
                        </div>

                        {/* Taxa de Aproveitamento */}
                        {parsedCodes.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                              Aproveitamento Estimado
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                {Math.round((parsedCodes.length / (parsedSemesters.size * 6 || 1)) * 100)}%
                              </span>
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                ({parsedCodes.length} disciplinas em {parsedSemesters.size} semestres)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    // Mantém dados já importados; limpa apenas campos temporários
                    setImportText('');
                    setImportError('');
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
                  Aplicar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
