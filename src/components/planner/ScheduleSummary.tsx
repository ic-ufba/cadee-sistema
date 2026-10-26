import { Users, Trash2, Clock, Info, AlertTriangle, CheckCircle2, XCircle, Ban, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMySections } from '@/hooks/useMySections';
import { useMyCourses } from '@/hooks/useMyCourses.ts';
import { useApp } from '@/contexts/AppContext';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { useCourses, useSections, useCourseByCode } from '@/hooks/useApi';
import { DisciplineDetail } from '@/components/disciplines/DisciplineDetail';
import { fetchCourseByCode } from '@/services/api';
import type { Course, Section } from '@/services/api';
import type { DisciplineStatus } from '@/lib/semester';
import { formatTimeCodes } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { getBlockCourseBaseCode, isBlockCourseCode, resolveBlockCourseName, getBlockCourseVariantLabel, findCorrespondingBlockSections } from '@/lib/blockCourses';
import { usePlannedDisciplineCategories } from '@/hooks/usePlannedDisciplineCategories';

const STATUS_CONFIG: Record<DisciplineStatus, { label: string; icon: typeof CheckCircle2; activeClass: string }> = {
  approved: {
    label: 'Cursada',
    icon: CheckCircle2,
    activeClass: 'bg-mar text-white border-mar',
  },
  failed: {
    label: 'Reprovada',
    icon: XCircle,
    activeClass: 'bg-pitanga text-white border-pitanga',
  },
  dropped: {
    label: 'Trancada',
    icon: Ban,
    activeClass: 'bg-background text-foreground border-foreground border-2',
  },
};

function getConflictCodes(conflicts: Array<{ code: string; section: Section }>): string[] {
  const codes = new Set<string>();
  for (const c of conflicts) {
    const code = c.section.course?.code || (c.section as { course_code?: string }).course_code;
    if (code) codes.add(code);
  }
  return [...codes];
}

