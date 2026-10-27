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
import { formatTimeCodes, parseTimeCodes } from '@/lib/schedule';
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

  // Horários agrupados por dia: "SEG 14:50 · 15:45"
  const DIA_CURTO: Record<string, string> = { Segunda: 'SEG', 'Terça': 'TER', Quarta: 'QUA', Quinta: 'QUI', Sexta: 'SEX', 'Sábado': 'SÁB' };
  const horariosPorDia = (() => {
    const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
    const mapa = new Map<string, string[]>();
    for (const h of parseTimeCodes(timeCodes)) {
      const lista = mapa.get(h.dia) ?? [];
      if (!lista.includes(h.horarioInicio)) lista.push(h.horarioInicio);
      mapa.set(h.dia, lista);
    }
    return Array.from(mapa.entries()).map(([dia, inicios]) => ({ dia: DIA_CURTO[dia] ?? dia, horas: inicios.sort().join(' · ') }));
  })();

  const courseCode = section.course?.code;
  const isCompletedCourse = courseCode ? completedDisciplines.includes(courseCode) : false;
  const showSwap = !!courseCode && hasSectionOnCourse(courseCode);

  return (
    <div className={cn('flex flex-col gap-2.5 border-t border-foreground/10 py-4', isAdded && '-mx-3 rounded-2xl border-t-0 bg-mar-claro px-3')}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[14.5px] font-extrabold uppercase leading-[1.3] text-foreground">
            {teachers && teachers.length > 0 ? teachers[0] : `Turma ${section.id_ref}`}
            {teachers && teachers.length > 1 && (
              <span className="ml-1.5 text-xs font-semibold normal-case text-foreground-2">
                + {teachers.length - 1} professor{teachers.length - 1 > 1 ? 'es' : ''}
              </span>
            )}
          </span>
          {(!teachers || teachers.length === 0) && (
            <span className="text-xs font-semibold text-foreground-2">Professor(es) a definir</span>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {isFull && (
              <span className="rounded-full bg-pitanga px-2.5 py-[3px] text-[11px] font-extrabold text-white">Lotada</span>
            )}
            {isAdded && (
              <span className="rounded-full bg-mar px-2.5 py-[3px] text-[11px] font-extrabold text-white">Na grade</span>
            )}
            {!isFull && isAlmostFull && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-dende-tint px-2.5 py-[3px] text-[11px] font-extrabold text-dende-ink">
                      <Flame className="h-3 w-3" /> Poucas vagas
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>Restam poucas vagas disponíveis nesta turma.</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {hasExclusive && reservedRemaining > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default items-center gap-[5px] rounded-full bg-mar-tint px-2.5 py-[3px] text-[11px] font-extrabold text-mar-ink">
                      <Star className="h-[11px] w-[11px] fill-current" /> Reservado para o curso · {reservedRemaining} vagas
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div>Vagas reservadas ao(s) seu(s) programa(s) selecionado(s).</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!hasExclusive && (
              <span className="inline-flex items-center rounded-full bg-nevoa px-2.5 py-[3px] text-[11px] font-extrabold text-foreground-2">
                Sem reservas para o curso
              </span>
            )}
          </div>

          {!isFull && conflicts.length > 0 && (
            (() => {
              const currentCourseCode = section.course?.code;
              const uniqueCodes = Array.from(new Set(
                conflicts
                  .map((c) => c.section.course?.code)
                  .filter((code): code is string => Boolean(code) && code !== currentCourseCode)
              ));
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  {uniqueCodes.map((code) => {
                    const name = coursesByCode.get(code) || code;
                    return (
                      <button
                        key={`conf-${code}`}
                        onClick={() => onNavigateCourse?.(code)}
                        className="inline-flex items-center gap-1 rounded-full bg-pitanga-tint px-2.5 py-[3px] text-left text-[11px] font-extrabold text-pitanga-ink transition-all hover:bg-pitanga hover:text-white"
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Choque com {code} — {name}
                      </button>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        {!isCompletedCourse && !isFull && (
          isAdded ? (
            <button
              onClick={() => onAdd(section)}
              aria-label="Remover turma da grade"
              title="Remover da grade"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pitanga text-white transition-colors hover:bg-pitanga/90"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          ) : showSwap || conflicts.length > 0 ? (
            <button
              onClick={() => onAdd(section)}
              aria-label="Trocar pela turma atual"
              title="Trocar turma"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dende text-foreground transition-colors hover:bg-dende/90 dark:text-background"
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          ) : (
            <button
              onClick={() => onAdd(section)}
              aria-label={`Adicionar turma de ${teachers?.[0] ?? section.id_ref}`}
              title="Adicionar à grade"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />
            </button>
          )
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {horariosPorDia.length > 0 ? (
          horariosPorDia.map((h) => (
            <span key={h.dia} className="flex items-baseline gap-2 rounded-xl bg-nevoa px-3 py-2">
              <span className="text-[11px] font-black tracking-[0.1em] text-foreground">{h.dia}</span>
              <span className="font-mono text-[12.5px] font-semibold text-foreground">{h.horas}</span>
            </span>
          ))
        ) : (
          <span className="rounded-xl bg-nevoa px-3 py-2 font-mono text-xs text-foreground-2">Horário a definir</span>
        )}
      </div>
    </div>
  );
}
