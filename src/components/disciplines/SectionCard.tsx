import { AlertCircle, Clock, Plus, Users, Eraser, ArrowLeftRight, AlertTriangle, Star, Flame, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Section } from '@/services/api';
import { useMySections } from '@/hooks/useMySections';
import { useApp } from '@/contexts/AppContext';
import { getCompetitionLevel, getPhase1Level, getPhase2Level } from '@/lib/competition';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { Progress } from '@/components/ui/progress';
import { getReservedUnfilledBonus, getReservedUnfilledForTitles } from '@/lib/utils';
import { formatTimeCodes } from '@/lib/schedule';
import { useCourses } from '@/hooks/useApi';

interface SectionCardProps {
  section: Section;
  isAdded: boolean;
  onAdd: (section: Section) => void;
  onNavigateCourse?: (courseCode: string) => void;
}

export function SectionCard({ section, isAdded, onAdd, onNavigateCourse }: SectionCardProps) {
  const { hasSectionOnCourse, getConflictsForSection } = useMySections();
  const { completedDisciplines } = useApp();
  const { data: coursesIndex = [] } = useCourses();
  const seatsCount = section.seats_count;
  const seatsAccepted = section.seats_accepted;
  const available = seatsCount - seatsAccepted;
  const isFull = available <= 0;
  const isAlmostFull = available > 0 && available <= 5;
  const seatsRequested = (section as any)?.seats_requested ?? 0;
  const seatsRerequested = (section as any)?.seats_rerequested ?? 0;
  const competition = getCompetitionLevel(seatsCount, seatsRequested, seatsRerequested);
  const compPhase1 = getPhase1Level(seatsCount, seatsRequested);
  const compPhase2 = getPhase2Level(seatsCount, seatsAccepted, seatsRerequested);
  const { myPrograms } = useMyPrograms();
  const myProgramTitles = new Set(myPrograms.map(p => (p.title || '').trim().toLowerCase()));
  const hasExclusive = Array.isArray(section.spots_reserved) && section.spots_reserved.some(r => {
    const t = ((r as any)?.program?.title || '').trim().toLowerCase();
    return t && myProgramTitles.has(t);
  });
  const reservedRemaining = getReservedUnfilledForTitles(section, myProgramTitles);

  const teachers = section.teachers ?? []

  // Compute time conflicts via helper
  const conflicts = getConflictsForSection(section);
  
  // Create a map of course codes to names for quick lookup
  const coursesByCode = new Map(coursesIndex.map(c => [c.code, c.name]));

  return (
    <div
      className={cn(
        'rounded-[18px] border-[1.5px] p-4 transition-all',
        isFull
          ? 'border-transparent bg-pitanga-tint'
          : isAlmostFull
          ? 'border-transparent bg-dende-claro'
          : isAdded
          ? 'border-mar bg-mar-claro'
          : 'border-foreground/10 bg-background',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-extrabold uppercase text-foreground">
              {teachers && teachers.length > 0
                ? teachers[0]
                : `Turma ${section.id_ref}`}
            </span>
          </div>

          {/* Tags always below the title (no 'Adicionar' tag) */}
          <div className="mb-2 flex flex-wrap gap-1 items-center">
            {isFull && (
              <span className="rounded-full bg-pitanga px-2.5 py-0.5 text-[11px] font-bold text-white">
                Lotada
              </span>
            )}
            {isAdded && (
              <span className="rounded-full bg-mar px-2.5 py-0.5 text-[11px] font-bold text-white">
                Adicionada
              </span>
            )}
            {/* Conflito */}
            {!isFull && conflicts.length > 0 && (
              (() => {
                const currentCourseCode = section.course?.code;
                const uniqueCodes = Array.from(new Set(
                  conflicts
                    .map((c) => c.section.course?.code)
                    .filter((code): code is string => Boolean(code) && code !== currentCourseCode)
                ));
                return (
                  <div className="flex flex-wrap gap-1 items-center">
                    {uniqueCodes.map((code) => {
                      const name = coursesByCode.get(code) || code;
                      return (
                        <button
                          key={`conf-${code}`}
                          onClick={() => onNavigateCourse?.(code)}
                          className="inline-flex items-center gap-1 rounded-full bg-pitanga-tint px-2.5 py-0.5 text-[11px] font-bold text-pitanga-ink transition-all hover:bg-pitanga hover:text-white"
                        >
                          <AlertTriangle className="w-3 h-3" /> Choque com {code} — {name}
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}
            {/* Poucas Vagas */}
            {!isFull && isAlmostFull && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-dende px-2.5 py-0.5 text-[11px] font-bold text-white">
                      <Flame className="w-3 h-3" /> Poucas Vagas
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>Restam poucas vagas disponíveis nesta turma.</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Reservado */}
            {hasExclusive && reservedRemaining > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                      <Star className="w-3 h-3" /> Reservado para o curso {reservedRemaining} vagas
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>Vagas reservadas ao(s) seu(s) programa(s) selecionado(s).</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Sem reservas */}
            {!hasExclusive && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-nevoa px-2.5 py-0.5 text-[11px] font-bold text-foreground-2">
                      Sem reservas para o curso
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>Esta turma não possui vagas reservadas para o seu curso.</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {(() => {
            if (teachers && teachers.length > 1) {
              const extra = teachers.length - 1;
              return (
                <div className="mb-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="truncate block">+ {extra} professor{extra > 1 ? 'es' : ''}</span>
                  </div>
                </div>
              );
            }
            if (!teachers || teachers.length === 0) {
              return (
                <div className="mb-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="truncate block">Professor(es) a definir</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="mt-2 border-t border-foreground/10 pt-2.5">
            <div className="space-y-2">
              <div className="flex items-start gap-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                {(() => {
                  const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
                  const formattedSchedules = formatTimeCodes(timeCodes);
                  return (
                    <div className="grid gap-1" style={{ gridTemplateColumns: formattedSchedules.length <= 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                      {formattedSchedules.length > 0 ? (
                        formattedSchedules.map((h, i) => {
                          const [day, time] = h.split(' ');
                          return (
                            <span key={i} className="flex min-h-[44px] flex-col items-center justify-center rounded-xl bg-nevoa px-2 py-1 text-center font-mono text-xs">
                              <span className="font-sans text-[11px] font-extrabold uppercase">{day}</span>
                              <span className="text-[10px]">{time}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs">Horário a definir</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {(() => {
          const courseCode = section.course?.code;
          const isCompleted = courseCode ? completedDisciplines.includes(courseCode) : false;
          if (isCompleted || isFull) return null;
          return (
        <div className="flex items-center gap-2">
          {isAdded ? (
            <button
              onClick={() => onAdd(section)}
              className={cn(
                'flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all',
                'bg-pitanga text-white hover:bg-pitanga/90'
              )}
            >
              <Eraser className="w-4 h-4" />
              <span className="hidden sm:inline">Remover</span>
            </button>
          ) : (() => {
            const code = section.course?.code as string | undefined;
            const showSwap = !!code && hasSectionOnCourse(code);
            return showSwap ? (
              <button
                onClick={() => onAdd(section)}
                disabled={isFull}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all',
                  isFull
                    ? 'cursor-not-allowed bg-nevoa text-muted-foreground'
                    : 'bg-dende text-white hover:bg-dende/90',
                )}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="hidden sm:inline">Trocar</span>
              </button>
            ) : (
              <button
                onClick={() => onAdd(section)}
                disabled={isFull}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all',
                  isFull
                    ? 'cursor-not-allowed bg-nevoa text-muted-foreground'
                    : conflicts.length > 0
                      ? 'bg-dende text-white hover:bg-dende/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {conflicts.length > 0 ? (
                  <ArrowLeftRight className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{conflicts.length > 0 ? 'Trocar' : 'Adicionar'}</span>
              </button>
            );
          })()}
        </div>
          );
        })()}
      </div>

      {false}
    </div>
  );
}