export function ScheduleSummary() {
  const { mySections, toggleSection, getConflictsForSection } = useMySections();
  const { courses } = useMyCourses();
  const { data: coursesIndex = [] } = useCourses();
  const { data: allSections = [] } = useSections();
  const { plannedDisciplines: classifiedDisciplines } = usePlannedDisciplineCategories();
  const { getDisciplineStatus, setDisciplineStatus, clearDisciplineStatus } = useApp();
  const { currentTerm } = useCurrentTerm();
  const { pendingTransition, statusTerm, planningTerm, unresolvedCodes } = useSemesterTransition();
  const [selectedDiscipline, setSelectedDiscipline] = useState<Course | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<Set<string>>(new Set());

  const outcomeTerm = statusTerm || currentTerm;
  
  const coursesByCode = useMemo(() => new Map(courses.map((c) => [c.code, c])), [courses]);
  const coursesIndexByCode = useMemo(() => new Map(coursesIndex.map((c) => [c.code, c])), [coursesIndex]);
  const allProgramCourseCodesArray = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) set.add(c.code);
    for (const s of mySections) {
      const code = s.course?.code || (s as any).course_code;
      if (code) set.add(code);
    }
    return Array.from(set);
  }, [courses, mySections]);

  // Fetch details for all involved courses to find equivalences
  const allCourseDetails = useQueries({
    queries: allProgramCourseCodesArray.map(code => ({
      queryKey: ['course-by-code', code],
      queryFn: () => fetchCourseByCode(code),
      enabled: !!code,
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
    })),
  });

  // Get all equivalent codes for a given code (bidirectional)
  const getEquivalentCodesFor = useCallback((code: string): string[] => {
    const set = new Set<string>();
    const baseCode = getBlockCourseBaseCode(code);
    for (const result of allCourseDetails) {
      const detail = result.data;
      if (!detail?.equivalences || !detail?.code) continue;
      const courseBase = getBlockCourseBaseCode(detail.code);
      let isRelated = courseBase === baseCode;
      const eqBaseCodes = new Set<string>();
      for (const eqGroup of detail.equivalences) {
        for (const eq of eqGroup) {
          const eqCode = (eq as any).code;
          if (!eqCode) continue;
          const eqBase = getBlockCourseBaseCode(eqCode);
          eqBaseCodes.add(eqBase);
          if (eqBase === baseCode) isRelated = true;
        }
      }
      if (isRelated) {
        // Add this course's code
        set.add(detail.code);
        // Add all codes from courses that match any eqBase
        for (const eqBase of eqBaseCodes) {
          for (const c of courses) {
            if (getBlockCourseBaseCode(c.code) === eqBase) {
              set.add(c.code);
            }
          }
          for (const s of mySections) {
            const sCode = s.course?.code || (s as any).course_code;
            if (sCode && getBlockCourseBaseCode(sCode) === eqBase) {
              set.add(sCode);
            }
          }
          if (getBlockCourseBaseCode(code) === eqBase) {
            set.add(code);
          }
        }
      }
    }
    return Array.from(set);
  }, [allCourseDetails, courses, mySections]);
  
  // Group sections by base course code
  const groupedSections = useMemo(() => {
    const groups = new Map<string, Section[]>();
    for (const s of mySections) {
      const code = s.course?.code || (s as { course_code?: string }).course_code;
      if (code) {
        const baseCode = getBlockCourseBaseCode(code);
        const existing = groups.get(baseCode) || [];
        existing.push(s);
        groups.set(baseCode, existing);
      }
    }
    return groups;
  }, [mySections]);

  // Compute conflicts between selected sections, grouped by base course code
  const conflictsByBaseCode = useMemo(() => {
    const conflictsMap = new Map<string, Set<string>>();

    for (let i = 0; i < mySections.length; i++) {
      const sectionA = mySections[i];
      const codeA = sectionA.course?.code || (sectionA as any)?.course_code;
      if (!codeA) continue;
      const baseA = getBlockCourseBaseCode(codeA);

      for (let j = i + 1; j < mySections.length; j++) {
        const sectionB = mySections[j];
        const codeB = sectionB.course?.code || (sectionB as any)?.course_code;
        if (!codeB) continue;
        const baseB = getBlockCourseBaseCode(codeB);

        if (baseA === baseB) continue;

        const conflicts = getConflictsForSection(sectionA);
        const hasConflict = conflicts.some(c => c.section.id_ref === sectionB.id_ref);

        if (hasConflict) {
          if (!conflictsMap.has(baseA)) conflictsMap.set(baseA, new Set());
          conflictsMap.get(baseA)!.add(baseB);

          if (!conflictsMap.has(baseB)) conflictsMap.set(baseB, new Set());
          conflictsMap.get(baseB)!.add(baseA);
        }
      }
    }

    return conflictsMap;
  }, [mySections, getConflictsForSection]);

  if (mySections.length === 0) {
    return null;
  }

  const handleStatusClick = (codes: string[], status: DisciplineStatus) => {
    // Collect all codes + their equivalents
    const allCodes = new Set<string>();
    codes.forEach(code => {
      allCodes.add(code);
      getEquivalentCodesFor(code).forEach(c => allCodes.add(c));
    });
    Array.from(allCodes).forEach(code => {
      const current = getDisciplineStatus(code);
      if (current === status) {
        clearDisciplineStatus(code, outcomeTerm || undefined);
      } else {
        setDisciplineStatus(code, status, outcomeTerm || undefined);
      }
    });
  };

  const toggleStatusExpanded = (key: string) => {
    setExpandedStatus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4 border-t-2 border-foreground pt-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[22px] font-black tracking-[-0.035em] text-foreground sm:text-[26px]">Minhas turmas</h3>
          {(pendingTransition ? planningTerm : currentTerm) && (
            <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">
              {pendingTransition ? planningTerm : currentTerm}
            </span>
          )}
        </div>
        <button
          onClick={() => mySections.forEach((s) => toggleSection(s, allSections))}
          className="h-10 shrink-0 rounded-full px-3 text-[13px] font-extrabold text-pitanga transition-colors hover:bg-pitanga-tint"
        >
          Limpar
        </button>
      </div>

      {pendingTransition && (
        <div className="rounded-2xl bg-dende-claro px-4 py-3 text-[13px] font-medium text-dende-ink">
          Semestre <strong>{currentTerm}</strong> disponível. Finalize as {unresolvedCodes.length} disciplina{unresolvedCodes.length !== 1 ? 's' : ''} pendente{unresolvedCodes.length !== 1 ? 's' : ''} abaixo para avançar.
        </div>
      )}

      <div className="space-y-2.5">
        {[...groupedSections.entries()].map(([baseCode, sections]) => {
          const disciplineCodes = sections.map(s => 
            s.course?.code || (s as { course_code?: string }).course_code || ''
          );
          const disciplineName = resolveBlockCourseName(
            disciplineCodes[0],
            coursesIndexByCode,
            coursesByCode.get(baseCode)?.name ?? coursesByCode.get(disciplineCodes[0])?.name ?? baseCode
          );
          const cardKey = baseCode;
          
          // Get the status from any of the codes (they should all be the same)
          const currentStatus = disciplineCodes.reduce((acc, code) => 
            acc || getDisciplineStatus(code), 
            undefined as DisciplineStatus | undefined
          );
          const isUnresolved = pendingTransition && !currentStatus;
          const isStatusExpanded = expandedStatus.has(cardKey) || isUnresolved;
          
          // Get the course (try base code first, then the first code in the group)
          const course = courses?.find((c) => c.code === baseCode) || 
                         courses?.find((c) => c.code === disciplineCodes[0]);
          const workload = (course as any)?.workload;
          
          // Get all conflicts from conflictsByBaseCode
          const conflictBaseCodes = conflictsByBaseCode.get(baseCode) || new Set<string>();
          const conflictCodes = Array.from(conflictBaseCodes);

          return (
            <div
              key={cardKey}
              className={cn(
                'overflow-hidden rounded-[18px] border-[1.5px] bg-background',
                currentStatus === 'approved' && 'border-mar/30 bg-mar-claro',
                currentStatus === 'failed' && 'border-pitanga/30 bg-pitanga-tint/40',
                currentStatus === 'dropped' && 'border-foreground/15 bg-nevoa',
                !currentStatus && 'border-foreground/10'
              )}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[13px] font-semibold text-mar">{baseCode}</span>
                      {workload && (
                        <span className="font-mono text-[11px] text-muted-foreground">{workload}h</span>
                      )}
                      {(() => {
                        const info = classifiedDisciplines.find((p) => p.baseCode === baseCode);
                        if (!info) return null;
                        if (info.isEquivalent) {
                          return (
                            <span className="rounded-full bg-nevoa px-2.5 py-[3px] text-[11px] font-extrabold text-foreground-2">
                              Equivalente
                            </span>
                          );
                        }
                        if (info.category === 'mandatory') {
                          return (
                            <span className="rounded-full bg-mar-tint px-2.5 py-[3px] text-[11px] font-extrabold text-mar-ink">
                              Obrigatória
                            </span>
                          );
                        }
                        if (info.category === 'elective') {
                          return (
                            <span className="rounded-full bg-dende-tint px-2.5 py-[3px] text-[11px] font-extrabold text-dende-ink">
                              Optativa
                            </span>
                          );
                        }
                        return (
                          <span className="rounded-full bg-trilho px-2.5 py-[3px] text-[11px] font-extrabold text-foreground-2">
                            Ofertada
                          </span>
                        );
                      })()}
                    </div>
                    <p className="mt-1.5 text-[15px] font-extrabold leading-snug text-foreground sm:text-[17px]">
                      {disciplineName}
                    </p>

                    <div className="mt-3 space-y-3">
                      {sections.map((s, sectionIdx) => {
                        const disciplineCode = s.course?.code || (s as { course_code?: string }).course_code || '';
                        const classCode = (s as { section_code?: string }).section_code || s.id_ref;
                        const variantLabel = getBlockCourseVariantLabel(disciplineCode, coursesByCode);
                        const teachers = Array.isArray(s.teachers) ? s.teachers : [];
                        const timeCodes = Array.isArray(s.time_codes) ? s.time_codes : [];
                        const formattedSchedules = formatTimeCodes(timeCodes);
                        
                        return (
                          <div key={`${disciplineCode}-${classCode}`} className="border-t border-foreground/10 pt-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {isBlockCourseCode(disciplineCode) && (
                                    <span className="rounded-full bg-nevoa px-2.5 py-[3px] text-[11px] font-extrabold text-foreground">
                                      {variantLabel}
                                    </span>
                                  )}
                                  <span className="font-mono text-[11.5px] text-muted-foreground">
                                    {disciplineCode} · Turma {classCode}
                                  </span>
                                </div>

                                <div className="mt-2 space-y-1.5">
                                  <div className="flex items-start gap-2 text-[13px] font-semibold text-foreground-2">
                                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span className="break-words">{teachers.length > 0 ? teachers.join(', ') : 'Professor(es) a definir'}</span>
                                  </div>
                                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <Clock className="hidden h-3.5 w-3.5 shrink-0" />
                                    {formattedSchedules.length > 0 ? (
                                        <div className="flex w-full flex-wrap gap-2">
                                          {formattedSchedules.map((schedule, idx) => {
                                            const [day, time] = schedule.split(' ');
                                            return (
                                              <span key={idx} className="flex min-w-0 items-baseline gap-2 rounded-xl bg-nevoa px-3 py-2 text-foreground">
                                                <span className="truncate text-[11px] font-black uppercase tracking-[0.1em]">{day}</span>
                                                <span className="truncate font-mono text-[12.5px] font-semibold">{time}</span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                      <span>Horário a definir</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <button
                                  onClick={() => { if (course) setSelectedDiscipline(course as Course); }}
                                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-nevoa hover:text-foreground"
                                  aria-label="Mais informações"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => toggleSection(s, allSections)}
                                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-pitanga-tint hover:text-pitanga"
                                  aria-label="Remover turma"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {conflictCodes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {conflictCodes.map((code) => {
                          const conflictingCourse = coursesIndexByCode.get(code) || coursesByCode.get(code);
                          const conflictingName = conflictingCourse?.name || code;
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1.5 rounded-full bg-pitanga-tint px-2.5 py-1 text-[11px] font-extrabold text-pitanga-ink"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Choque com {code} {conflictingName !== code ? `— ${conflictingName}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resultado da disciplina — recolhível */}
              <div className="border-t border-foreground/10">
                <button
                  type="button"
                  onClick={() => toggleStatusExpanded(cardKey)}
                  className="flex min-h-[48px] w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.03] sm:px-5"
                >
                  <span className="text-[13px] font-extrabold text-foreground">
                    Resultado da disciplina
                    {currentStatus && (
                      <span className="ml-1.5 font-semibold text-foreground-2">
                        — {STATUS_CONFIG[currentStatus].label}
                      </span>
                    )}
                  </span>
                  {isStatusExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isStatusExpanded && (
                  <div className="px-4 pb-4 sm:px-5">
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(STATUS_CONFIG) as [DisciplineStatus, typeof STATUS_CONFIG[DisciplineStatus]][]).map(
                        ([status, config]) => {
                          const Icon = config.icon;
                          const isActive = currentStatus === status;
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusClick(disciplineCodes, status)}
                              className={cn(
                                'inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-[1.5px] px-4 text-[13px] font-bold transition-all',
                                isActive ? config.activeClass : 'border-foreground/20 bg-background text-foreground hover:bg-nevoa'
                              )}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{config.label}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDiscipline && (
        <DisciplineDetail
          discipline={selectedDiscipline}
          onClose={() => setSelectedDiscipline(null)}
        />
      )}
    </div>
  );
}
