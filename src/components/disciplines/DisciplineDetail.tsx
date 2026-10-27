import { X, Check, ChevronDown, ChevronUp, Clock, Star, Lock } from 'lucide-react';
import { Course, parseSigaaSchedule } from '@/services/api';
import type { Section } from '@/services/api';
import { getBlockCourseBaseCode, isBlockCourseCode } from '@/lib/blockCourses';
import { useCourseSections, useCourseByCode, useCourses, useSections } from '@/hooks/useApi';
import { useApp } from '@/contexts/AppContext';
import { useMySections } from '@/hooks/useMySections';
import { cn, getFreeSeats } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useFavoriteCourses } from '@/hooks/useFavoriteCourses';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { LargeDisciplineCard } from '@/components/disciplines/LargeDisciplineCard';
import { SectionCard } from '@/components/disciplines/SectionCard';
import { BreadcrumbTags } from '@/components/disciplines/BreadcrumbTags';
import { Badge } from '@/components/ui/badge';
import { motion, useAnimationControls } from 'motion/react';
import { FavoriteButton } from '@/components/common/FavoriteButton';
import { AnimatePresence } from 'framer-motion';
import { fetchCourseByCode } from '@/services/api';
import { useQueries } from '@tanstack/react-query';
import { ComponentProgram, LiveDataBadge } from '@/components/sigaa/ComponentProgram';
// Extracted component to keep identity stable across renders
function CompletedButton({
  completed,
  onClick,
  onRestrictedAction,
  course,
  isAvailable,
  isBlocked,
}: { 
  completed: boolean; 
  onClick: () => void;
  onRestrictedAction?: (type: 'completed' | 'favorite', course: Course) => void;
  course?: Course;
  isAvailable?: boolean;
  isBlocked?: boolean;
}) {
  const controls = useAnimationControls();
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return; // avoid animating on first mount
    }
    // Refined symmetric elastic: expand horizontally from center, slight vertical counter-stretch
    const scaleX = [1, 1.18, 0.92, 1.06, 1];
    const scaleY = [1, 0.92, 1.06, 0.98, 1];
    controls.start({
      scaleX,
      scaleY,
      transition: {
        duration: 0.6,
        times: [0, 0.35, 0.6, 0.85, 1],
        ease: [0.22, 1, 0.36, 1],
      },
    });
  }, [completed, controls]);

  const handleClick = () => {
    // Se já está cursada, permite desmarcar diretamente
    if (completed) {
      onClick();
    } else if (onRestrictedAction && course) {
      // Se não está cursada, verifica se está bloqueada
      onRestrictedAction('completed', course);
    } else {
      onClick();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      animate={controls}
      whileHover={{ scale: 1.02 }}
      className={cn(
        'inline-flex h-12 origin-center transform-gpu items-center gap-[9px] rounded-full pl-4 pr-5 text-sm font-extrabold will-change-transform',
        completed 
          ? 'bg-mar text-white' 
          : isAvailable
          ? 'bg-dende-claro text-dende-ink shadow-[inset_0_0_0_1.5px_hsl(var(--dende)/0.55)] hover:bg-dende-tint'
          : isBlocked
          ? 'bg-nevoa text-foreground-2 shadow-[inset_0_0_0_1.5px_hsl(var(--foreground)/0.14)]'
          : 'bg-nevoa text-foreground hover:bg-trilho',
      )}
    >
      {completed ? (
        <Check className="w-4 h-4" />
      ) : (
        <span className={cn('block h-4 w-4 rounded-full border-2 border-current', isBlocked && 'border-dashed')} />
      )}
      <span>{completed ? 'Cursada' : 'Marcar como cursada'}</span>
    </motion.button>
  );
}

interface DisciplineDetailProps {
  discipline: Course;
  onClose: () => void;
  onRestrictedAction?: (type: 'completed' | 'favorite', course: Course, mainCode?: string) => void;
}

