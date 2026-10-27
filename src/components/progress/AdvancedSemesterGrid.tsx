import { InfoPopup } from '@/components/ui/info-popup';
import { X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { SemestreCirculo } from '@/components/brand/Mare';

interface SemesterData {
  semester: number;
  totalMandatory: number;
  completedMandatory: number;
  percentage: number;
  disciplines: {
    code: string;
    name: string;
    completed: boolean;
    enrolled: boolean;
  }[];
}

interface AdvancedSemesterGridProps {
  courses: any[];
  completedDisciplines: string[];
  enrolledCodes?: string[];
  courseLevels: string[];
  currentTerm?: string | null;
  showInfo?: boolean;
  infoText?: string;
  /** Percentual das optativas, mostrado como a última célula ("Optativos") */
  optativasPct?: number;
  /** Quando a seção já está dentro de outra com linha de abertura */
  embutido?: boolean;
}

function SemesterDetailContent({
  semester,
  levelName,
  hideTitle = false,
}: {
  semester: SemesterData;
  levelName: string;
  hideTitle?: boolean;
}) {
  return (
    <div className="text-xs space-y-2">
      {!hideTitle && <div className="font-medium text-sm">{levelName}</div>}
      <div className="text-muted-foreground">
        {semester.completedMandatory}/{semester.totalMandatory} disciplinas obrigatórias
      </div>
      <div className="font-bold text-foreground">{semester.percentage}% completo</div>
      <div className="border-t border-border pt-2">
        <div className="font-medium mb-2 text-foreground">Status das disciplinas</div>
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
          {semester.disciplines.map((d) => (
            <div key={d.code} className="flex items-start gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                  d.completed ? 'bg-mar' : d.enrolled ? 'bg-dende' : 'bg-trilho'
                }`}
              />
              <div className="min-w-0">
                <span className="font-medium text-foreground">{d.code}</span>
                <span className="text-muted-foreground"> — {d.name}</span>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {d.completed ? 'Cursado' : d.enrolled ? 'Planejado' : 'Não feito'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdvancedSemesterGrid({
  courses,
  completedDisciplines,
  enrolledCodes = [],
  courseLevels,
  currentTerm,
  showInfo = false,
  infoText = '',
  optativasPct,
  embutido = false,
}: AdvancedSemesterGridProps) {
  const isMobile = useIsMobile();
  const [selectedSemester, setSelectedSemester] = useState<SemesterData | null>(null);

  const disciplinesBySemester = useMemo(() => {
    const semesterMap = new Map<number, SemesterData>();

    courseLevels.forEach((level, index) => {
      const semesterNumber = index + 1;
      semesterMap.set(semesterNumber, {
        semester: semesterNumber,
        totalMandatory: 0,
        completedMandatory: 0,
        percentage: 0,
        disciplines: [],
      });
    });

    if (courses && Array.isArray(courses)) {
      courses.forEach((course) => {
        if (course.type === 'OPT' || course.type === 'OPTATIVO') {
          return;
        }

        const semesterIndex = courseLevels.findIndex((level) => level === course.level);
        if (semesterIndex === -1) return;

        const semester = semesterIndex + 1;
        const semesterData = semesterMap.get(semester);
        if (!semesterData) return;

        const isEnrolled = enrolledCodes.includes(course.code);
        const isCompleted = completedDisciplines && completedDisciplines.includes(course.code);

        semesterData.totalMandatory++;
        if (isCompleted) {
          semesterData.completedMandatory++;
        }

        semesterData.disciplines.push({
          code: course.code,
          name: course.name,
          completed: isCompleted,
          enrolled: isEnrolled,
        });
      });
    }

    semesterMap.forEach((data) => {
      data.percentage =
        data.totalMandatory > 0
          ? Math.round((data.completedMandatory / data.totalMandatory) * 100)
          : 0;
    });

    return semesterMap;
  }, [courses, completedDisciplines, courseLevels, enrolledCodes]);

  const semesterArray = Array.from(disciplinesBySemester.values()).sort(
    (a, b) => a.semester - b.semester
  );

  const getColorByPercentage = (percentage: number): string => {
    if (percentage === 100) return 'bg-green-500 text-white';
    if (percentage >= 75) return 'bg-green-400 text-white';
    if (percentage >= 50) return 'bg-yellow-400 text-white';
    if (percentage >= 25) return 'bg-orange-400 text-white';
    if (percentage > 0) return 'bg-red-400 text-white';
    return 'bg-muted text-muted-foreground';
  };

  const getBorderColorByPercentage = (percentage: number): string => {
    if (percentage === 100) return 'border-green-500';
    if (percentage >= 75) return 'border-green-400';
    if (percentage >= 50) return 'border-yellow-400';
    if (percentage >= 25) return 'border-orange-400';
    if (percentage > 0) return 'border-red-400';
    return 'border-border';
  };

  const getLevelName = (semesterNumber: number) =>
    courseLevels[semesterNumber - 1] || `${semesterNumber}º Semestre`;

  const rotuloPct = (p: number) => (p > 0 && p < 100 ? `${p}%` : null);

  const renderSemesterCell = (semester: SemesterData) => (
    <button
      type="button"
      onClick={() => setSelectedSemester(semester)}
      aria-label={`${semester.semester}º semestre, ${semester.percentage}%`}
      className="flex flex-col items-center gap-2 py-1 outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-mar sm:border-b sm:border-r sm:border-foreground/10 sm:px-2 sm:py-4 sm:hover:scale-100 sm:hover:bg-nevoa/60"
    >
      <SemestreCirculo percent={semester.percentage} size={isMobile ? 44 : 56} />
      <span className="flex flex-col items-center gap-1 sm:gap-1.5">
        <span className="text-[13px] font-black text-foreground sm:text-[15px]">
          {semester.semester}º
          {isMobile && rotuloPct(semester.percentage) && (
            <span className="ml-1 font-mono text-[10px] font-medium text-muted-foreground">{rotuloPct(semester.percentage)}</span>
          )}
        </span>
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">{semester.percentage}%</span>
      </span>
    </button>
  );

  if (courseLevels.length === 0) {
    return (
      <div className="border-t-2 border-foreground pt-5">
        <div className="text-center py-4 text-xs text-muted-foreground">
          Nenhuma informação de semestres encontrada para este curso
        </div>
      </div>
    );
  }

  const selectedLevelName = selectedSemester
    ? getLevelName(selectedSemester.semester)
    : '';

  return (
    <>
      <div className={embutido ? 'flex flex-col gap-4' : 'flex flex-col gap-4 border-t-2 border-foreground pt-5'}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-[-0.03em] text-foreground lg:text-2xl">
              Por semestre<span className="hidden lg:inline"> do curso</span>
            </h2>
            {showInfo && <InfoPopup iconClassName="w-3.5 h-3.5" content={infoText} />}
          </span>
          {semesterArray.length > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {semesterArray.filter((s) => s.percentage === 100).length} de {semesterArray.length} completos
            </span>
          )}
        </div>
        <p className="hidden text-[13px] leading-relaxed text-foreground-2 sm:block">
          O nível do mar mostra quanto de cada semestre já foi concluído. Toque em um semestre para ver as disciplinas.
        </p>

        <div className="grid grid-cols-5 gap-x-1 gap-y-4 sm:gap-0 sm:border-l sm:border-t sm:border-foreground/10">
          {semesterArray.map((semester) => (
            <div key={semester.semester} className="contents">
              {renderSemesterCell(semester)}
            </div>
          ))}
          {typeof optativasPct === 'number' && (
            <div
              className="flex flex-col items-center gap-2 py-1 sm:justify-center sm:border-b sm:border-r sm:border-foreground/10 sm:px-2 sm:py-4"
              aria-label={`Optativos, ${Math.round(optativasPct)}%`}
            >
              <SemestreCirculo percent={Math.round(optativasPct)} size={isMobile ? 44 : 56} />
              <span className="flex flex-col items-center gap-1 sm:gap-1.5">
                <span className="text-[13px] font-black text-foreground">
                  <span className="sm:hidden">Opt.</span>
                  <span className="hidden sm:inline">Optativos</span>
                </span>
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                  {optativasPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
              </span>
            </div>
          )}
        </div>

        {semesterArray.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Nenhuma disciplina obrigatória encontrada para os semestres deste curso
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedSemester && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
            onClick={() => setSelectedSemester(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background px-6 pb-7 pt-5 sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[24px] font-black tracking-[-0.03em] text-foreground">
                    {selectedSemester.semester}º Semestre
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedLevelName}</p>
                </div>
                <button
                  onClick={() => setSelectedSemester(null)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SemesterDetailContent
                semester={selectedSemester}
                levelName={selectedLevelName}
                hideTitle
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
