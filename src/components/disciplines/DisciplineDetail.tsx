import { X, Check, ChevronDown, ChevronUp, Clock, Star } from 'lucide-react';
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
        'mt-4 inline-flex h-11 origin-center transform-gpu items-center gap-2 rounded-full px-5 text-sm font-bold will-change-transform',
        completed 
          ? 'bg-mar text-white' 
          : isAvailable
          ? 'bg-dende-claro text-dende-ink hover:bg-dende-tint'
          : isBlocked
          ? 'border-[1.5px] border-dashed border-tracejado bg-nevoa text-foreground-2'
          : 'bg-nevoa text-foreground hover:bg-trilho',
      )}
    >
      {completed ? (
        <Check className="w-4 h-4" />
      ) : (
        <span className="block h-4 w-4 rounded-full border-[1.5px] border-current" />
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3
          className="cursor-pointer select-none text-[13px] font-extrabold uppercase tracking-[0.12em] text-foreground"
          onClick={onToggle}
        >
          {title}
        </h3>
        {typeof count === 'number' && (
          <Badge variant="secondary" className="px-2 py-0.5 font-mono">
            {count}
          </Badge>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-foreground-2 hover:bg-nevoa"
        aria-label={open ? 'Recolher' : 'Expandir'}
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );

  const CollapseAnimated: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
    <>{open ? <div className="pt-2">{children}</div> : null}</>
  );

  

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-overlay/55 flex items-end sm:items-center justify-center z-50 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-background p-5 pb-8 shadow-xl sm:my-4 sm:max-w-xl sm:rounded-[28px] sm:p-6 md:max-w-2xl md:p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="w-fit font-mono text-sm font-bold text-mar">
                {currentCode}
              </span>
              <h3 className="text-[22px] font-black uppercase leading-tight tracking-[-0.03em] sm:text-[26px]">{currentName}</h3>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] font-medium text-muted-foreground">
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

          <CompletedButton 
            completed={isCompleted} 
            onClick={handleToggleCompletedWithEquivs}
            onRestrictedAction={onRestrictedAction}
            course={currentCourse}
            isAvailable={isAvailable}
            isBlocked={isBlocked}
          />

          <div className="mt-7 space-y-7">
            {currentDetail?.description && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="rotulo">Ementa</h3>
                  {isLive && <LiveDataBadge />}
                </div>
                <p className="text-sm font-medium leading-relaxed text-foreground-2">
                  {currentDetail.description}
                </p>
              </div>
            )}

            <ComponentProgram code={detailCode} />

            {/* Turmas Disponíveis com collapse */}
            <div className="space-y-3">
              <SectionHeader
                title="Turmas Disponíveis"
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
                    <div className="space-y-3">
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
              <div className="space-y-3">
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
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {options.map((_, i) => (
                            <button
                              key={`pr-option-${i}`}
                              className={cn(
                                'inline-flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition-all',
                                prereqOptionIndex === i
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-nevoa text-foreground-2 hover:bg-trilho',
                              )}
                              onClick={() => setPrereqOptionIndex(i)}
                            >
                              {`Opção ${i + 1}`}
                              {remainingCounts[i] === minRemaining && (
                                <Star className="h-3 w-3 fill-current text-ouro" />
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 gap-3">
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
              <div className="space-y-3">
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

                    <div className="grid grid-cols-1 gap-3">
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
                <div className="space-y-3">
                  <SectionHeader
                    title="Equivalentes"
                    count={unique.length}
                    open={openEquiv}
                    onToggle={() => handleToggleSection('equiv')}
                  />
                  <CollapseAnimated open={openEquiv}>
                    <div className="grid grid-cols-1 gap-3">
                      {unique.map((eq) => {
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
                      })}
                    </div>
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