export function DisciplineDetail({ discipline, onClose, onRestrictedAction }: DisciplineDetailProps) {
  const { completedDisciplines, toggleCompletedDiscipline, getDisciplineStatus, setDisciplineStatus, clearDisciplineStatus } = useApp();
  const { mySections, toggleSection } = useMySections();
  // Estado local para navegação dentro do drawer
  const [stack, setStack] = useState<{ code: string }[]>([{ code: discipline.code }]);
  const currentCode = stack[stack.length - 1]?.code || discipline.code;
  const detailCode = isBlockCourseCode(currentCode) ? getBlockCourseBaseCode(currentCode) : currentCode;

  const { data: sections = [], isLoading } = useCourseSections(currentCode);
  const { data: allSections = [] } = useSections();
  const { data: currentDetail, isLive } = useCourseByCode(detailCode);
  const { data: allCourses = [] } = useCourses();
  const currentName = currentDetail?.name ?? discipline.name;

  // estados de colapso
  const [openClasses, setOpenClasses] = useState(false);
  const [openPrereq, setOpenPrereq] = useState(false);
  const [openCoreq, setOpenCoreq] = useState(false);
  const [openEquiv, setOpenEquiv] = useState(false);
  const [verEquivIndisponiveis, setVerEquivIndisponiveis] = useState(false);

  // Função para comportamento de accordion
  const handleToggleSection = (section: 'classes' | 'prereq' | 'coreq' | 'equiv') => {
    const isCurrentlyOpen = {
      classes: openClasses,
      prereq: openPrereq,
      coreq: openCoreq,
      equiv: openEquiv,
    }[section];

    // Se já está aberto, fecha. Se está fechado, abre e fecha os outros
    if (isCurrentlyOpen) {
      setOpenClasses(false);
      setOpenPrereq(false);
      setOpenCoreq(false);
      setOpenEquiv(false);
    } else {
      setOpenClasses(section === 'classes');
      setOpenPrereq(section === 'prereq');
      setOpenCoreq(section === 'coreq');
      setOpenEquiv(section === 'equiv');
    }
  };

  // seleção de opção para arrays de arrays
  const [prereqOptionIndex, setPrereqOptionIndex] = useState(0);
  const [coreqOptionIndex, setCoreqOptionIndex] = useState(0);

  // quando o discipline externo muda (abrir novo drawer), resetar stack
  useEffect(() => {
    setStack([{ code: discipline.code }]);
    setPrereqOptionIndex(0);
    setCoreqOptionIndex(0);
    setOpenClasses(false);
    setOpenPrereq(false);
    setOpenCoreq(false);
    setOpenEquiv(false);
  }, [discipline.code]);

  // Ao navegar para outra disciplina dentro do drawer, colapsar tudo por padrão
  useEffect(() => {
    setOpenClasses(false);
    setOpenPrereq(false);
    setOpenCoreq(false);
    setOpenEquiv(false);
    setPrereqOptionIndex(0);
    setCoreqOptionIndex(0);
  }, [currentCode]);
  const { isFavorite, toggleFavorite } = useFavoriteCourses();

  // Busca bidirecional de equivalentes: apenas equivalentes diretos + inversos relevantes
  // Otimizado para não buscar TODOS os cursos do sistema
  const relatedCodesForEquiv = useMemo(() => {
    const set = new Set<string>();
    set.add(currentCode);
    set.add(detailCode);
    
    // Adiciona equivalentes diretos do currentDetail
    if (currentDetail?.equivalences) {
      for (const grp of currentDetail.equivalences) {
        for (const eq of grp) {
          if ((eq as any).code) set.add((eq as any).code);
        }
      }
    }
    
    // Busca inversa limitada: apenas cursos que têm currentCode como equivalente
    // Para evitar buscar todos os cursos, buscamos apenas os equivalentes diretos
    // A busca inversa será feita sob demanda quando necessário
    return Array.from(set);
  }, [currentCode, detailCode, currentDetail]);

  const relatedCourseDetails = useQueries({
    queries: relatedCodesForEquiv.map(code => ({
      queryKey: ['course-by-code', code],
      queryFn: () => fetchCourseByCode(code),
      enabled: !!code && openEquiv, // Só busca quando a seção de equivalentes está aberta
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
    })),
  });

  // Retorna TODOS os códigos equivalentes (bidirecional) para um código base
  const getAllEquivalentCodesFor = useCallback((code: string): string[] => {
    const base = getBlockCourseBaseCode(code);
    const set = new Set<string>();
    for (const res of relatedCourseDetails) {
      const detail = res.data;
      if (!detail?.equivalences || !detail?.code) continue;
      const detailBase = getBlockCourseBaseCode(detail.code);
      let isRelated = detailBase === base;
      const bases = new Set<string>([detailBase]);
      for (const grp of detail.equivalences) {
        for (const eq of grp) {
          const eqCode = (eq as any).code;
          if (!eqCode) continue;
          const eqBase = getBlockCourseBaseCode(eqCode);
          bases.add(eqBase);
          if (eqBase === base) isRelated = true;
        }
      }
      if (isRelated) {
        set.add(detail.code);
        for (const b of bases) {
          for (const c of allCourses) {
            if (getBlockCourseBaseCode(c.code) === b) set.add(c.code);
          }
        }
        if (getBlockCourseBaseCode(code) === getBlockCourseBaseCode(detail.code)) set.add(code);
      }
    }
    // Inclui os equivalentes explícitos do currentDetail caso não estejam ainda
    if (currentDetail?.equivalences) {
      for (const grp of currentDetail.equivalences) {
        for (const eq of grp) {
          const eqCode = (eq as any).code;
          if (eqCode) set.add(eqCode);
        }
      }
    }
    return Array.from(set);
  }, [relatedCourseDetails, allCourses, currentDetail]);

  // Marca/desmarca cursada para currentCode e todos equivalentes
  const handleToggleCompletedWithEquivs = useCallback(() => {
    const codes = new Set<string>([currentCode, ...getAllEquivalentCodesFor(currentCode)]);
    // Se está aprovada (ou completed direto) → estamos desmarcando
    const status = getDisciplineStatus(currentCode);
    const wasApproved = completedDisciplines.includes(currentCode) || status === 'approved';
    codes.forEach(c => {
      const cStatus = getDisciplineStatus(c);
      if (wasApproved) {
        // Remover: tira da lista completed e limpa status se era approved
        if (completedDisciplines.includes(c)) {
          toggleCompletedDiscipline(c);
        } else if (cStatus === 'approved') {
          clearDisciplineStatus(c);
        }
      } else {
        // Adicionar: marca como completed e status approved
        const isCompletedNow = completedDisciplines.includes(c) || cStatus === 'approved';
        if (!isCompletedNow) {
          toggleCompletedDiscipline(c);
          setDisciplineStatus(c, 'approved');
        }
      }
    });
  }, [currentCode, getAllEquivalentCodesFor, getDisciplineStatus, completedDisciplines, toggleCompletedDiscipline, setDisciplineStatus, clearDisciplineStatus]);

  const handleAddClass = (section: Section) => {
    const isAlreadyAdded = mySections.some((s) => s.id_ref === section.id_ref);
    toggleSection(section, allSections);
    toast({
      title: isAlreadyAdded ? 'Turma removida' : 'Turma adicionada!',
      description: `${currentName} (${(section as any).section_code || section.id_ref}) ${isAlreadyAdded ? 'removida da' : 'foi adicionada à'} sua lista.`,
      variant: isAlreadyAdded ? 'default' : 'default',
    });
  };

  const isCompleted = useMemo(() => {
    // failed / dropped tem prioridade máxima
    const status = getDisciplineStatus(currentCode);
    if (status === 'failed' || status === 'dropped') return false;
    const direct = completedDisciplines.includes(currentCode) || status === 'approved';
    if (direct) return true;
    // Verifica se algum equivalente está cursada (e não failed/dropped)
    const base = getBlockCourseBaseCode(currentCode);
    for (const res of relatedCourseDetails) {
      const detail = res.data;
      if (!detail?.code) continue;
      const eqCode = detail.code;
      const eqBase = getBlockCourseBaseCode(eqCode);
      // Verifica se é equivalente ao currentCode
      const directEq = currentDetail?.equivalences?.some(g => g.some(e => (e as any).code && getBlockCourseBaseCode((e as any).code) === eqBase));
      const reverseEq = detail.equivalences?.some(g => g.some(e => (e as any).code && getBlockCourseBaseCode((e as any).code) === base));
      const sameBase = eqBase === base;
      if (sameBase || directEq || reverseEq) {
        const s = getDisciplineStatus(eqCode);
        if (s === 'failed' || s === 'dropped') continue;
        if (completedDisciplines.includes(eqCode) || s === 'approved') return true;
      }
    }
    return false;
  }, [currentCode, completedDisciplines, getDisciplineStatus, currentDetail, relatedCourseDetails]);
  
  // Verificar se disciplina está disponível ou bloqueada
  const currentCourse: Course = {
    code: currentCode,
    name: currentName,
    prerequisites: (currentDetail as any)?.prerequisites || [],
    mode: currentDetail?.mode || '',
    id_ref: currentDetail?.id_ref || '',
    location: currentDetail?.location || '',
    department: currentDetail?.department || '',
    type: currentDetail?.type || '',
    credits: currentDetail?.credits || 0,
    workload: (currentDetail as any)?.workload || 0,
    sections_count: (currentDetail as any)?.sections_count || 0,
    sections_url: (currentDetail as any)?.sections_url || '',
    detail_url: (currentDetail as any)?.detail_url || ''
  };
  
  // Importar a lógica de verificação de pré-requisitos
  const hasAllPrereqsDone = (course: Course) => {
    if (!course.prerequisites || course.prerequisites.length === 0) return true;
    
    // Se não há pré-requisitos ou é array vazio, está disponível
    if (course.prerequisites.length === 0) return true;
    
    // Verificar se ALGUMA das opções de pré-requisitos está completamente atendida
    for (const option of course.prerequisites) {
      if (!option || option.length === 0) continue;
      
      // Se todos os pré-requisitos desta opção estão concluídos
      if (option.every(prereq => completedDisciplines.includes(prereq.code || prereq))) {
        return true;
      }
    }
    
    return false;
  };
  
  const isAvailable = !isCompleted && hasAllPrereqsDone(currentCourse);
  const isBlocked = !isCompleted && !isAvailable;

  // Local UI components (small and focused)
  const SectionHeader = ({
    title,
    count,
    open,
    onToggle,
  }: { title: string; count?: number; open: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex min-h-[58px] w-full items-center gap-2.5 text-left text-foreground"
    >
      <h3 className="text-base font-black tracking-[-0.01em]">{title}</h3>
      {typeof count === 'number' && (
        <span className="rounded-full bg-nevoa px-[9px] py-0.5 font-mono text-xs font-semibold">{count}</span>
      )}
      <span className="flex-1" />
      {open ? <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2.2} />}
    </button>
  );

  const CollapseAnimated: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
    <>{open ? <div className="pb-1.5">{children}</div> : null}</>
  );

  

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="max-h-[calc(100vh-64px)] w-full overflow-y-auto rounded-t-[28px] bg-background pb-8 shadow-xl sm:my-4 sm:max-h-[88vh] sm:max-w-xl sm:rounded-[28px] md:max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-trilho sm:hidden" />
          <div className="flex items-start gap-3 pl-6 pr-4 pt-4 sm:px-7 sm:pt-7">
            <div className="flex flex-1 flex-col gap-2.5">
              <span
                className={cn(
                  'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[13px] font-semibold',
                  isCompleted ? 'bg-mar-tint text-mar-ink' : isAvailable ? 'bg-dende-claro text-dende-ink' : 'bg-trilho text-foreground-2'
                )}
              >
                {isBlocked && <Lock className="h-3 w-3" strokeWidth={2.4} />}
                {currentCode}
              </span>
              <h2 className="text-[26px] font-black uppercase leading-[1.08] tracking-[-0.03em]">{currentName}</h2>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho">
              <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>

          <div className="hidden">
            {typeof (currentDetail as any)?.workload === 'number' && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{(currentDetail as any)?.workload}h</span>
              </div>
            )}
            {typeof (currentDetail as any)?.credits === 'number' && (
              <span>{(currentDetail as any)?.credits} créditos</span>
            )}
            {(currentDetail as any)?.semester && <span>{(currentDetail as any)?.semester}º Semestre</span>}
          </div>

          <div className="px-6 pb-2 pt-5 sm:px-7">
          <CompletedButton 
            completed={isCompleted} 
            onClick={handleToggleCompletedWithEquivs}
            onRestrictedAction={onRestrictedAction}
            course={currentCourse}
            isAvailable={isAvailable}
            isBlocked={isBlocked}
          />
          </div>

          <div className="mx-6 border-t-2 border-foreground sm:mx-7 [&>*+*]:border-t [&>*+*]:border-foreground/15">
            {currentDetail?.description && (
              <div className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-black tracking-[-0.01em] text-foreground">Ementa</h3>
                  {isLive && <LiveDataBadge />}
                </div>
                <p className="text-sm font-medium leading-relaxed text-foreground-2">
                  {currentDetail.description}
                </p>
              </div>
            )}

            <div className="empty:hidden"><ComponentProgram code={detailCode} /></div>

            {/* Turmas Disponíveis com collapse */}
            <div>
              <SectionHeader
                title="Turmas disponíveis"
                count={sections.length}
                open={openClasses}
                onToggle={() => handleToggleSection('classes')}
              />

              <CollapseAnimated open={openClasses}>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-[18px] bg-nevoa p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-40 rounded-full bg-trilho" />
                              <div className="h-3 w-48 rounded-full bg-trilho" />
                              <div className="h-3 w-32 rounded-full bg-trilho" />
                            </div>
                            <div className="h-9 w-24 rounded-full bg-trilho" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sections.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma turma disponível para esta disciplina no momento.</p>
                  ) : (
                    <div>
                      {[...sections]
                        .sort((a, b) => getFreeSeats(b) - getFreeSeats(a))
                        .map((section) => {
                        const isAdded = mySections.some((s) => s.id_ref === section.id_ref);
                        return (
                          <SectionCard
                            key={section.id_ref}
                            section={section}
                            isAdded={isAdded}
                            onAdd={() => handleAddClass(section)}
                            onNavigateCourse={(code) => setStack((prev) => [...prev, { code }])}
                          />
                        );
                      })}
                    </div>
                  )}
              </CollapseAnimated>
            </div>

            {/* Pré-requisitos */}
            {(currentDetail?.prerequisites?.length || 0) > 0 && (
              <div>
                <SectionHeader
                  title="Pré-requisitos"
                  count={currentDetail?.prerequisites?.length}
                  open={openPrereq}
                  onToggle={() => handleToggleSection('prereq')}
                />

                <CollapseAnimated open={openPrereq}>
                    {(() => {
                      const options = currentDetail?.prerequisites || [];
                      const remainingCounts = options.map((opt) => {
                        const list = opt || [];
                        return list.reduce((acc, item) => {
                          const code = (item as any)?.code;
                          return acc + (code && !completedDisciplines.includes(code) ? 1 : 0);
                        }, 0);
                      });
                      const minRemaining = remainingCounts.length > 0 ? Math.min(...remainingCounts) : 0;
                      return (
                        <>
                        <div role="tablist" aria-label="Opções de pré-requisito" className="grid flex-1 rounded-full bg-nevoa p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
                          {options.map((_, i) => (
                            <button
                              key={`pr-option-${i}`}
                              className={cn(
                                'inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold transition-all',
                                prereqOptionIndex === i
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-foreground-2 hover:text-foreground',
                              )}
                              onClick={() => setPrereqOptionIndex(i)}
                            >
                              {`Opção ${i + 1}`}
                              {remainingCounts[i] === minRemaining && (
                                <Star className="h-3.5 w-3.5 fill-ouro text-ouro" />
                              )}
                            </button>
                          ))}
                        </div>
                        {options.length > 1 && remainingCounts[prereqOptionIndex] === minRemaining && (
                          <span className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-muted-foreground">
                            <Star className="h-3 w-3 fill-ouro text-ouro" />
                            Melhor opção
                          </span>
                        )}
                        </>
                      );
                    })()}

                    <div className="flex flex-col">
                      {(currentDetail!.prerequisites![prereqOptionIndex] || []).map((pr) => {
                        const synced = !!(pr as any).name;
                        const code = pr.code;
                        const name = (pr as any).name as string | undefined;
                        const summary = allCourses.find((c) => c.code === code) || null;
                        const isPrereqCompleted = completedDisciplines.includes(code);
                        
                        return (
                          <LargeDisciplineCard
                            key={`pre-${code}`}
                            code={code}
                            synced={synced}
                            name={name}
                            summary={summary}
                            isEquivalent={true}
                            showCompletedButton={synced}
                            onClick={synced ? () => setStack((prev) => [...prev, { code }]) : undefined}
                            onRestrictedAction={onRestrictedAction}
                            courseData={summary}
                          />
                        );
                      })}
                    </div>
                </CollapseAnimated>
              </div>
            )}

            {/* Correquisitos */}
            {(currentDetail?.corequisites?.length || 0) > 0 && (
              <div>
                <SectionHeader
                  title="Correquisitos"
                  count={currentDetail?.corequisites?.length}
                  open={openCoreq}
                  onToggle={() => handleToggleSection('coreq')}
                />

                <CollapseAnimated open={openCoreq}>
                    {(currentDetail?.corequisites?.length || 0) > 1 && (
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {currentDetail!.corequisites!.map((_, i) => (
                          <button
                            key={`co-option-${i}`}
                            className={cn(
                              'h-9 rounded-full px-4 text-xs font-bold transition-all',
                              coreqOptionIndex === i
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-nevoa text-foreground-2 hover:bg-trilho',
                            )}
                            onClick={() => setCoreqOptionIndex(i)}
                          >
                            {`Opção ${i + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col">
                      {(currentDetail!.corequisites![coreqOptionIndex] || []).map((co) => {
                        const synced = !!(co as any).name;
                        const code = co.code;
                        const name = (co as any).name as string | undefined;
                        const summary = allCourses.find((c) => c.code === code) || null;
                        return (
                          <LargeDisciplineCard
                            key={`co-${code}`}
                            code={code}
                            synced={synced}
                            name={name}
                            summary={summary}
                            onClick={synced ? () => setStack((prev) => [...prev, { code }]) : undefined}
                          />
                        );
                      })}
                    </div>
                </CollapseAnimated>
              </div>
            )}

            {/* Equivalentes */}
            {(currentDetail?.equivalences?.length || 0) > 0 && (() => {
              // Flatten + dedupe por código
              const flat = (currentDetail?.equivalences || []).flat();
              const seen = new Set<string>();
              const unique = flat.filter((eq) => {
                if (!eq?.code) return false;
                if (seen.has(eq.code)) return false;
                seen.add(eq.code);
                return true;
              });
              if (unique.length === 0) return null;
              return (
                <div>
                  <SectionHeader
                    title="Equivalentes"
                    count={unique.length}
                    open={openEquiv}
                    onToggle={() => handleToggleSection('equiv')}
                  />
                  <CollapseAnimated open={openEquiv}>
                    {(() => {
                      const renderEquivalente = (eq: (typeof unique)[number]) => {
                        const synced = !!(eq as any).name;
                        const code = eq.code;
                        const name = (eq as any).name as string | undefined;
                        const summary = allCourses.find((c) => c.code === code) || null;
                        const isEquivCompleted = completedDisciplines.includes(code);
                        const isMainCompleted = completedDisciplines.includes(currentCode);
                        
                        // Buscar pré-requisitos da equivalente - usar eq diretamente se tiver, senão buscar do summary
                        let equivPrereqs = (eq as any)?.prerequisites || (summary as any)?.prerequisites || [];
                        
                        // Se a equivalente não tiver pré-requisitos nos dados, usar os pré-requisitos da disciplina principal como fallback
                        // (equivalentes geralmente têm pré-requisitos similares à disciplina principal)
                        if (equivPrereqs.length === 0 && currentDetail?.prerequisites) {
                          equivPrereqs = currentDetail.prerequisites;
                        }
                        
                        // Criar objeto Course completo para a equivalente com pré-requisitos
                        const equivCourseData: Course = {
                          code: code,
                          name: name || code,
                          prerequisites: equivPrereqs,
                          mode: (summary as any)?.mode || '',
                          id_ref: (summary as any)?.id_ref || '',
                          location: (summary as any)?.location || '',
                          department: (summary as any)?.department || '',
                          type: (summary as any)?.type || '',
                          credits: (summary as any)?.credits || 0,
                          workload: (summary as any)?.workload || 0,
                          sections_count: (summary as any)?.sections_count || 0,
                          sections_url: (summary as any)?.sections_url || '',
                          detail_url: (summary as any)?.detail_url || ''
                        };
                        
                        // Mostrar botão se equivalente está cursada (para desmarcar) ou se principal não está cursada (para marcar)
                        const showButton = isEquivCompleted || !isMainCompleted;
                        
                        return (
                          <LargeDisciplineCard
                            key={`eq-${code}`}
                            code={code}
                            synced={synced}
                            name={name}
                            summary={summary}
                            isEquivalent={true}
                            showCompletedButton={showButton}
                            mainCode={currentCode}
                            equivPrerequisites={equivPrereqs}
                            onClick={synced ? () => setStack((prev) => [...prev, { code }]) : undefined}
                            onRestrictedAction={onRestrictedAction}
                            courseData={equivCourseData}
                          />
                        );
                      };
                      // As indisponíveis (ainda não sincronizadas) ficam recolhidas num submenu
                      const disponiveis = unique.filter((eq) => !!(eq as { name?: string }).name);
                      const indisponiveis = unique.filter((eq) => !(eq as { name?: string }).name);
                      return (
                        <div className="flex flex-col">
                          {disponiveis.map(renderEquivalente)}
                          {indisponiveis.length > 0 && (
                            <div className={cn(disponiveis.length > 0 && 'mt-1 border-t border-foreground/10')}>
                              <button
                                type="button"
                                aria-expanded={verEquivIndisponiveis}
                                onClick={() => setVerEquivIndisponiveis((v) => !v)}
                                className="flex min-h-[48px] w-full items-center gap-2 text-left text-foreground-2 hover:text-foreground"
                              >
                                <span className="text-[13px] font-extrabold">Indisponíveis</span>
                                <span className="rounded-full bg-nevoa px-2 py-0.5 font-mono text-[11px] font-semibold">{indisponiveis.length}</span>
                                <span className="flex-1" />
                                {verEquivIndisponiveis ? <ChevronUp className="h-4 w-4" strokeWidth={2.2} /> : <ChevronDown className="h-4 w-4" strokeWidth={2.2} />}
                              </button>
                              {verEquivIndisponiveis && <div className="flex flex-col">{indisponiveis.map(renderEquivalente)}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CollapseAnimated>
                </div>
              );
            })()}
            
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
