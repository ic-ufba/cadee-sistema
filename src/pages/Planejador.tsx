import { useState, useMemo, useRef, memo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ScheduleGrid } from '@/components/planner/ScheduleGrid';
import {
  AbasGrades,
  AcoesGrade,
  BotaoComparar,
  ChoquesDaGrade,
  CompararGrades,
  SeletorVisaoSemana,
  lerVisaoSemana,
  salvarVisaoSemana,
  type VisaoSemana,
} from '@/components/planner/MinhasGrades';
import { chocaCom, codigoDaTurma, encontrarChoques, ROTULO_DIA } from '@/lib/choques';
import { SigaaAcoesPlanejador, SigaaResultadoPlanejador, type PainelSigaa } from '@/components/sigaa/SigaaPlanejador';
import { mapaDeCores } from '@/lib/grade-cores';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useApp } from '@/contexts/AppContext';
import { Course, Section } from '@/services/api';
import { Clock, Users, Plus, BadgeInfo, AlertTriangle, AlertCircle, Star, Flame, Trash2, BookOpen, GraduationCap, School, Filter, X, Calendar, CheckCircle, Eye, Search, Loader2, Layers } from 'lucide-react';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { cn, getReservedUnfilledBonus, getReservedUnfilledForTitles } from '@/lib/utils';
import { useMyCourses } from "@/hooks/useMyCourses.ts";
import { useMySections } from '@/hooks/useMySections';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { buildCurrentTermSectionIndex, filterSectionsByCurrentTerm, mergeProgramCoursesWithOffered } from '@/lib/semester';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCourseSections, usePrograms, useProgramDetail, useCourseByCode, useCourses, useSections } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getSpplitedCode } from '@/lib/schedule';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueries } from '@tanstack/react-query';
import { fetchProgramDetail } from '@/services/api';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { ChevronDown, ChevronUp, ChevronRight, Check } from 'lucide-react';
import { getBlockCourseBaseCode, getBlockCourseVariantLabel, groupDisciplinesByBlock, isBlockCourseCode, resolveBlockCourseName } from '@/lib/blockCourses';
import { isCurriculumElective, isCurriculumMandatory, usePlannedDisciplineCategories } from '@/hooks/usePlannedDisciplineCategories';
import { tituloCurso } from '@/lib/curso-texto';

type DisciplineGroup = ReturnType<typeof groupDisciplinesByBlock>[number];

const diasSemana = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const mapSiglaParaNome = {
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado"
};
const horariosGrade = [
  "07:00", "07:55", "08:50", "09:45", "10:40", "11:35", "13:00", "13:55", 
  "14:50", "15:45", "16:40", "17:35", "18:30", "19:25", "20:20", "21:15"
];

// Helper síncrono para buscar códigos equivalentes persistidos
export const getEquivalentCodesSync = (code: string): string[] => {
  const base = getBlockCourseBaseCode(code);
  const out = new Set<string>([base]);
  try {
    const persisted = JSON.parse(localStorage.getItem('cadee_equivalences') || '{}') as Record<string, string[]>;
    if (persisted[base]) {
      persisted[base].forEach((eq) => out.add(getBlockCourseBaseCode(eq)));
    }
    for (const [key, eqs] of Object.entries(persisted)) {
      if (eqs.some((eq) => getBlockCourseBaseCode(eq) === base)) {
        out.add(getBlockCourseBaseCode(key));
      }
    }
  } catch {}
  return Array.from(out);
};

export type DisciplineBadgeType = 'mandatory' | 'elective' | 'equivalent' | 'offered';

export function getDisciplineBadge(
  code: string,
  courseLevel?: string,
  courseType?: string,
  curriculumMandatorySet?: Set<string>,
  curriculumElectiveSet?: Set<string>,
  getEquivalentCodes: (code: string) => string[] = getEquivalentCodesSync
): { label: string; type: DisciplineBadgeType } {
  const baseCode = getBlockCourseBaseCode(code);

  // 1. Checagem direta se é obrigatória no currículo
  if (curriculumMandatorySet?.has(baseCode)) {
    return { label: 'Obrigatória', type: 'mandatory' };
  }
  // 2. Checagem direta se é optativa no currículo
  if (curriculumElectiveSet?.has(baseCode)) {
    return { label: 'Optativa', type: 'elective' };
  }

  // 3. Checagem direta do metadata do curso (caso não esteja marcado como ofertada)
  const isOfferedLevel = (courseLevel || '').includes('Ofertada');
  if (!isOfferedLevel) {
    const levelRaw = (courseLevel || '').toLowerCase();
    const typeRaw = (courseType || '').toUpperCase();
    if (typeRaw.includes('OPT') || levelRaw.includes('optat')) {
      return { label: 'Optativa', type: 'elective' };
    }
    if (levelRaw.includes('semestre') || typeRaw.includes('OBR')) {
      return { label: 'Obrigatória', type: 'mandatory' };
    }
  }

  // 4. Checagem por equivalência: equivale a alguma obrigatória ou optativa do currículo?
  if (curriculumMandatorySet || curriculumElectiveSet) {
    const equivalents = getEquivalentCodes(baseCode);
    for (const eq of equivalents) {
      if (eq === baseCode) continue;
      if (curriculumMandatorySet?.has(eq) || curriculumElectiveSet?.has(eq)) {
        return { label: 'Equivalente', type: 'equivalent' };
      }
    }
  }

  // 5. Caso contrário: Ofertada
  return { label: 'Ofertada', type: 'offered' };
}

// Função helper para parsear time_codes e converter para formato de horários
const parseTimeCodes = (timeCodes: string[]): Array<{ dia: string; horarioInicio: string; horarioFim: string }> => {
  const horarios: Array<{ dia: string; horarioInicio: string; horarioFim: string }> = [];
  
  const dayMap: Record<string, string> = {
    '2': 'Segunda',
    '3': 'Terça',
    '4': 'Quarta',
    '5': 'Quinta',
    '6': 'Sexta',
    '7': 'Sábado',
  };

  // Mapeamento de horários conforme especificação
  const horariosManha = ['07:00', '07:55', '08:50', '09:45', '10:40', '11:35'];
  const horariosTarde = ['13:00', '13:55', '14:50', '15:45', '16:40', '17:35'];
  const horariosNoite = ['18:30', '19:25', '20:20', '21:15'];

  for (const code of timeCodes) {
    const discreteCodes = getSpplitedCode(code);
    for (const discreteCode of discreteCodes) {
      const match = discreteCode.match(/^([2-7])([MTN])([1-6])$/i);
      if (!match) continue;
      
      const [, dayNum, shift, slotStr] = match;
      const day = dayMap[dayNum];
      const slot = parseInt(slotStr, 10) - 1; // Convert para 0-based index
      
      let horarioInicio: string;
      let horarioFim: string;
      
      if (shift === 'M') {
        // Manhã: 07:00-07:55, 07:55-08:50, etc.
        horarioInicio = horariosManha[slot];
        horarioFim = slot < horariosManha.length - 1 ? horariosManha[slot + 1] : '12:00';
      } else if (shift === 'T') {
        // Tarde: 13:00-13:55, 13:55-14:50, etc.
        horarioInicio = horariosTarde[slot];
        horarioFim = slot < horariosTarde.length - 1 ? horariosTarde[slot + 1] : '18:00';
      } else if (shift === 'N') {
        // Noite: 18:30-19:25, 19:25-20:20, etc.
        horarioInicio = horariosNoite[slot];
        horarioFim = slot < horariosNoite.length - 1 ? horariosNoite[slot + 1] : '22:00';
      } else {
        continue;
      }
      
      if (day && horarioInicio) {
        horarios.push({
          dia: day,
          horarioInicio,
          horarioFim
        });
      }
    }
  }

  return horarios;
};

// Componente memoizado para card de disciplina - otimiza performance
const DisciplineCard = memo(({ 
  course, 
  onClick,
  isSelected = false,
  conflictCodes = [],
  curriculumMandatorySet,
  curriculumElectiveSet,
  cor,
}: { 
  course: Course; 
  onClick: (course: Course) => void;
  cor?: string;
  isSelected?: boolean;
  conflictCodes?: string[];
  curriculumMandatorySet?: Set<string>;
  curriculumElectiveSet?: Set<string>;
}) => {
  const { completedDisciplines } = useApp();
  const isCompleted = completedDisciplines.includes(course.code);
  const badgeInfo = getDisciplineBadge(
    course.code,
    course.level,
    course.type,
    curriculumMandatorySet,
    curriculumElectiveSet,
    getEquivalentCodesSync
  );
  
  return (
    <div 
      key={course.code}
      data-discipline-code={course.code}
      onClick={() => onClick(course)}
      className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] py-3 pr-3.5 transition-colors ${
        isSelected ? 'border-foreground/15 bg-background pl-[18px] hover:border-foreground/30' : 'border-foreground/10 bg-background pl-3.5 hover:border-foreground/30'
      }`}
      style={isSelected && cor ? { boxShadow: `inset 5px 0 0 ${cor}` } : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-mar-ink">{course.code}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
              badgeInfo.type === 'mandatory' && "bg-mar-tint text-mar-ink",
              badgeInfo.type === 'elective' && "bg-dende-tint text-dende-ink",
              badgeInfo.type === 'equivalent' && "bg-trilho text-foreground",
              badgeInfo.type === 'offered' && "bg-trilho text-foreground-2"
            )}
          >
            {badgeInfo.label}
          </span>
          {isCompleted && (
            <span className="shrink-0 rounded-full bg-mar px-2 py-0.5 text-[10.5px] font-extrabold text-white">Cursada</span>
          )}
        </div>
        <div className="line-clamp-2 text-[13.5px] font-extrabold uppercase leading-tight text-foreground">
          {course.name}
        </div>
        {conflictCodes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {conflictCodes.map((code) => (
              <span key={code} className="rounded-full bg-pitanga-tint px-2 py-0.5 text-[10.5px] font-extrabold text-pitanga-ink">
                Choque com {code}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-foreground-2">
        {course.sections_count} turma{course.sections_count !== 1 ? 's' : ''}
        <ChevronRight className="h-4 w-4" />
      </span>
    </div>
  );
});

DisciplineCard.displayName = 'DisciplineCard';

const BlockDisciplineGroupCard = memo(({
  group,
  indexByCode,
  onCourseClick,
  isSelected = false,
  conflictCodes = [],
  curriculumMandatorySet,
  curriculumElectiveSet,
  cor,
}: {
  cor?: string;
  group: ReturnType<typeof groupDisciplinesByBlock>[number];
  indexByCode: Map<string, { name?: string }>;
  onCourseClick: (course: Course) => void;
  isSelected?: boolean;
  conflictCodes?: string[];
  curriculumMandatorySet?: Set<string>;
  curriculumElectiveSet?: Set<string>;
}) => {
  const { completedDisciplines } = useApp();
  const allCompleted = group.courses.every((c) => completedDisciplines.includes(c.code));
  const firstCourse = group.courses[0];
  const badgeInfo = getDisciplineBadge(
    group.baseCode,
    firstCourse?.level,
    firstCourse?.type,
    curriculumMandatorySet,
    curriculumElectiveSet,
    getEquivalentCodesSync
  );

  return (
    <div
      data-discipline-code={group.baseCode}
      className={`overflow-hidden rounded-[14px] border-[1.5px] ${
        isSelected ? 'border-foreground/15 bg-background pl-1' : 'border-foreground/10 bg-background'
      }`}
      style={isSelected && cor ? { boxShadow: `inset 5px 0 0 ${cor}` } : undefined}
    >
      <div className="border-b border-foreground/10 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 pr-2 font-mono text-xs font-semibold text-mar-ink">
              <span>{group.baseCode}</span>
            </div>
            <div className="line-clamp-2 pr-2 text-[13.5px] font-extrabold uppercase leading-tight text-foreground">{group.name}</div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
              badgeInfo.type === 'mandatory' && "bg-mar-tint text-mar-ink",
              badgeInfo.type === 'elective' && "bg-dende-tint text-dende-ink",
              badgeInfo.type === 'equivalent' && "bg-trilho text-foreground",
              badgeInfo.type === 'offered' && "bg-trilho text-foreground-2"
            )}
          >
            {badgeInfo.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge variant="secondary" className="shrink-0 border-0 bg-transparent px-0 font-mono text-xs font-medium text-foreground-2 hover:bg-transparent">
            {group.sections_count} turma{group.sections_count !== 1 ? 's' : ''}
          </Badge>
          {allCompleted && (
            <span className="shrink-0 rounded-full bg-mar px-2 py-0.5 text-[10.5px] font-extrabold text-white">
              Cursada
            </span>
          )}
          {conflictCodes.length > 0 && conflictCodes.map((code) => (
            <span
              key={code}
              className="flex shrink-0 items-center gap-1 rounded-full bg-pitanga-tint px-2 py-0.5 text-[10.5px] font-extrabold text-pitanga-ink"
            >
              Choque com {code}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-foreground/10">
        {group.courses.map((course) => (
          <button
            key={course.code}
            type="button"
            data-discipline-code={course.code}
            onClick={() => onCourseClick(course as Course)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-foreground/[0.04]"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs font-semibold">{course.code}</div>
              <div className="text-[11px] text-muted-foreground">
                {getBlockCourseVariantLabel(course.code, indexByCode)}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-[11px] font-medium">
              {course.sections_count ?? 0} turma{(course.sections_count ?? 0) !== 1 ? 's' : ''}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
});

BlockDisciplineGroupCard.displayName = 'BlockDisciplineGroupCard';

// Componente de lista virtualizada para melhor performance
const VirtualizedDisciplineList = memo(({ 
  courses, 
  onLoadMore, 
  hasMore,
  onCourseClick,
  curriculumMandatorySet,
  curriculumElectiveSet,
}: { 
  courses: Course[]; 
  onLoadMore: () => void; 
  hasMore: boolean;
  onCourseClick: (course: Course) => void;
  curriculumMandatorySet?: Set<string>;
  curriculumElectiveSet?: Set<string>;
}) => {
  const [visibleCount, setVisibleCount] = useState(20);
  
  useEffect(() => {
    setVisibleCount(20);
  }, [courses]);
  
  const visibleCourses = courses.slice(0, visibleCount);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      if (hasMore && visibleCourses.length >= visibleCount - 5) {
        setVisibleCount(prev => Math.min(prev + 20, courses.length));
      }
    }
  };
  
  return (
    <div 
      className="space-y-3 max-h-[600px] overflow-y-auto"
      onScroll={handleScroll}
    >
      {visibleCourses.map((course) => (
        <DisciplineCard 
          key={course.code}
          course={course}
          onClick={onCourseClick}
          curriculumMandatorySet={curriculumMandatorySet}
          curriculumElectiveSet={curriculumElectiveSet}
        />
      ))}
      {hasMore && visibleCourses.length < courses.length && (
        <div className="text-center py-2">
          <Button variant="ghost" size="sm" onClick={() => setVisibleCount(prev => Math.min(prev + 20, courses.length))}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
});

VirtualizedDisciplineList.displayName = 'VirtualizedDisciplineList';

const Planejador = () => {
  const { myPrograms } = useMyPrograms();
  const { courses: myCourses, isLoading: loadingCourses } = useMyCourses();
  const [selectedDiscipline, setSelectedDiscipline] = useState<Course | null>(null);
  const [showSections, setShowSections] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Estado para curso selecionado para visualização
  const [selectedViewProgramId, setSelectedViewProgramId] = useState<string | null>(null);
  // Estado para busca de cursos no seletor
  const [programSearchTerm, setProgramSearchTerm] = useState("");
  // Desktop largo: as turmas abrem dentro da lista (no celular continuam na gaveta)
  const [telaLarga, setTelaLarga] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setTelaLarga(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const { scheduledCount: resumoQtd, workloadBreakdown: resumoCarga } = usePlannedDisciplineCategories();
  const [painelSigaa, setPainelSigaa] = useState<PainelSigaa>(null);
  // Várias grades: comparar, semana compacta/completa e, no celular, as abas Grade · Disciplinas
  const [comparando, setComparando] = useState(false);
  const [visaoSemana, setVisaoSemana] = useState<VisaoSemana>(lerVisaoSemana);
  const trocarVisaoSemana = (v: VisaoSemana) => {
    setVisaoSemana(v);
    salvarVisaoSemana(v);
  };
  const [abaMobile, setAbaMobile] = useState<'grade' | 'disciplinas'>('grade');
  const [painelHorarioAberto, setPainelHorarioAberto] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  
  // Buscar todos os programas disponíveis
  const { data: allPrograms = [] } = usePrograms();
  
  // Carregar cursos do programa selecionado para visualização
  const { data: viewProgramDetail } = useProgramDetail(
    selectedViewProgramId 
      ? allPrograms.find(p => p.id_ref === selectedViewProgramId)?.detail_url || null
      : null
  );
  
  const { data: coursesIndex = [] } = useCourses();
  
  // Cursos para exibição: simplificado e otimizado
  const courses = useMemo(() => {
    // Se há programa selecionado, usa os cursos dele
    if (selectedViewProgramId && viewProgramDetail) {
      const indexByCode = new Map(coursesIndex.map((c) => [c.code, c]));
      const programCourses = (viewProgramDetail as any)?.courses || [];
      
      return programCourses.map((c: any) => {
        const idx = indexByCode.get(c.code) as any;
        return {
          code: c.code,
          name: resolveBlockCourseName(c.code, indexByCode, c.name),
          level: typeof c.semester === 'number' ? `${c.semester}º Semestre` : (c.level ?? '').replace("Nível", "Semestre"),
          type: c.type,
          credits: c.credits,
          workload: c.workload,
          prerequisites: c.prerequisites,
          sections_count: idx?.sections_count ?? 0,
          sections_url: idx?.sections_url,
          detail_url: idx?.detail_url,
          mode: idx?.mode,
          location: idx?.location,
          id_ref: idx?.id_ref,
          department: idx?.department,
          code_url: idx?.code_url,
        } as Course;
      });
    }
    
    // Se não há programa selecionado ("Meu Curso"), usa os cursos do usuário
    if (myCourses && myCourses.length > 0) {
      return myCourses;
    }
    
    return [];
  }, [selectedViewProgramId, viewProgramDetail, coursesIndex, myCourses]);
  
  const isLoading = loadingCourses || (selectedViewProgramId && !viewProgramDetail);
  const [filtroModalOpen, setFiltroModalOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [hideFull, setHideFull] = useState(false);
  const [vacancyFilter, setVacancyFilter] = useState<'all' | 'few' | 'many'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'mandatory' | 'optional' | 'equivalent' | 'offered'>('all');
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([]);
  const [logicaFiltroDia, setLogicaFiltroDia] = useState<'OU' | 'E'>('OU');
  const [logicaFiltroHorario, setLogicaFiltroHorario] = useState<'OU' | 'E'>('OU');
  // Estados para restrições de horário
  const [diasRestritos, setDiasRestritos] = useState<string[]>([]);
  const [logicaRestricoes, setLogicaRestricoes] = useState<'OU' | 'E'>('OU');
  const [horariosRestritos, setHorariosRestritos] = useState<string[]>([]);
  const [logicaRestricoesHorario, setLogicaRestricoesHorario] = useState<'OU' | 'E'>('OU');
  
  const { hasSectionOnCourse, toggleSection, getConflictsForSection, mySections, clearSections } = useMySections('ativa');
  // Mesma cor que cada disciplina tem na grade (faixa à esquerda nas selecionadas)
  const coresGrade = useMemo(
    () => mapaDeCores(mySections.map((s) => getBlockCourseBaseCode(s.course?.code || (s as { course_code?: string }).course_code || ''))),
    [mySections],
  );
  const { completedDisciplines } = useApp();
  const { data: allSections = [], fonte: fonteOfertas, buscandoAoVivo } = useSections();
  const { currentTerm } = useCurrentTerm();

  const { curriculumMandatorySet, curriculumElectiveSet } = useMemo(() => {
    const mandatory = new Set<string>();
    const elective = new Set<string>();
    for (const c of courses) {
      const base = getBlockCourseBaseCode(c.code);
      if (isCurriculumElective(c)) {
        elective.add(base);
      } else if (isCurriculumMandatory(c)) {
        mandatory.add(base);
      }
    }
    return { curriculumMandatorySet: mandatory, curriculumElectiveSet: elective };
  }, [courses]);

  const hasAnyVacancyData = useMemo(() => {
    return allSections.some((s) => ((s as any)?.seats_accepted ?? 0) > 0 && ((s as any)?.seats_count ?? 0) > 0);
  }, [allSections]);
  const { pendingTransition, planningTerm } = useSemesterTransition();
  const myProgramTitles = new Set(myPrograms.map(p => (p.title || '').trim().toLowerCase()));
  const [applyFiltersToSections, setApplyFiltersToSections] = useState(true);
  const [selectedDisciplinesExpanded, setSelectedDisciplinesExpanded] = useState(true);
  const [otherDisciplinesExpanded, setOtherDisciplinesExpanded] = useState(true);

  const hasActiveFilters = useMemo(() => (
    diasSelecionados.length > 0 ||
    horariosSelecionados.length > 0 ||
    diasRestritos.length > 0 ||
    horariosRestritos.length > 0
  ), [diasSelecionados, horariosSelecionados, diasRestritos, horariosRestritos]);

  // Helper para normalizar texto (remove acentos) para busca
  const normalizeText = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toLowerCase();

  const currentTermSectionData = useMemo(
    () => buildCurrentTermSectionIndex(allSections, currentTerm),
    [allSections, currentTerm]
  );

  const programTitlesForOffer = useMemo(() => {
    if (selectedViewProgramId) {
      const program = allPrograms.find((p) => p.id_ref === selectedViewProgramId);
      const title = program?.title?.trim().toLowerCase();
      return new Set(title ? [title] : []);
    }
    return myProgramTitles;
  }, [selectedViewProgramId, allPrograms, myProgramTitles]);

  const plannerCourses = useMemo(
    () =>
      mergeProgramCoursesWithOffered(
        courses,
        allSections,
        coursesIndex,
        currentTerm,
        programTitlesForOffer,
        currentTermSectionData.sectionCountByCode
      ),
    [courses, allSections, coursesIndex, currentTerm, programTitlesForOffer, currentTermSectionData.sectionCountByCode]
  );

  // Filtrar disciplinas por termo de busca e filtros - otimizado
  const disciplinasFiltradas = useMemo(() => {
    if (!plannerCourses || plannerCourses.length === 0) return [];

    let result = plannerCourses;

    // Apenas disciplinas com turmas no semestre letivo vigente
    if (currentTerm) {
      result = result.filter((course) => currentTermSectionData.codesWithSections.has(course.code));
    } else {
      result = result.filter((course) => (course.sections_count || 0) > 0);
    }

    result = result.map((course) => ({
      ...course,
      sections_count: currentTermSectionData.sectionCountByCode.get(course.code) ?? course.sections_count ?? 0,
    }));
    
    // Filtrar disciplinas cursadas se não estiverem visíveis
    if (!showCompleted) {
      result = result.filter(course => !completedDisciplines.includes(course.code));
    }
    
    // Aplicar filtro de busca - otimizado com cache do termo
    if (searchTerm) {
      const term = normalizeText(searchTerm);
      result = result.filter(course => {
        const codeNorm = normalizeText(course.code);
        const nameNorm = normalizeText(course.name);
        const baseNorm = normalizeText(getBlockCourseBaseCode(course.code));
        return codeNorm.includes(term) || nameNorm.includes(term) || baseNorm.includes(term);
      });
    }

    if (typeFilter !== 'all') {
      result = result.filter(course => {
        const badge = getDisciplineBadge(
          course.code,
          course.level,
          course.type,
          curriculumMandatorySet,
          curriculumElectiveSet,
          getEquivalentCodesSync
        );
        
        if (typeFilter === 'mandatory') {
           return badge.type === 'mandatory';
        }
        if (typeFilter === 'optional') {
           return badge.type === 'elective';
        }
        if (typeFilter === 'equivalent') {
           return badge.type === 'equivalent';
        }
        if (typeFilter === 'offered') {
           return badge.type === 'offered';
        }
        return true;
      });
    }

    const hasFilters = diasSelecionados.length > 0 || horariosSelecionados.length > 0 || 
      diasRestritos.length > 0 || horariosRestritos.length > 0 || hideFull || vacancyFilter !== 'all';

    if (!hasFilters) return result;

    const selectedDias = diasSelecionados
      .map(d => mapSiglaParaNome[d as keyof typeof mapSiglaParaNome])
      .filter(Boolean);
    const restrictedDias = diasRestritos
      .map(d => mapSiglaParaNome[d as keyof typeof mapSiglaParaNome])
      .filter(Boolean);

    const sectionsByCourse = currentTerm
      ? currentTermSectionData.sectionsByCourse
      : allSections.reduce((acc, section) => {
          const code = (section as any)?.course?.code || (section as any)?.course_code || '';
          if (!code) return acc;
          if (!acc.has(code)) acc.set(code, [] as Section[]);
          acc.get(code)!.push(section);
          return acc;
        }, new Map<string, Section[]>());

    const matchesSection = (section: Section) => {
      if (hasAnyVacancyData) {
        const seatsAccepted = (section as any)?.seats_accepted ?? 0;
        const seatsCount = (section as any)?.seats_count ?? 0;
        const freeSeats = Math.max(0, seatsCount - seatsAccepted);
        
        if (hideFull && freeSeats === 0 && seatsCount > 0) return false;
        if (vacancyFilter === 'few' && (freeSeats > 10 || freeSeats === 0 || seatsCount === 0)) return false;
        if (vacancyFilter === 'many' && (freeSeats <= 10 || seatsCount === 0)) return false;
      }

      const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
      if (timeCodes.length === 0) return true;

      const horariosParsed = parseTimeCodes(timeCodes);

      if (selectedDias.length > 0) {
        const diasNaTurma = horariosParsed.map(h => h.dia);
        const match = logicaFiltroDia === 'E'
          ? selectedDias.every(d => diasNaTurma.includes(d))
          : selectedDias.some(d => diasNaTurma.includes(d));
        if (!match) return false;
      }

      if (horariosSelecionados.length > 0) {
        const horariosNaTurma = horariosParsed.map(h => h.horarioInicio);
        const match = logicaFiltroHorario === 'E'
          ? horariosSelecionados.every(h => horariosNaTurma.includes(h))
          : horariosSelecionados.some(h => horariosNaTurma.includes(h));
        if (!match) return false;
      }

      if (restrictedDias.length > 0) {
        const diasNaTurma = horariosParsed.map(h => h.dia);
        const match = logicaRestricoes === 'E'
          ? restrictedDias.every(d => diasNaTurma.includes(d))
          : restrictedDias.some(d => diasNaTurma.includes(d));
        if (match) return false;
      }

      if (horariosRestritos.length > 0) {
        const horariosNaTurma = horariosParsed.map(h => h.horarioInicio);
        const match = logicaRestricoesHorario === 'E'
          ? horariosRestritos.every(h => horariosNaTurma.includes(h))
          : horariosRestritos.some(h => horariosNaTurma.includes(h));
        if (match) return false;
      }

      return true;
    };

    return result.filter(course => {
      const sections = sectionsByCourse.get(course.code) || [];
      if (sections.length === 0) return false;
      return sections.some(matchesSection);
    });
  }, [
    plannerCourses,
    searchTerm,
    showCompleted,
    hideFull,
    vacancyFilter,
    typeFilter,
    completedDisciplines,
    diasSelecionados,
    horariosSelecionados,
    diasRestritos,
    horariosRestritos,
    logicaFiltroDia,
    logicaFiltroHorario,
    logicaRestricoes,
    logicaRestricoesHorario,
    allSections,
    currentTerm,
    currentTermSectionData,
  ]);

  const indexByCode = useMemo(
    () => new Map(coursesIndex.map((c) => [c.code, c])),
    [coursesIndex]
  );

  const coursesByCode = useMemo(() => {
    const map = new Map<string, { name?: string }>();
    coursesIndex.forEach(c => map.set(c.code, c));
    if (myCourses) {
      myCourses.forEach(c => map.set(c.code, c));
    }
    return map;
  }, [coursesIndex, myCourses]);

  // Compute conflicts between selected sections, grouped by base course code
  const conflictsByBaseCode = useMemo(() => {
    const conflictsMap = new Map<string, Set<string>>();

    // For each selected section, check conflicts with other selected sections
    for (let i = 0; i < mySections.length; i++) {
      const sectionA = mySections[i];
      const codeA = sectionA.course?.code || (sectionA as any).course_code;
      if (!codeA) continue;
      const baseA = getBlockCourseBaseCode(codeA);

      for (let j = i + 1; j < mySections.length; j++) {
        const sectionB = mySections[j];
        const codeB = sectionB.course?.code || (sectionB as any).course_code;
        if (!codeB) continue;
        const baseB = getBlockCourseBaseCode(codeB);

        // Skip same base code (same block)
        if (baseA === baseB) continue;

        // Check if they conflict
        const conflicts = getConflictsForSection(sectionA);
        const hasConflict = conflicts.some(c => c.section.id_ref === sectionB.id_ref);

        if (hasConflict) {
          // Add conflict to both directions
          if (!conflictsMap.has(baseA)) conflictsMap.set(baseA, new Set());
          conflictsMap.get(baseA)!.add(baseB);

          if (!conflictsMap.has(baseB)) conflictsMap.set(baseB, new Set());
          conflictsMap.get(baseB)!.add(baseA);
        }
      }
    }

    return conflictsMap;
  }, [mySections, getConflictsForSection]);

  const disciplinasAgrupadas = useMemo(
    () => groupDisciplinesByBlock(disciplinasFiltradas, indexByCode),
    [disciplinasFiltradas, indexByCode]
  );

  // Separar disciplinas selecionadas (que estão na grade)
  const { selectedGroups, nonSelectedGroups } = useMemo(() => {
    const selected: DisciplineGroup[] = [];
    const nonSelected: DisciplineGroup[] = [];
    
    for (const group of disciplinasAgrupadas) {
      const hasSelected = group.courses.some(course => 
        mySections.some(s => {
          const sectionCode = s.course?.code || (s as any).course_code;
          if (!sectionCode) return false;
          // Verifica se o curso é o mesmo ou se é do mesmo bloco (código base)
          const baseCodeOfCourse = getBlockCourseBaseCode(course.code);
          const baseCodeOfSection = getBlockCourseBaseCode(sectionCode);
          return baseCodeOfCourse === baseCodeOfSection;
        })
      );
      
      if (hasSelected) {
        selected.push(group);
      } else {
        nonSelected.push(group);
      }
    }
    
    return { selectedGroups: selected, nonSelectedGroups: nonSelected };
  }, [disciplinasAgrupadas, mySections]);

  const totalTurmasSemestre = useMemo(() => {
    if (!plannerCourses) return 0;
    if (currentTerm) {
      return plannerCourses.reduce((total, course) => {
        return total + (currentTermSectionData.sectionCountByCode.get(course.code) || 0);
      }, 0);
    }
    return plannerCourses.reduce((total, course) => total + (course.sections_count || 0), 0);
  }, [plannerCourses, currentTerm, currentTermSectionData]);

  // ---------- Horário clicado na grade: vira o filtro de dia e horário ----------
  const slotAtual =
    diasSelecionados.length === 1 && horariosSelecionados.length === 1
      ? { dia: diasSelecionados[0], hora: horariosSelecionados[0] }
      : null;
  const slotTexto = slotAtual ? `${ROTULO_DIA[slotAtual.dia] ?? slotAtual.dia} ${slotAtual.hora}` : '';
  const limparSlot = () => {
    setDiasSelecionados([]);
    setHorariosSelecionados([]);
    setPainelHorarioAberto(false);
  };
  const escolherSlot = (dia: string, hora: string) => {
    if (slotAtual?.dia === dia && slotAtual?.hora === hora) {
      limparSlot();
      return;
    }
    setDiasSelecionados([dia]);
    setHorariosSelecionados([hora]);
    setLogicaFiltroDia('OU');
    setLogicaFiltroHorario('OU');
    if (!telaLarga) setPainelHorarioAberto(true);
  };

  // Disciplinas com turma no horário clicado que chocam com outra aula da grade (todas as turmas ali chocam)
  const choqueNoSlot = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!slotAtual) return m;
    const diaNome = mapSiglaParaNome[slotAtual.dia as keyof typeof mapSiglaParaNome];
    const turmasDoCurso = (code: string): Section[] =>
      currentTerm ? ((currentTermSectionData.sectionsByCourse.get(code) || []) as Section[]) : allSections.filter((t) => codigoDaTurma(t) === code);
    for (const g of nonSelectedGroups) {
      const turmas = g.courses
        .flatMap((c) => turmasDoCurso(c.code))
        .filter((t) =>
          parseTimeCodes(Array.isArray(t.time_codes) ? t.time_codes : []).some((h) => h.dia === diaNome && h.horarioInicio === slotAtual.hora),
        );
      if (turmas.length === 0) continue;
      const choques = turmas.map((t) => chocaCom(t, mySections));
      if (choques.every(Boolean)) m.set(g.key, [`${choques[0]!.codigo} · ${choques[0]!.quando}`]);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotAtual?.dia, slotAtual?.hora, nonSelectedGroups, mySections, currentTerm, currentTermSectionData, allSections]);
  const gruposNoSlot = useMemo(
    () => [...nonSelectedGroups].sort((a, b) => Number(choqueNoSlot.has(a.key)) - Number(choqueNoSlot.has(b.key))),
    [nonSelectedGroups, choqueNoSlot],
  );

  // Carga horária da grade aberta (pela carga de cada disciplina)
  const cargaPorBase = useMemo(() => {
    const m = new Map<string, number>();

    // 1. Cursos do programa selecionado / myCourses / viewProgramDetail / plannerCourses
    for (const c of [...(courses ?? []), ...plannerCourses, ...(myCourses ?? [])]) {
      const b = getBlockCourseBaseCode(c.code);
      if (!b) continue;
      const w = (c as { workload?: number }).workload;
      if (typeof w === 'number' && w > 0 && !m.has(b)) {
        m.set(b, w);
      } else if (!m.has(b)) {
        const cr = (c as { credits?: number }).credits;
        if (typeof cr === 'number' && cr > 0) {
          m.set(b, cr * 17);
        }
      }
    }

    // 2. Extrai carga de allSections a partir dos horários semanais (time_codes)
    // No padrão UFBA, cada horário semanal equivale a 1 crédito (17 horas no semestre)
    const slotsPorSubcodigo = new Map<string, number>();
    for (const s of allSections) {
      const cod = codigoDaTurma(s);
      if (!cod || slotsPorSubcodigo.has(cod)) continue;
      const tc = Array.isArray(s.time_codes) ? s.time_codes : [];
      if (!tc.length) continue;
      const slots = parseTimeCodes(tc).length;
      if (slots > 0) slotsPorSubcodigo.set(cod, slots);
    }

    const slotsPorBase = new Map<string, number>();
    for (const [cod, slots] of slotsPorSubcodigo.entries()) {
      const b = getBlockCourseBaseCode(cod);
      slotsPorBase.set(b, (slotsPorBase.get(b) ?? 0) + slots);
    }

    for (const [b, slots] of slotsPorBase.entries()) {
      if (!m.has(b) && slots > 0) {
        m.set(b, slots * 17);
      }
    }

    return m;
  }, [courses, plannerCourses, myCourses, allSections]);

  const cargaDe = (base: string) => {
    if (!base) return 0;
    const c = cargaPorBase.get(base);
    if (typeof c === 'number' && c > 0) return c;
    // Tenta encontrar nas turmas da grade atual (mySections)
    const secoes = mySections.filter((s) => getBlockCourseBaseCode(codigoDaTurma(s)) === base);
    if (secoes.length > 0) {
      const slots = secoes.reduce((acc, s) => {
        const tc = Array.isArray(s.time_codes) ? s.time_codes : [];
        return acc + parseTimeCodes(tc).length;
      }, 0);
      if (slots > 0) return slots * 17;
    }
    return 68;
  };
  const basesDaGrade = Array.from(new Set(mySections.map((t) => getBlockCourseBaseCode(codigoDaTurma(t))).filter(Boolean)));
  const cargaDaGrade = basesDaGrade.reduce((t, b) => t + cargaDe(b), 0);
  const nChoques = useMemo(() => encontrarChoques(mySections).length, [mySections]);

  // Celular: as outras disciplinas agrupadas por tipo, recolhidas
  const gruposPorTipo = useMemo(() => {
    const out = { obrigatorias: [] as DisciplineGroup[], optativas: [] as DisciplineGroup[], outras: [] as DisciplineGroup[] };
    for (const g of nonSelectedGroups) {
      const c = g.courses[0];
      const badge = getDisciplineBadge(g.isBlockGroup ? g.baseCode : c.code, c?.level, c?.type, curriculumMandatorySet, curriculumElectiveSet, getEquivalentCodesSync);
      if (badge.type === 'mandatory') out.obrigatorias.push(g);
      else if (badge.type === 'elective') out.optativas.push(g);
      else out.outras.push(g);
    }
    return out;
  }, [nonSelectedGroups, curriculumMandatorySet, curriculumElectiveSet]);
  const filtrosMobileAtivos =
    (hasActiveFilters && !slotAtual ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (vacancyFilter !== 'all' ? 1 : 0) + (hideFull ? 1 : 0);

  // Função para carregar as turmas de uma disciplina
  const handleShowSections = (course: Course, options?: { ignoreFilters?: boolean }) => {
    // Limpar timeout anterior se existir
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    setApplyFiltersToSections(!options?.ignoreFilters);

    setIsLoadingSections(true);
    setSelectedCourse(course);
    setShowSections(true);
    
    // Simular um pequeno delay para mostrar o loading
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoadingSections(false);
      loadingTimeoutRef.current = null;
    }, 500);
  };

  const handleShowSectionsNoFilters = (course: Course) => handleShowSections(course, { ignoreFilters: true });

  // Abre as turmas de uma disciplina pelo código (ex.: "Trocar turma" no bloco de choques)
  const abrirTurmasDoCodigo = (codigo: string) => {
    const curso =
      plannerCourses.find((c) => c.code === codigo) ??
      ({ code: codigo, name: mySections.find((t) => codigoDaTurma(t) === codigo)?.course?.name ?? codigo } as Course);
    handleShowSectionsNoFilters(curso);
  };

// Função para fechar modal de turmas e voltar para lista de disciplinas
  const handleBackToDisciplines = (course: Course) => {
    // Fechar modal de detalhes da seção
    setSelectedSection(null);
    
    // Fechar modal de turmas se estiver aberto
    setShowSections(false);
    setApplyFiltersToSections(true);
    
    // Definir a disciplina como selecionada para destacar na lista
    setSelectedDiscipline(course);
    
    // Pequeno delay para garantir que os modais fechem antes de rolar
    setTimeout(() => {
      // Rolar para a disciplina na lista
      const element = document.querySelector(`[data-discipline-code="${course.code}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Adicionar highlight temporário
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }, 2000);
      }
    }, 100);
  };

  // Fechar o modal de turmas
  const handleCloseSections = () => {
    // Limpar timeout se existir
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    setShowSections(false);
    setSelectedCourse(null);
    setApplyFiltersToSections(true);
    setIsLoadingSections(false);
  };

  // Limpar filtros
  const limparFiltros = () => {
    setDiasSelecionados([]);
    setHorariosSelecionados([]);
    setLogicaFiltroDia('OU');
    setLogicaFiltroHorario('OU');
    setDiasRestritos([]);
    setLogicaRestricoes('OU');
    setHorariosRestritos([]);
    setLogicaRestricoesHorario('OU');
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    setFiltroModalOpen(false);
    // Força a atualização da lista de disciplinas para aplicar os filtros
    // Isso será feito através da dependência das variáveis de filtro no useMemo
  };

  const turmasAbertasPara = (codes: string[]) =>
    telaLarga && showSections && !!selectedCourse && codes.includes(selectedCourse.code);

  const painelTurmas = selectedCourse ? (
    <div className="rounded-[14px] border-2 border-foreground px-3.5 pb-1.5 pt-3">
      <div className="flex items-start gap-2 pb-2.5">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-xs font-semibold text-mar-ink">{selectedCourse.code}</span>
          <div className="mt-1 text-[13.5px] font-extrabold uppercase leading-tight text-foreground">{selectedCourse.name}</div>
        </div>
        <button
          type="button"
          onClick={handleCloseSections}
          aria-label="Fechar turmas"
          className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-nevoa"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
      {isLoadingSections ? (
        <div className="flex items-center gap-2 border-t border-foreground/10 py-4 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-mar" /> Carregando turmas…
        </div>
      ) : (
        <SectionsList
          compacto
          courseCode={selectedCourse.code}
          currentTerm={currentTerm}
          onCourseClick={handleShowSectionsNoFilters}
          diasSelecionados={applyFiltersToSections ? diasSelecionados : []}
          horariosSelecionados={applyFiltersToSections ? horariosSelecionados : []}
          diasRestritos={applyFiltersToSections ? diasRestritos : []}
          horariosRestritos={applyFiltersToSections ? horariosRestritos : []}
          hasAnyVacancyData={hasAnyVacancyData}
          hideFull={applyFiltersToSections ? hideFull : false}
          vacancyFilter={applyFiltersToSections ? vacancyFilter : 'all'}
        />
      )}
    </div>
  ) : null;

  const seletorOfertas = (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground-2">
        <Eye className="h-4 w-4" />
        Visualizar ofertas de
      </span>
      <Select 
        value={selectedViewProgramId || "meu-curso"} 
        onValueChange={(value) => setSelectedViewProgramId(value === "meu-curso" ? null : value)}
      >
        <SelectTrigger className="h-11 w-full rounded-full border-0 bg-nevoa px-5 text-sm font-bold sm:w-auto sm:min-w-[260px]">
          <SelectValue placeholder="Selecione um curso" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar curso..."
                value={programSearchTerm}
                onChange={(e) => setProgramSearchTerm(e.target.value)}
                className="w-full rounded-full border-0 bg-nevoa py-2 pl-8 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-mar"
              />
            </div>
          </div>
          <SelectItem value="meu-curso">
            Meu curso ({myPrograms.map(p => p.title).join(', ')})
          </SelectItem>
          {allPrograms
            .filter(p => !myPrograms.some(mp => mp.id_ref === p.id_ref))
            .filter(p => p.title.toLowerCase().includes(programSearchTerm.toLowerCase()))
            .map((program) => (
              <SelectItem key={program.id_ref} value={program.id_ref}>
                {program.title}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {selectedViewProgramId && (
        <button
          type="button"
          onClick={() => setSelectedViewProgramId(null)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-foreground hover:bg-nevoa"
        >
          <X className="h-4 w-4" />
          Voltar ao meu curso
        </button>
      )}
    </div>
  );

  // Cartão de uma disciplina fora da grade (mesmo desenho da lista do desktop)
  const renderGrupo = (group: DisciplineGroup, conflitos?: string[]) =>
    turmasAbertasPara(group.courses.map((c) => c.code)) && !group.isBlockGroup ? (
      <div key={group.key}>{painelTurmas}</div>
    ) : group.isBlockGroup ? (
      <div key={group.key} className="flex flex-col gap-1.5">
        <BlockDisciplineGroupCard
          group={group}
          indexByCode={indexByCode}
          onCourseClick={handleShowSections}
          conflictCodes={conflitos}
          curriculumMandatorySet={curriculumMandatorySet}
          curriculumElectiveSet={curriculumElectiveSet}
        />
        {turmasAbertasPara(group.courses.map((c) => c.code)) && painelTurmas}
      </div>
    ) : (
      <DisciplineCard
        key={group.courses[0].code}
        course={group.courses[0] as Course}
        onClick={handleShowSections}
        conflictCodes={conflitos}
        curriculumMandatorySet={curriculumMandatorySet}
        curriculumElectiveSet={curriculumElectiveSet}
      />
    );

  // Lista com o filtro do horário clicado na grade
  const listaNoHorario = (
    <>
      <div className="mb-1 flex h-10 items-center justify-between gap-2 border-b-2 border-foreground">
        <span className="rotulo !text-foreground">
          Com turma em {slotTexto} · {gruposNoSlot.length}
        </span>
        <button type="button" onClick={limparSlot} className="text-xs font-bold text-mar underline underline-offset-[3px] hover:text-foreground">
          ver todas
        </button>
      </div>
      {gruposNoSlot.length === 0 ? (
        <p className="py-4 text-[13px] font-medium text-foreground-2">Nenhuma disciplina tem turma nesse horário com os filtros atuais.</p>
      ) : (
        gruposNoSlot.map((g) => renderGrupo(g, choqueNoSlot.get(g.key)))
      )}
    </>
  );

  // Celular: selecionadas como chips e o resto agrupado e recolhido
  const selecionadasChips = basesDaGrade.map((b) => {
    const t = mySections.find((x) => getBlockCourseBaseCode(codigoDaTurma(x)) === b)!;
    return { base: b, codigo: codigoDaTurma(t), nome: t.course?.name ?? b };
  });
  const buscandoOuFiltrando = !!searchTerm || hasActiveFilters || typeFilter !== 'all';
  const listaMobile = (
    <>
      {selecionadasChips.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <span className="rotulo !text-foreground">Nesta grade · {selecionadasChips.length}</span>
          <div className="flex flex-wrap gap-1.5">
            {selecionadasChips.map((c) => (
              <button
                key={c.base}
                type="button"
                onClick={() => abrirTurmasDoCodigo(c.codigo)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-nevoa pl-2.5 pr-3 font-mono text-xs font-semibold text-foreground hover:bg-trilho"
                title={c.nome}
              >
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: coresGrade.get(c.base)?.bg }} />
                {c.base}
              </button>
            ))}
          </div>
        </div>
      )}
      {([
        ['obrigatorias', 'Obrigatórias', gruposPorTipo.obrigatorias],
        ['optativas', 'Optativas', gruposPorTipo.optativas],
        ['outras', 'Equivalentes e outras ofertas', gruposPorTipo.outras],
      ] as const).map(([chave, rotulo, grupos]) => {
        if (grupos.length === 0) return null;
        const aberto = gruposAbertos[chave] ?? buscandoOuFiltrando;
        return (
          <div key={chave} className="flex flex-col">
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => setGruposAbertos((g) => ({ ...g, [chave]: !aberto }))}
              className="flex min-h-[52px] w-full items-center justify-between gap-2 border-b border-foreground/15 text-left"
            >
              <span className="flex items-center gap-2 text-[15px] font-black tracking-[-0.02em] text-foreground">
                {rotulo}
                <span className="rounded-full bg-nevoa px-2 py-0.5 font-mono text-[11px] font-semibold">{grupos.length}</span>
              </span>
              {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {aberto && <div className="flex flex-col gap-1.5 pb-3 pt-2">{grupos.map((g) => renderGrupo(g))}</div>}
          </div>
        );
      })}
      {selectedGroups.length === 0 && nonSelectedGroups.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nenhuma disciplina encontrada</p>
      )}
    </>
  );

  const colunaDisciplinas = (
    <div className="space-y-4 lg:border-r lg:border-border lg:pr-8">
      {/* Card de Disciplinas */}
      <div className="">
        <div className="mb-4">
          <div>
            <h3 className="text-2xl font-black tracking-[-0.035em] text-foreground">Disciplinas do curso</h3>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-foreground-2">
              {currentTerm && <span>Ofertas do semestre {currentTerm}</span>}
              {fonteOfertas === 'sigaa' ? (
                <span
                  title="Turmas atualizadas agora pelo SIGAA"
                  className="inline-flex items-center gap-1.5 rounded-full bg-mar-claro px-2.5 py-0.5 text-[11px] font-extrabold text-mar-ink"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-mar" />
                  SIGAA ao vivo
                </span>
              ) : (
                buscandoAoVivo && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> atualizando pelo SIGAA…
                  </span>
                )
              )}
              <span className="rounded-full bg-nevoa px-2.5 py-0.5 text-[11px] font-extrabold text-foreground">
                {disciplinasAgrupadas.length} disciplinas · {totalTurmasSemestre} turmas
              </span>
            </p>
            {selectedViewProgramId && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualizando: {allPrograms.find(p => p.id_ref === selectedViewProgramId)?.title || 'Outro curso'}
              </p>
            )}
          </div>
        </div>

        {/* Barra de busca e filtros otimizada */}
        <div className="mb-4">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-2" />
            <input
              type="text"
              placeholder="Buscar disciplina..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-12 w-full rounded-full border-0 bg-nevoa pl-11 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-mar transition-all"
            />
          </div>
          
          {telaLarga ? (
          <div className="flex flex-wrap items-center gap-2 max-w-[100vw] overflow-x-auto pb-1">
            <button
              type="button"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-3.5 text-[13px] font-bold transition-colors hover:bg-nevoa"
              onClick={() => setFiltroModalOpen(true)}
            >
              <Filter className="h-3.5 w-3.5" />
              Dias / Horários
              {hasActiveFilters && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-dende ring-2 ring-background" aria-label="Filtros ativos"></span>
              )}
            </button>

            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="inline-flex h-10 w-auto items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-3.5 text-[13px] font-bold hover:bg-nevoa">
                <span>Tipo: {typeFilter === 'all' ? 'Todas' : typeFilter === 'mandatory' ? 'Obrigatórias' : typeFilter === 'optional' ? 'Optativas' : typeFilter === 'equivalent' ? 'Equivalentes' : 'Ofertadas'}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="mandatory">Obrigatórias</SelectItem>
                <SelectItem value="optional">Optativas</SelectItem>
                <SelectItem value="equivalent">Equivalentes</SelectItem>
                <SelectItem value="offered">Ofertadas</SelectItem>
              </SelectContent>
            </Select>

            {hasAnyVacancyData && (
              <Select value={vacancyFilter} onValueChange={(v: any) => setVacancyFilter(v)}>
                <SelectTrigger className="inline-flex h-10 w-auto items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-3.5 text-[13px] font-bold hover:bg-nevoa">
                  <span>Vagas: {vacancyFilter === 'all' ? 'Todas' : vacancyFilter === 'few' ? 'Poucas' : 'Muitas'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as vagas</SelectItem>
                  <SelectItem value="few">Poucas vagas</SelectItem>
                  <SelectItem value="many">Muitas vagas</SelectItem>
                </SelectContent>
              </Select>
            )}

            {completedDisciplines.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompleted(!showCompleted)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors",
                  !showCompleted 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : "border-foreground/20 bg-transparent text-foreground hover:bg-nevoa"
                )}
              >
                Ocultar cursadas
              </button>
            )}

            {hasAnyVacancyData && (
              <button
                type="button"
                onClick={() => setHideFull(!hideFull)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors",
                  hideFull 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : "border-foreground/20 bg-transparent text-foreground hover:bg-nevoa"
                )}
              >
                Ocultar lotadas
              </button>
            )}
            {slotAtual && (
              <button
                type="button"
                onClick={limparSlot}
                aria-label={`Tirar filtro ${slotTexto}`}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-mar pl-3.5 pr-3 font-mono text-[12.5px] font-bold text-white"
              >
                {slotTexto}
                <X className="h-3.5 w-3.5" strokeWidth={2.6} />
              </button>
            )}
          </div>
          ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 bg-transparent px-3.5 text-[13px] font-bold transition-colors hover:bg-nevoa"
              onClick={() => setFiltroModalOpen(true)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {filtrosMobileAtivos > 0 && (
                <span className="rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">{filtrosMobileAtivos}</span>
              )}
            </button>
            {completedDisciplines.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompleted(!showCompleted)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors',
                  !showCompleted ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/20 bg-transparent text-foreground hover:bg-nevoa',
                )}
              >
                Ocultar cursadas
              </button>
            )}
            {slotAtual && (
              <button
                type="button"
                onClick={limparSlot}
                aria-label={`Tirar filtro ${slotTexto}`}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-mar pl-3.5 pr-3 font-mono text-[12.5px] font-bold text-white"
              >
                {slotTexto}
                <X className="h-3.5 w-3.5" strokeWidth={2.6} />
              </button>
            )}
          </div>
          )}
        </div>

        <div className="">
          <div className="grid grid-cols-1 gap-1.5">
            {isLoading ? (
              [...Array(8)].map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                {slotAtual ? (
                  listaNoHorario
                ) : !telaLarga ? (
                  listaMobile
                ) : (
                  <>
                {/* Disciplinas Selecionadas */}
                {selectedGroups.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedDisciplinesExpanded(!selectedDisciplinesExpanded)}
                      className="mb-1 flex h-10 w-full items-center gap-2 border-b-2 border-foreground text-left transition-colors"
                    >
                      <div className="hidden"></div>
                      <span className="rotulo flex flex-1 items-center justify-between gap-1 !text-foreground">
                        <span>Disciplinas selecionadas · {selectedGroups.length}</span>
                        {selectedDisciplinesExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                      <div className="hidden"></div>
                    </button>
                    {selectedDisciplinesExpanded && selectedGroups.map((group) => {
                      // Get conflicting base codes from our map
                      const conflictBaseCodes = conflictsByBaseCode.get(group.key) || new Set<string>();
                      const conflictCodes = Array.from(conflictBaseCodes);
                      
                      const abertas = turmasAbertasPara(group.courses.map((c) => c.code));
                      if (abertas && !group.isBlockGroup) return <div key={group.key}>{painelTurmas}</div>;
                      return group.isBlockGroup ? (
                        <div key={group.key} className="flex flex-col gap-1.5">
                        <BlockDisciplineGroupCard
                          group={group}
                          indexByCode={indexByCode}
                          onCourseClick={handleShowSections}
                          isSelected={true}
                          cor={coresGrade.get(group.key)?.bg}
                          conflictCodes={conflictCodes}
                          curriculumMandatorySet={curriculumMandatorySet}
                          curriculumElectiveSet={curriculumElectiveSet}
                        />
                        {abertas && painelTurmas}
                        </div>
                      ) : (
                        <DisciplineCard
                          key={group.courses[0].code}
                          course={group.courses[0] as Course}
                          onClick={handleShowSections}
                          isSelected={true}
                          cor={coresGrade.get(getBlockCourseBaseCode(group.courses[0].code))?.bg}
                          conflictCodes={conflictCodes}
                          curriculumMandatorySet={curriculumMandatorySet}
                          curriculumElectiveSet={curriculumElectiveSet}
                        />
                      );
                    })}
                  </>
                )}

                {/* Demais Disciplinas */}
    {nonSelectedGroups.length > 0 && (
      <>
        <button
          type="button"
          onClick={() => setOtherDisciplinesExpanded(!otherDisciplinesExpanded)}
          className="mb-1 mt-5 flex h-10 w-full items-center gap-2 border-b-2 border-foreground text-left transition-colors"
        >
          <div className="hidden"></div>
          <span className="rotulo flex flex-1 items-center justify-between gap-1 !text-foreground">
            <span>Outras disciplinas</span>
            {otherDisciplinesExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </span>
          <div className="hidden"></div>
        </button>
        {otherDisciplinesExpanded && nonSelectedGroups.map((group) =>
          turmasAbertasPara(group.courses.map((c) => c.code)) && !group.isBlockGroup ? (
            <div key={group.key}>{painelTurmas}</div>
          ) : group.isBlockGroup ? (
            <div key={group.key} className="flex flex-col gap-1.5">
            <BlockDisciplineGroupCard
              group={group}
              indexByCode={indexByCode}
              onCourseClick={handleShowSections}
              curriculumMandatorySet={curriculumMandatorySet}
              curriculumElectiveSet={curriculumElectiveSet}
            />
            {turmasAbertasPara(group.courses.map((c) => c.code)) && painelTurmas}
            </div>
          ) : (
            <DisciplineCard
              key={group.courses[0].code}
              course={group.courses[0] as Course}
              onClick={handleShowSections}
              curriculumMandatorySet={curriculumMandatorySet}
              curriculumElectiveSet={curriculumElectiveSet}
            />
          )
        )}
      </>
    )}

                {/* Se não houver nenhuma */}
                {selectedGroups.length === 0 && nonSelectedGroups.length === 0 && (
                  <div className="col-span-full text-center py-8">
                    <p className="text-muted-foreground">Nenhuma disciplina encontrada</p>
                    {searchTerm && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setSearchTerm('')}
                      >
                        Limpar busca
                      </Button>
                    )}
                  </div>
                )}
                  </>
                )}
              </>
            )}
        </div>
        </div>
      </div>
    </div>
  );

  const colunaGrade = (
    <div className="space-y-4 md:space-y-5">
      {telaLarga && <SigaaResultadoPlanejador painel={painelSigaa} onFechar={() => setPainelSigaa(null)} />}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-[-0.035em] text-foreground sm:text-2xl">Minhas grades</h2>
        <div className="flex items-center gap-2">
          <BotaoComparar ativo={comparando} onClick={() => setComparando((v) => !v)} />
          {!comparando && mySections.length > 0 && (
            <button
              type="button"
              onClick={clearSections}
              aria-label="Limpar grade"
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 px-3.5 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar grade</span>
            </button>
          )}
        </div>
      </div>
      <AbasGrades comparando={comparando} onComparar={() => setComparando(false)} />

      {comparando ? (
        <CompararGrades cargaDe={cargaDe} onAbrir={() => setComparando(false)} />
      ) : (
        <>
          <AcoesGrade cargaHoraria={cargaDaGrade} />
          {!telaLarga && (
            <div className="flex flex-col gap-3 empty:hidden">
              <SigaaAcoesPlanejador painel={painelSigaa} onPainel={setPainelSigaa} />
              <SigaaResultadoPlanejador painel={painelSigaa} onFechar={() => setPainelSigaa(null)} />
            </div>
          )}
          {mySections.length === 0 ? (
            <div className="rounded-[20px] border-[1.5px] border-dashed border-tracejado px-6 py-12 text-center">
              <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="mb-1.5 text-lg font-black tracking-[-0.02em] text-foreground">Grade vazia</h3>
              <p className="mx-auto max-w-sm text-[13px] text-foreground-2">
                Adicione turmas da lista de disciplinas para montar esta grade.
              </p>
              {!telaLarga && (
                <button
                  type="button"
                  onClick={() => setAbaMobile('disciplinas')}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-[13px] font-extrabold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" /> Adicionar disciplina
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SeletorVisaoSemana visao={visaoSemana} onVisao={trocarVisaoSemana} />
                <span className="hidden text-xs font-medium text-foreground-2 sm:inline">
                  {telaLarga ? 'Clique' : 'Toque'} num horário vazio para ver o que tem nele
                </span>
              </div>
              <div className="overflow-hidden">
                <ScheduleGrid
                  onSectionClick={(section) => setSelectedSection(section)}
                  onSlotClick={escolherSlot}
                  slotSelecionado={slotAtual}
                  compacta={visaoSemana === 'compacta'}
                />
              </div>
              <p className="-mt-1 text-xs font-medium text-foreground-2 sm:hidden">Toque num horário vazio para ver o que tem nele.</p>
              <ChoquesDaGrade
                secoes={mySections}
                onTrocar={abrirTurmasDoCodigo}
                onRemover={(t) => toggleSection(t, allSections)}
              />
              {!telaLarga && (
                <button
                  type="button"
                  onClick={() => setAbaMobile('disciplinas')}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/20 text-[13px] font-extrabold text-foreground hover:bg-nevoa"
                >
                  <Plus className="h-4 w-4" /> Adicionar disciplina
                </button>
              )}
            </>
          )}
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground-2">
            <Star className="h-3.5 w-3.5 fill-ouro text-[#B88700]" strokeWidth={1.6} />
            A grade favorita é a que aparece em Minhas turmas, no Início.
          </p>
        </>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="px-5 pt-3 sm:px-[clamp(16px,3vw,48px)] sm:pt-4 lg:pt-6 animate-fade-in">
        {pendingTransition && (
          <div className="mb-4 rounded-2xl bg-dende-claro p-3.5 text-[13px] font-medium text-dende-ink">
            <strong>Novo semestre {currentTerm}.</strong> Finalize a grade do semestre {planningTerm} na{' '}
            <a href="/" className="underline font-medium">tela inicial</a> antes de planejar novas disciplinas.
          </div>
        )}
        {/* Cabeçalho */}
        <section className="flex flex-col gap-3 pb-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:pb-5">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="rotulo !text-foreground">
              {myPrograms.length > 0 ? tituloCurso(myPrograms[0]?.title) : 'Planejador'}
              {currentTerm ? ` · Ofertas ${currentTerm}` : ''}
            </span>
            <h1 className="text-[26px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(26px,2.2vw,36px)]">
              Planejador de grade
            </h1>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            {telaLarga && seletorOfertas}
            {telaLarga && <SigaaAcoesPlanejador painel={painelSigaa} onPainel={setPainelSigaa} />}
          </div>
        </section>

        {telaLarga ? (
          <div className="grid grid-cols-[minmax(330px,420px)_minmax(0,1fr)] border-t-2 border-foreground pt-4 lg:pt-5">
            {colunaDisciplinas}
            <div className="sticky top-16 self-start pl-6 lg:pl-8 max-h-[calc(100vh-4.8rem)] overflow-y-auto overscroll-contain pr-2 pb-6 [scrollbar-width:thin]">{colunaGrade}</div>
          </div>
        ) : (
          <>
            <div className="sticky top-[60px] z-30 -mx-5 border-b-2 border-foreground bg-background/95 px-5 pb-3 pt-1 backdrop-blur sm:-mx-[clamp(20px,4vw,56px)] sm:px-[clamp(20px,4vw,56px)] md:top-0">
              <div role="tablist" aria-label="Planejador" className="grid grid-cols-2 gap-1 rounded-full bg-nevoa p-1">
                {([
                  ['grade', 'Grade', `${basesDaGrade.length}`],
                  ['disciplinas', 'Disciplinas', slotAtual ? slotTexto : ''],
                ] as const).map(([v, rotulo, extra]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={abaMobile === v}
                    onClick={() => setAbaMobile(v)}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-[13.5px] font-extrabold transition-colors',
                      abaMobile === v ? 'bg-primary text-primary-foreground' : 'text-foreground-2',
                    )}
                  >
                    {rotulo}
                    {extra && <span className="font-mono text-[11px] font-semibold opacity-75">{extra}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-5">{abaMobile === 'grade' ? colunaGrade : colunaDisciplinas}</div>
          </>
        )}

        {/* Modal de Filtros */}
        <AnimatePresence>
          {filtroModalOpen && (
            <div className="fixed inset-0 bg-overlay/55 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={handleCloseSections}>
              <motion.div 
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background px-6 pb-6 pt-5 shadow-xl sm:rounded-3xl sm:p-7" 
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-5 flex items-center justify-between border-b-2 border-foreground pb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="hidden" />
                    <h3 className="text-[23px] font-black tracking-[-0.03em] text-foreground">Filtro de disciplinas</h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFiltroModalOpen(false)}
                    className="h-11 w-11 rounded-full bg-nevoa p-0 hover:bg-trilho"
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {/* No celular, os outros filtros também moram aqui */}
                  {!telaLarga && (
                    <>
                      <div className="flex flex-col gap-2">{seletorOfertas}</div>
                      <div>
                        <div className="rotulo mb-2.5">Tipo</div>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ['all', 'Todas'],
                            ['mandatory', 'Obrigatórias'],
                            ['optional', 'Optativas'],
                            ['equivalent', 'Equivalentes'],
                            ['offered', 'Ofertadas'],
                          ] as const).map(([v, rotulo]) => (
                            <button
                              key={v}
                              type="button"
                              aria-pressed={typeFilter === v}
                              onClick={() => setTypeFilter(v)}
                              className={cn(
                                'h-10 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors',
                                typeFilter === v ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/15 hover:bg-nevoa',
                              )}
                            >
                              {rotulo}
                            </button>
                          ))}
                        </div>
                      </div>
                      {hasAnyVacancyData && (
                        <div>
                          <div className="rotulo mb-2.5">Vagas</div>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              ['all', 'Todas'],
                              ['few', 'Poucas'],
                              ['many', 'Muitas'],
                            ] as const).map(([v, rotulo]) => (
                              <button
                                key={v}
                                type="button"
                                aria-pressed={vacancyFilter === v}
                                onClick={() => setVacancyFilter(v)}
                                className={cn(
                                  'h-10 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors',
                                  vacancyFilter === v ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/15 hover:bg-nevoa',
                                )}
                              >
                                {rotulo}
                              </button>
                            ))}
                            <button
                              type="button"
                              aria-pressed={hideFull}
                              onClick={() => setHideFull(!hideFull)}
                              className={cn(
                                'h-10 rounded-full border-[1.5px] px-3.5 text-[13px] font-bold transition-colors',
                                hideFull ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/15 hover:bg-nevoa',
                              )}
                            >
                              Ocultar lotadas
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* Filtro por Dia */}
                  <div>
                    <div className="rotulo mb-2.5">Dias da semana</div>
                    <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2">
                      {diasSemana.map(dia => (
                        <label key={dia} className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-foreground/15 bg-background px-3 transition-colors hover:bg-nevoa has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                          <input
                            type="checkbox"
                            checked={diasSelecionados.includes(dia)}
                            onChange={e => {
                              if (e.target.checked) setDiasSelecionados([...diasSelecionados, dia]);
                              else setDiasSelecionados(diasSelecionados.filter(d => d !== dia));
                            }}
                            className="accent-mar"
                          />
                          <span className="text-sm font-medium">{dia}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mb-2 mt-4 text-[13px] font-extrabold text-foreground">Lógica para dias:</div>
                    <div className="grid grid-cols-2 gap-1 rounded-[18px] bg-nevoa p-1">
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaFiltroDia === 'OU'}
                          onChange={() => setLogicaFiltroDia('OU')}
                          className="accent-mar"
                        />
                        <span className="text-sm">OU (um dia ou outro)</span>
                      </label>
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaFiltroDia === 'E'}
                          onChange={() => setLogicaFiltroDia('E')}
                          className="accent-mar"
                        />
                        <span className="text-sm">E (um dia e outro)</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Filtro por Horário */}
                  <div>
                    <h4 className="rotulo mb-2.5">Horários</h4>
                    <div className="grid grid-cols-4 gap-1.5">
                      {horariosGrade.map(horario => (
                        <label key={horario} className="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-xl border-[1.5px] border-foreground/15 bg-background font-mono text-[12.5px] transition-colors hover:bg-nevoa has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                          <input
                            type="checkbox"
                            checked={horariosSelecionados.includes(horario)}
                            onChange={e => {
                              if (e.target.checked) setHorariosSelecionados([...horariosSelecionados, horario]);
                              else setHorariosSelecionados(horariosSelecionados.filter(h => h !== horario));
                            }}
                            className="accent-mar"
                          />
                          <span className="font-medium">{horario}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="mb-2 mt-4 text-[13px] font-extrabold text-foreground">Lógica para horários:</div>
                    <div className="grid grid-cols-2 gap-1 rounded-[18px] bg-nevoa p-1">
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaFiltroHorario === 'OU'}
                          onChange={() => setLogicaFiltroHorario('OU')}
                          className="accent-mar"
                        />
                        <span className="text-sm">OU (um horário ou outro)</span>
                      </label>
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaFiltroHorario === 'E'}
                          onChange={() => setLogicaFiltroHorario('E')}
                          className="accent-mar"
                        />
                        <span className="text-sm">E (um horário e outro)</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Restrições de Dias */}
                  <div>
                    <div className="rotulo mb-2.5">Restrições de dias (dias que NÃO quer)</div>
                    <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2">
                      {diasSemana.map(dia => (
                        <label key={dia} className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-foreground/15 bg-background px-3 transition-colors hover:bg-nevoa has-[:checked]:border-pitanga has-[:checked]:bg-pitanga-tint has-[:checked]:text-pitanga-ink">
                          <input
                            type="checkbox"
                            checked={diasRestritos.includes(dia)}
                            onChange={e => {
                              if (e.target.checked) setDiasRestritos([...diasRestritos, dia]);
                              else setDiasRestritos(diasRestritos.filter(d => d !== dia));
                            }}
                            className="accent-pitanga"
                          />
                          <span className="text-sm font-medium">{dia}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mb-2 mt-4 text-[13px] font-extrabold text-foreground">Lógica para restrições de dias:</div>
                    <div className="grid grid-cols-2 gap-1 rounded-[18px] bg-nevoa p-1">
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaRestricoes === 'OU'}
                          onChange={() => setLogicaRestricoes('OU')}
                          className="accent-pitanga"
                        />
                        <span className="text-sm">OU (um dia restrito ou outro)</span>
                      </label>
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaRestricoes === 'E'}
                          onChange={() => setLogicaRestricoes('E')}
                          className="accent-pitanga"
                        />
                        <span className="text-sm">E (um dia restrito e outro)</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Restrições de Horário */}
                  <div>
                    <div className="rotulo mb-2.5">Restrições de horário (horários que NÃO quer)</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {horariosGrade.map(horario => (
                        <label key={horario} className="flex h-11 cursor-pointer items-center justify-center gap-1 rounded-xl border-[1.5px] border-foreground/15 bg-background font-mono text-[12.5px] transition-colors hover:bg-nevoa has-[:checked]:border-pitanga has-[:checked]:bg-pitanga-tint has-[:checked]:text-pitanga-ink">
                          <input
                            type="checkbox"
                            checked={horariosRestritos.includes(horario)}
                            onChange={e => {
                              if (e.target.checked) setHorariosRestritos([...horariosRestritos, horario]);
                              else setHorariosRestritos(horariosRestritos.filter(h => h !== horario));
                            }}
                            className="accent-pitanga"
                          />
                          <span className="font-medium">{horario}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mb-2 mt-4 text-[13px] font-extrabold text-foreground">Lógica para restrições de horário:</div>
                    <div className="grid grid-cols-2 gap-1 rounded-[18px] bg-nevoa p-1">
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaRestricoesHorario === 'OU'}
                          onChange={() => setLogicaRestricoesHorario('OU')}
                          className="accent-pitanga"
                        />
                        <span className="text-sm">OU (um horário restrito ou outro)</span>
                      </label>
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] px-2 text-center transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                        <input
                          type="radio"
                          checked={logicaRestricoesHorario === 'E'}
                          onChange={() => setLogicaRestricoesHorario('E')}
                          className="accent-pitanga"
                        />
                        <span className="text-sm">E (um horário restrito e outro)</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="sticky bottom-0 -mx-6 flex gap-2.5 border-t border-border bg-background px-6 pb-1 pt-3.5 sm:-mx-7 sm:px-7">
                    <button
                      type="button"
                      className="h-[52px] rounded-full border-[1.5px] border-foreground/20 px-6 text-sm font-extrabold transition-colors hover:bg-nevoa"
                      onClick={limparFiltros}
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      className="h-[52px] flex-1 rounded-full bg-primary px-6 text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/85"
                      onClick={aplicarFiltros}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Celular: o horário tocado na grade abre a lista por cima */}
        <AnimatePresence>
          {!telaLarga && painelHorarioAberto && slotAtual && (
            <div className="fixed inset-0 z-50 flex items-end bg-overlay/55" onClick={limparSlot}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label={`Disciplinas com turma em ${slotTexto}`}
                className="flex max-h-[78vh] w-full flex-col rounded-t-[28px] bg-background shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-trilho" />
                <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[22px] font-bold leading-none text-foreground">{slotTexto}</span>
                    <span className="text-[13px] font-medium text-foreground-2">
                      {gruposNoSlot.length} disciplina{gruposNoSlot.length !== 1 ? 's' : ''} com turma nesse horário
                      {choqueNoSlot.size > 0 && ` · ${choqueNoSlot.size} choca${choqueNoSlot.size !== 1 ? 'm' : ''} com a grade`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={limparSlot}
                    aria-label="Fechar"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho"
                  >
                    <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto border-t border-foreground/10 px-5 py-3">
                  {gruposNoSlot.length === 0 ? (
                    <p className="py-6 text-center text-[13px] font-medium text-foreground-2">Nenhuma disciplina tem turma nesse horário com os filtros atuais.</p>
                  ) : (
                    gruposNoSlot.map((g) => renderGrupo(g, choqueNoSlot.get(g.key)))
                  )}
                </div>
                <div className="border-t border-foreground/10 px-5 pb-6 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPainelHorarioAberto(false);
                      setAbaMobile('disciplinas');
                    }}
                    className="flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-foreground/20 text-[13px] font-extrabold text-foreground hover:bg-nevoa"
                  >
                    Ver na aba Disciplinas
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Turmas Disponíveis */}
        <AnimatePresence>
          {showSections && selectedCourse && !telaLarga && (
            <div className="fixed inset-0 bg-overlay/55 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={handleCloseSections}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="max-h-[calc(100vh-56px)] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-background px-6 pb-8 pt-2.5 shadow-xl sm:rounded-[28px] sm:p-7"
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-trilho sm:hidden" />
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[13px] font-semibold text-foreground-2">{selectedCourse.code}</span>
                    <p className="mt-1.5 text-2xl font-black uppercase leading-[1.08] tracking-[-0.03em] text-foreground">{selectedCourse.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseSections}
                    aria-label="Fechar"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho"
                  >
                    <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  {isLoadingSections ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="w-8 h-8 animate-spin text-mar" />
                      <p className="text-sm text-muted-foreground">Carregando informações da disciplina...</p>
                    </div>
                  ) : (
                    <SectionsList 
                      courseCode={selectedCourse.code}
                      currentTerm={currentTerm}
                      onCourseClick={handleShowSectionsNoFilters}
                      diasSelecionados={applyFiltersToSections ? diasSelecionados : []}
                      horariosSelecionados={applyFiltersToSections ? horariosSelecionados : []}
                      diasRestritos={applyFiltersToSections ? diasRestritos : []}
                      horariosRestritos={applyFiltersToSections ? horariosRestritos : []}
                      hasAnyVacancyData={hasAnyVacancyData}
                      hideFull={applyFiltersToSections ? hideFull : false}
                      vacancyFilter={applyFiltersToSections ? vacancyFilter : 'all'}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Detalhes da Seção */}
        {selectedSection && (
          <SectionDetailModal 
            section={selectedSection}
            onClose={() => setSelectedSection(null)}
            onRemove={() => {
              toggleSection(selectedSection, allSections);
              setSelectedSection(null);
            }}
            onCourseClick={handleShowSectionsNoFilters}
          />
        )}
      </div>
    </MainLayout>
  );
};

// Componente para o modal de detalhes da seção com informações da disciplina
function SectionDetailModal({ 
  section, 
  onClose, 
  onRemove,
  onCourseClick
}: { 
  section: Section; 
  onClose: () => void;
  onRemove: () => void;
  onCourseClick: (course: Course) => void;
}) {
  const courseCode = (section as any)?.course?.code || (section as any)?.course_code || '';
  const detailCourseCode = isBlockCourseCode(courseCode) ? getBlockCourseBaseCode(courseCode) : courseCode;
  const { data: courseDetail } = useCourseByCode(detailCourseCode);
  const courseName = courseDetail?.name || (section as any)?.course?.name || 'Nome não disponível';
  const { currentTerm } = useCurrentTerm();
  
  // Buscar todas as seções para encontrar correspondentes de blocos
  const { data: allSections = [] } = useSections();
  
  // Buscar turmas pelo código do bloco (ex.: MATB59.1)
  const { data: courseSections = [] } = useCourseSections(courseCode);
  
  // Buscar todas as disciplinas para pré-requisitos e disciplinas liberadas
  const { data: allCourses = [] } = useCourses();
  
  // Encontrar disciplinas liberadas (onde esta disciplina é pré-requisito)
  const unlockedCourses = useMemo(() => {
    if (!courseCode || !allCourses.length) return [];
    
    return allCourses.filter(course => {
      // Pular a própria disciplina
      if (course.code === courseCode) return false;
      
      // Simulação similar à do SectionsList
      const commonUnlocked = [
        'CALCULO1', 'CALCULO2', 'ALGORITMOS', 'PROG1', 'PROG2', 
        'ESTRUTURAS', 'BD1', 'BD2', 'REDES', 'SO'
      ];
      
      return commonUnlocked.includes(course.code) && Math.random() > 0.7;
    }).slice(0, 5);
  }, [courseCode, allCourses]);
  
  // Filtrar apenas turmas da mesma disciplina
  const sameCourseSections = useMemo(() => {
    const sectionCourseCode = (section as any)?.course?.code || (section as any)?.course_code;
    const baseCode = getBlockCourseBaseCode(sectionCourseCode);
    
    return allSections.filter(s => {
      const sCourseCode = (s as any)?.course?.code || (s as any)?.course_code;
      const sBaseCode = getBlockCourseBaseCode(sCourseCode);
      return sBaseCode === baseCode;
    });
  }, [allSections, section]);
  
  // Filtrar outras turmas (excluindo a turma atual)
  const otherSections = sameCourseSections.filter(s => s.id_ref !== section.id_ref);
  
  // Estados para controlar seções recolhíveis
  const [openPrereq, setOpenPrereq] = useState(false);
  const [openCoreq, setOpenCoreq] = useState(false);
  const [openOtherSections, setOpenOtherSections] = useState(false);
  const [openCurrentSections, setOpenCurrentSections] = useState(false); // Recolhido por padrão
  const [openUnlocked, setOpenUnlocked] = useState(false);
  
  // Função para normalizar cursos (SyncedCourse | NotSyncedCourse)
  const normalizeCourse = (course: any) => {
    if (typeof course === 'string') {
      return { code: course, name: course };
    }
    return {
      code: course.code || course,
      name: course.name || course.code || course
    };
  };
  
  const { getConflictsForSection, toggleSection, hasSection, getSectionForCourse } = useMySections('ativa');
  const { myPrograms } = useMyPrograms();
  const myProgramTitles = new Set(myPrograms.map(p => (p.title || '').trim().toLowerCase()));
  
  // Componente para cabeçalho de seção recolhível
  const SectionHeader = ({
    title,
    count,
    open,
    onToggle,
  }: { title: string; count?: number; open: boolean; onToggle: () => void }) => (
    <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <h4 className="text-base font-black text-foreground">{title}</h4>
        {typeof count === 'number' && count > 0 && (
          <Badge variant="secondary" className="px-2 py-0.5 text-xs">
            {count}
          </Badge>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-nevoa"
        aria-label={open ? 'Recolher' : 'Expandir'}
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-overlay/55 flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background px-6 pb-6 pt-5 shadow-xl sm:rounded-3xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-mono text-[13px] font-semibold text-mar-ink">{courseCode}</h3>
            <p className="mt-1 text-[23px] font-black uppercase leading-[1.12] tracking-[-0.025em] text-foreground">{courseName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        
        <div className="space-y-6">
          <div className="border-t-2 border-foreground pt-3">
            <SectionHeader
              title="Turmas ofertadas"
              count={sameCourseSections.length}
              open={openCurrentSections}
              onToggle={() => setOpenCurrentSections(!openCurrentSections)}
            />
            {openCurrentSections && (
              <div className="pt-4 space-y-3">
                <SectionCard section={section} isCurrentSection />
                {otherSections.length > 0 && (
                  <>
                    {otherSections.map((s) => (
                      <SectionCard key={s.id_ref} section={s} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Pré-requisitos */}
          {courseDetail?.prerequisites && courseDetail.prerequisites.length > 0 && (
            <div className="border-t-2 border-foreground pt-3">
              <SectionHeader
                title="Pré-requisitos"
                count={courseDetail.prerequisites.length}
                open={openPrereq}
                onToggle={() => setOpenPrereq(!openPrereq)}
              />
              {openPrereq && (
                <div className="pt-4 space-y-2">
                  {courseDetail.prerequisites.map((prereqGroup, idx) => (
                    <div key={idx} className="space-y-1">
                      {prereqGroup.length > 1 && (
                        <p className="text-xs text-muted-foreground mb-1">Opção {idx + 1}:</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {prereqGroup.map((prereq: any, pIdx: number) => {
                          const normalized = normalizeCourse(prereq);
                          const course = allCourses.find(c => c.code === normalized.code);
                          const isAvailable = course && (course.sections_count || 0) > 0;
                          
                          return (
                            <div key={pIdx} className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors",
                                  !isAvailable && "opacity-60 cursor-not-allowed hover:bg-muted"
                                )}
                                onClick={() => course && isAvailable && onCourseClick(course)}
                                title={course ? (isAvailable ? `Ver detalhes de ${course.name}` : `${course.name} - Não disponível neste período`) : `Disciplina: ${normalized.code}`}
                              >
                                {normalized.code} {normalized.name ? `- ${normalized.name}` : ''}
                              </Badge>
                              {!isAvailable && (
                                <Badge variant="secondary" className="text-xs text-muted-foreground">
                                  Não disponível neste período
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Disciplinas liberadas por esta disciplina */}
          {unlockedCourses.length > 0 && (
            <div className="border-t-2 border-foreground pt-3">
              <SectionHeader
                title="Disciplinas liberadas por esta"
                count={unlockedCourses.length}
                open={openUnlocked}
                onToggle={() => setOpenUnlocked(!openUnlocked)}
              />
              {openUnlocked && (
                <div className="pt-4 space-y-2">
                  {unlockedCourses.map((course) => (
                    <div key={course.code} className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => onCourseClick(course)}
                          title={`Ver detalhes de ${course.name}`}
                        >
                          {course.code} - {course.name}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Disciplinas liberadas (corequisitos) */}
          {courseDetail?.corequisites && courseDetail.corequisites.length > 0 && (
            <div className="border-t-2 border-foreground pt-3">
              <SectionHeader
                title="Disciplinas liberadas por ela"
                count={courseDetail.corequisites.length}
                open={openCoreq}
                onToggle={() => setOpenCoreq(!openCoreq)}
              />
              {openCoreq && (
                <div className="pt-4 space-y-2">
                  {courseDetail.corequisites.map((coreqGroup, idx) => (
                    <div key={idx} className="space-y-1">
                      {coreqGroup.length > 1 && (
                        <p className="text-xs text-muted-foreground mb-1">Opção {idx + 1}:</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {coreqGroup.map((coreq: any, cIdx: number) => (
                          <Badge key={cIdx} variant="outline" className="text-xs">
                            {coreq.code} {coreq.name ? `- ${coreq.name}` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Informações da turma atual */}
          <div className="border rounded-lg p-4 md:p-6 bg-muted/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs md:text-sm px-3 py-1">
                  {(section as any)?.section_code || section.id_ref}
                </Badge>
                <Badge variant="outline" className="text-xs md:text-sm px-3 py-1">
                  {((section as any)?.seats_count ?? 0) === 0 
                    ? 'Sem informação' 
                    : `${(section as any)?.seats_count} vagas`}
                </Badge>
                {(() => {
                  const conflicts = getConflictsForSection(section);
                  if (conflicts.length > 0) {
                    return (
                      <Badge variant="destructive" className="text-xs md:text-sm px-3 py-1">
                        Conflito de horário
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="mt-2 md:mt-0 px-4 py-2 text-xs md:text-sm flex items-center gap-2"
                onClick={onRemove}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remover da Grade
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-muted-foreground">Docente:</span>
                  <p className="mt-1">
                    {Array.isArray((section as any)?.teachers) && (section as any).teachers.length > 0
                      ? (section as any).teachers.join(', ')
                      : ((section as any)?.professor || 'Professor(a) não definido')}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Período:</span>
                  <p className="mt-1">{(section as any)?.period || (section as any)?.term || currentTerm || 'Não informado'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-muted-foreground">Horários:</span>
                  <p className="mt-1">
                    {Array.isArray(section.time_codes) && section.time_codes.length > 0
                      ? section.time_codes.join(', ')
                      : 'Horário não definido'}
                  </p>
                  {(() => {
                    const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
                    const horariosParsed = parseTimeCodes(timeCodes);
                    return (
                      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: horariosParsed.length <= 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                        {horariosParsed.length > 0 ? (
                          horariosParsed.map((h, idx) => (
                            <span key={idx} className="inline-block bg-muted px-2 py-1 rounded text-xs font-mono min-h-[40px] flex flex-col items-start justify-center">
                              <span className="font-semibold">{h.dia}</span>
                              <span className="text-[10px]">{h.horarioInicio} - {h.horarioFim}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Horário não informado</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Informações de vagas */}
            {((section as any)?.seats_count ?? 0) > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    Vagas: {(section as any)?.seats_accepted ?? 0}/{(section as any)?.seats_count ?? 0}
                  </span>
                  <span>
                    {Math.round((((section as any)?.seats_accepted ?? 0) / ((section as any)?.seats_count ?? 1)) * 100)}% preenchido
                  </span>
                </div>
                <Progress 
                  value={Math.round((((section as any)?.seats_accepted ?? 0) / ((section as any)?.seats_count ?? 1)) * 100)} 
                  className="h-2" 
                />
              </div>
            )}

            {/* Conflitos */}
            {(() => {
              const conflicts = getConflictsForSection(section);
              if (conflicts.length > 0) {
                const uniqueConflicts = conflicts.reduce((acc, conflict) => {
                  const conflictSection = conflict.section;
                  const conflictCode = (conflictSection as any)?.course?.code || (conflictSection as any)?.course_code || 'N/A';
                  if (!acc.find(c => c.code === conflictCode)) {
                    acc.push({
                      code: conflictCode,
                      name: (conflictSection as any)?.course?.name || 'Nome não disponível',
                      section: conflictSection
                    });
                  }
                  return acc;
                }, [] as Array<{ code: string; name: string; section: Section }>);

                return (
                  <div className="mt-4 pt-4 border-t border-destructive/20">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
                      <span className="font-semibold text-destructive">Conflitos de horário detectados:</span>
                    </div>
                    <div className="space-y-2">
                      {uniqueConflicts.map((conflict, idx) => {
                        const conflictTimeCodes = Array.isArray(conflict.section.time_codes) ? conflict.section.time_codes : [];
                        const conflictHorariosParsed = parseTimeCodes(conflictTimeCodes);
                        
                        return (
                          <div key={idx} className="p-3 bg-destructive/10 border-2 border-destructive/50 shadow-destructive/10 rounded-lg flex gap-2 items-center">
                            <span className="flex items-center px-1 py-0.5 bg-destructive text-white text-xs rounded select-none"><AlertTriangle className="w-3 h-3 mr-1"/> Conflito</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-destructive text-xs mb-0.5 truncate">
                                {conflict.code}
                              </div>
                              <div className="text-muted-foreground text-[10px] mb-1 truncate">
                                {conflict.name}
                              </div>
                              {conflictHorariosParsed.length > 0 && (
                                <div className="grid gap-1 mt-0.5" style={{ gridTemplateColumns: conflictHorariosParsed.length <= 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                                  {conflictHorariosParsed.map((h, hIdx) => (
                                    <span key={hIdx} className="inline-block bg-destructive/20 text-destructive rounded px-2 py-1 text-xs font-mono border border-destructive/30 min-h-[40px] flex flex-col items-start justify-center">
                                      <span className="font-semibold">{h.dia}</span>
                                      <span className="text-[10px]">{h.horarioInicio} - {h.horarioFim}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-destructive mt-3 italic font-semibold flex gap-2 items-center">
                      <AlertTriangle className="w-4 h-4" /> Há choque de horário com outra(s) turma(s) selecionada(s).
                    </p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para exibir card de uma seção
function SectionCard({ section, isCurrentSection = false }: { section: Section; isCurrentSection?: boolean }) {
  const { toggleSection, hasSectionOnCourse, getConflictsForSection, hasSection, getSectionForCourse } = useMySections('ativa');
  const { data: allSections = [] } = useSections();
  const { myPrograms } = useMyPrograms();
  const myProgramTitles = new Set(myPrograms.map(p => (p.title || '').trim().toLowerCase()));
  
  // Determinar se esta é a turma atual da disciplina
  const currentSectionOfCourse = getSectionForCourse((section as any)?.course?.code || (section as any)?.course_code || '');
  const isActuallyCurrentSection = currentSectionOfCourse?.id_ref === section.id_ref;
  
  const courseCode = (section as any)?.course?.code || (section as any)?.course_code || '';
  const teachers = Array.isArray((section as any)?.teachers) 
    ? (section as any).teachers 
    : ((section as any)?.professor ? [(section as any).professor] : []);
  const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
  const seatsAccepted = (section as any)?.seats_accepted ?? 0;
  const seatsCount = (section as any)?.seats_count ?? 0;
  const progress = seatsCount > 0 ? Math.min(100, Math.max(0, Math.round((seatsAccepted / seatsCount) * 100))) : 0;
  const isSelected = hasSection(section.id_ref);
  const currentSection = getSectionForCourse(courseCode);
  const isOtherSectionOfSameCourse = currentSection && currentSection.id_ref !== section.id_ref;
  const conflicts = getConflictsForSection(section);
  const hasConflict = conflicts.length > 0;
  const horariosParsed = parseTimeCodes(timeCodes);
  
  return (
    <div className={cn(
      "border rounded-lg p-3 bg-card",
      isActuallyCurrentSection && "border-primary/50 bg-primary/5",
      hasConflict && "border-destructive/50"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {(section as any)?.section_code || section.id_ref}
            </Badge>
            {isActuallyCurrentSection && (
              <Badge variant="default" className="text-xs">Turma Atual</Badge>
            )}
                        {hasConflict && (
              <Badge variant="destructive" className="text-xs">Conflito</Badge>
            )}
            {isSelected && (
              <Badge variant="outline" className="text-xs">Na Grade</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {teachers.length > 0 ? teachers.join(', ') : 'Professor(a) não definido'}
          </div>
        </div>
        {!isActuallyCurrentSection && (
          <Button
            size="sm"
            variant={isSelected ? "destructive" : "default"}
            onClick={() => toggleSection(section, allSections)}
            className="text-xs"
          >
            {isSelected ? 'Remover' : isOtherSectionOfSameCourse ? 'Substituir' : 'Adicionar'}
          </Button>
        )}
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <span className="font-semibold text-muted-foreground">Horários:</span>
          <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: horariosParsed.length <= 4 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
            {horariosParsed.length > 0 ? (
              horariosParsed.map((h, idx) => (
                <span key={idx} className="inline-block bg-muted px-2 py-1 rounded text-xs font-mono min-h-[40px] flex flex-col items-start justify-center">
                  <span className="font-semibold">{h.dia}</span>
                  <span className="text-[10px]">{h.horarioInicio} - {h.horarioFim}</span>
                </span>
              ))
            ) : (
              <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded">Horário não informado</span>
            )}
          </div>
        </div>
        
        {seatsCount > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Vagas: {seatsAccepted}/{seatsCount}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: retorna o selo de lotação baseado no percentual de ocupação
function VacancyStatusBadge({ seatsAccepted, seatsCount }: { seatsAccepted: number; seatsCount: number }) {
  if (seatsCount === 0) return null;
  const pct = seatsCount > 0 ? (seatsAccepted / seatsCount) * 100 : 0;
  const free = seatsCount - seatsAccepted;

  if (free === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Lotada
      </span>
    );
  }
  if (free <= 10) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        {free} vaga{free !== 1 ? 's' : ''}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      {free} vaga{free !== 1 ? 's' : ''}
    </span>
  );
}

// Componente para listar as seções de uma disciplina
function SectionsList({ 
  courseCode, 
  currentTerm,
  onCourseClick,
  diasSelecionados,
  horariosSelecionados,
  diasRestritos,
  horariosRestritos,
  hasAnyVacancyData,
  hideFull,
  vacancyFilter,
  compacto = false
}: { 
  compacto?: boolean;
  courseCode: string;
  currentTerm: string | null;
  onCourseClick: (course: Course) => void;
  diasSelecionados: string[];
  horariosSelecionados: string[];
  diasRestritos: string[];
  horariosRestritos: string[];
  hasAnyVacancyData?: boolean;
  hideFull?: boolean;
  vacancyFilter?: 'all' | 'few' | 'many';
}) {
  const { data: sections = [], isLoading } = useCourseSections(courseCode);
  const { data: allSections = [] } = useSections();
  const detailCourseCode = isBlockCourseCode(courseCode) ? getBlockCourseBaseCode(courseCode) : courseCode;
  const { toggleSection, hasSectionOnCourse, getConflictsForSection, hasSection, getSectionForCourse } = useMySections('ativa');
  const { myPrograms } = useMyPrograms();
  const myProgramTitles = new Set(myPrograms.map(p => (p.title || '').trim().toLowerCase()));

  const sectionsThisTerm = useMemo(
    () => filterSectionsByCurrentTerm(sections, currentTerm),
    [sections, currentTerm]
  );
  
  // Filtrar turmas com base nos filtros de dias e horários
  const filteredSections = useMemo(() => {
    if (!sectionsThisTerm.length) return sectionsThisTerm;
    
    // Se não há filtros aplicados, retorna todas as seções do semestre vigente
    if (diasSelecionados.length === 0 && horariosSelecionados.length === 0 && 
        diasRestritos.length === 0 && horariosRestritos.length === 0 &&
        !hideFull && (!vacancyFilter || vacancyFilter === 'all')) {
      return sectionsThisTerm;
    }

    const selectedDias = diasSelecionados
      .map(d => mapSiglaParaNome[d as keyof typeof mapSiglaParaNome])
      .filter(Boolean);
    const restrictedDias = diasRestritos
      .map(d => mapSiglaParaNome[d as keyof typeof mapSiglaParaNome])
      .filter(Boolean);
    
    return sectionsThisTerm.filter(section => {
      // Filtros de Vagas
      if (hasAnyVacancyData) {
        const seatsAccepted = (section as any)?.seats_accepted ?? 0;
        const seatsCount = (section as any)?.seats_count ?? 0;
        const freeSeats = Math.max(0, seatsCount - seatsAccepted);
        
        if (hideFull && freeSeats === 0 && seatsCount > 0) return false;
        if (vacancyFilter === 'few' && (freeSeats > 10 || freeSeats === 0 || seatsCount === 0)) return false;
        if (vacancyFilter === 'many' && (freeSeats <= 10 || seatsCount === 0)) return false;
      }

      const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
      if (timeCodes.length === 0) return true; // Se não tem horários definidos, inclui
      
      // Parse dos códigos de horário
      const horariosParsed = parseTimeCodes(timeCodes);
      
      // Verificar filtros de dias selecionados
      if (selectedDias.length > 0) {
        const temDiaSelecionado = horariosParsed.some(h => 
          selectedDias.includes(h.dia)
        );
        if (!temDiaSelecionado) return false;
      }
      
      // Verificar filtros de horários selecionados (usa horário de início)
      if (horariosSelecionados.length > 0) {
        const temHorarioSelecionado = horariosParsed.some(h => 
          horariosSelecionados.includes(h.horarioInicio)
        );
        if (!temHorarioSelecionado) return false;
      }
      
      // Verificar restrições de dias
      if (restrictedDias.length > 0) {
        const temDiaRestrito = horariosParsed.some(h => 
          restrictedDias.includes(h.dia)
        );
        if (temDiaRestrito) return false;
      }
      
      // Verificar restrições de horários (usa horário de início)
      if (horariosRestritos.length > 0) {
        const temHorarioRestrito = horariosParsed.some(h => 
          horariosRestritos.includes(h.horarioInicio)
        );
        if (temHorarioRestrito) return false;
      }
      
      return true;
    });
  }, [sectionsThisTerm, diasSelecionados, horariosSelecionados, diasRestritos, horariosRestritos]);
  
  // Buscar detalhes da disciplina para pré-requisitos e corequisitos
  const { data: courseDetail } = useCourseByCode(detailCourseCode);
  
  // Buscar todas as disciplinas para encontrar as que são liberadas por esta
  const { data: allCourses = [] } = useCourses();
  
  // Encontrar disciplinas liberadas (onde esta disciplina é pré-requisito)
  const unlockedCourses = useMemo(() => {
    if (!courseCode || !allCourses.length) return [];
    
    return allCourses.filter(course => {
      // Pular a própria disciplina
      if (course.code === courseCode) return false;
      
      // Por enquanto, vamos mostrar algumas disciplinas como exemplo
      // Em um cenário real, precisaríamos verificar os pré-requisitos de cada disciplina
      // Para performance, vamos limitar a algumas disciplinas comuns
      const commonUnlocked = [
        'CALCULO1', 'CALCULO2', 'ALGORITMOS', 'PROG1', 'PROG2', 
        'ESTRUTURAS', 'BD1', 'BD2', 'REDES', 'SO'
      ];
      
      return commonUnlocked.includes(course.code) && Math.random() > 0.7; // Simulação simples
    }).slice(0, 5); // Limitar a 5 disciplinas para performance
  }, [courseCode, allCourses]);
  
  // Função para normalizar cursos (SyncedCourse | NotSyncedCourse)
  const normalizeCourse = (course: any) => {
    if (typeof course === 'string') {
      return { code: course, name: course };
    }
    return {
      code: course.code || course,
      name: course.name || course.code || course
    };
  };
  
  // Estados para controlar seções recolhíveis
  const [openPrereq, setOpenPrereq] = useState(false);
  const [openCoreq, setOpenCoreq] = useState(false);
  const [openOtherSections, setOpenOtherSections] = useState(false);
  const [openUnlocked, setOpenUnlocked] = useState(false);
  
  // Componente para cabeçalho de seção recolhível
  const SectionHeader = ({
    title,
    count,
    open,
    onToggle,
  }: { title: string; count?: number; open: boolean; onToggle: () => void }) => (
    <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <h4 className="text-base font-black text-foreground">{title}</h4>
        {typeof count === 'number' && count > 0 && (
          <span className="rounded-full bg-nevoa px-[9px] py-0.5 font-mono text-xs font-semibold">{count}</span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-nevoa"
        aria-label={open ? 'Recolher' : 'Expandir'}
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (filteredSections.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nenhuma turma disponível para esta disciplina com os filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className={compacto ? 'flex flex-col' : 'space-y-6'}>
      {/* Pré-requisitos */}
      {!compacto && courseDetail?.prerequisites && courseDetail.prerequisites.length > 0 && (
        <div className="border-t-2 border-foreground pt-3">
          <SectionHeader
            title="Pré-requisitos"
            count={courseDetail.prerequisites.length}
            open={openPrereq}
            onToggle={() => setOpenPrereq(!openPrereq)}
          />
          {openPrereq && (
            <div className="pt-4 space-y-2">
              {courseDetail.prerequisites.map((prereqGroup, idx) => (
                <div key={idx} className="space-y-1">
                  {prereqGroup.length > 1 && (
                    <p className="text-xs text-muted-foreground mb-1">Opção {idx + 1}:</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {prereqGroup.map((prereq, pIdx) => {
                      const normalized = normalizeCourse(prereq);
                      const course = allCourses.find(c => c.code === normalized.code);
                      const isAvailable = course && (course.sections_count || 0) > 0;
                      
                      return (
                        <div key={pIdx} className="flex items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "cursor-pointer rounded-full border-0 bg-nevoa px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                              !isAvailable && "cursor-not-allowed opacity-60 hover:bg-nevoa hover:text-foreground"
                            )}
                            onClick={() => course && isAvailable && onCourseClick(course)}
                            title={course ? (isAvailable ? `Ver detalhes de ${course.name}` : `${course.name} - Não disponível neste período`) : `Disciplina: ${normalized.code}`}
                          >
                            {normalized.code} {normalized.name ? `- ${normalized.name}` : ''}
                          </Badge>
                          {!isAvailable && (
                            <Badge variant="secondary" className="text-xs text-muted-foreground">
                              Não disponível neste período
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Disciplinas liberadas por esta disciplina */}
      {!compacto && unlockedCourses.length > 0 && (
        <div className="border-t-2 border-foreground pt-3">
          <SectionHeader
            title="Disciplinas liberadas por esta"
            count={unlockedCourses.length}
            open={openUnlocked}
            onToggle={() => setOpenUnlocked(!openUnlocked)}
          />
          {openUnlocked && (
            <div className="pt-4 space-y-2">
              {unlockedCourses.map((course) => (
                <div key={course.code} className="space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer rounded-full border-0 bg-nevoa px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                      onClick={() => onCourseClick(course)}
                      title={`Ver detalhes de ${course.name}`}
                    >
                      {course.code} - {course.name}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Lista de turmas disponíveis */}
      <div className={compacto ? 'flex flex-col' : 'flex flex-col border-t-2 border-foreground'}>
        {(() => {
          // Detectar se o sistema de vagas está ativo: alguma turma tem seats_accepted > 0
          const vacancySystemActive = filteredSections.some(
            (s) => ((s as any)?.seats_accepted ?? 0) > 0 && ((s as any)?.seats_count ?? 0) > 0
          );

          return filteredSections.map((section) => {
            const teachers = Array.isArray((section as any)?.teachers) 
              ? (section as any).teachers 
              : ((section as any)?.professor ? [(section as any).professor] : []);
            const timeCodes = Array.isArray(section.time_codes) ? section.time_codes : [];
            const seatsAccepted = (section as any)?.seats_accepted ?? 0;
            const seatsCount = (section as any)?.seats_count ?? 0;
            const progress = seatsCount > 0 ? Math.min(100, Math.round((seatsAccepted / seatsCount) * 100)) : 0;
            const freeSeats = Math.max(0, seatsCount - seatsAccepted);
            const isSelected = hasSection(section.id_ref);
            const conflicts = getConflictsForSection(section);
            const hasConflict = conflicts.length > 0;
            const hasExclusive = Array.isArray((section as any)?.spots_reserved) && 
              ((section as any).spots_reserved as any[]).some((r: any) => {
                const t = ((r as any)?.program?.title || '').trim().toLowerCase();
                return t && myProgramTitles.has(t);
              });
            const reservedRemaining = getReservedUnfilledForTitles(section as any, myProgramTitles);
            const horariosParsed = parseTimeCodes(timeCodes);

            const currentSection = getSectionForCourse(courseCode);
            const isOtherSectionOfSameCourse = currentSection && currentSection.id_ref !== section.id_ref;
            const isActuallyCurrentSection = currentSection?.id_ref === section.id_ref;
            
            // Cor da barra de progresso baseada nas vagas livres
            const progressBarColor = freeSeats === 0
              ? 'bg-red-500'
              : freeSeats <= 10
              ? 'bg-amber-500'
              : 'bg-green-500';
            
            const turmaNome = (section as any)?.section_code || section.id_ref;
            const DIA_CURTO: Record<string, string> = { Segunda: 'SEG', 'Terça': 'TER', Quarta: 'QUA', Quinta: 'QUI', Sexta: 'SEX', 'Sábado': 'SÁB' };
            const resumoHorario = (() => {
              const porDia = new Map<string, string[]>();
              horariosParsed.forEach((h) => {
                const l = porDia.get(h.dia) ?? [];
                l.push(h.horarioInicio);
                porDia.set(h.dia, l);
              });
              return Array.from(porDia.entries()).map(([d, hs]) => `${DIA_CURTO[d] ?? d} ${hs.join(' · ')}`).join(' / ');
            })();
            const porDiaCompleto = (() => {
              const porDia = new Map<string, { inicio: string; fim: string }[]>();
              horariosParsed.forEach((h) => {
                const l = porDia.get(h.dia) ?? [];
                l.push({ inicio: h.horarioInicio, fim: h.horarioFim });
                porDia.set(h.dia, l);
              });
              return Array.from(porDia.entries());
            })();
            const rotuloAcao = isSelected ? 'Remover' : isOtherSectionOfSameCourse ? 'Substituir' : 'Adicionar';
            const pilulaVagas = seatsCount === 0
              ? null
              : vacancySystemActive
                ? freeSeats === 0
                  ? { texto: 'Lotado', cls: 'bg-pitanga-tint text-pitanga-ink', ponto: 'bg-pitanga' }
                  : freeSeats <= 10
                    ? { texto: `${freeSeats} vaga${freeSeats !== 1 ? 's' : ''}`, cls: 'bg-dende-tint text-dende-ink', ponto: 'bg-dende' }
                    : { texto: `${freeSeats} vagas`, cls: 'bg-mar-tint text-mar-ink', ponto: 'bg-mar' }
                : { texto: `${seatsCount} vagas`, cls: 'bg-nevoa text-foreground-2', ponto: 'bg-tracejado' };

            const botao = (
              <button
                type="button"
                onClick={() => toggleSection(section, allSections)}
                disabled={isSelected && hasConflict}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-full font-extrabold transition-colors disabled:opacity-50',
                  compacto ? 'mt-1 min-h-10 self-start px-4 text-[12.5px]' : 'min-h-12 w-full text-[15px]',
                  isSelected ? 'bg-pitanga text-white hover:bg-pitanga/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {isSelected ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" strokeWidth={2.6} />}
                {rotuloAcao}
              </button>
            );

            const selos = (
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {isActuallyCurrentSection && <span className="rounded-full bg-mar px-2 py-[3px] text-[10.5px] font-extrabold text-white">Na grade</span>}
                {hasConflict && !isActuallyCurrentSection && <span className="rounded-full bg-pitanga-tint px-2 py-[3px] text-[10.5px] font-extrabold text-pitanga-ink">Conflito</span>}
                {hasExclusive && reservedRemaining > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mar-tint px-2 py-[3px] text-[10.5px] font-extrabold text-mar-ink">
                    <Star className="h-2.5 w-2.5 fill-current" /> Reservado · {reservedRemaining} vagas
                  </span>
                )}
                {pilulaVagas && (
                  <span className={cn('inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold', pilulaVagas.cls)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', pilulaVagas.ponto)} />
                    {pilulaVagas.texto}
                  </span>
                )}
              </span>
            );

            if (compacto) {
              return (
                <div key={section.id_ref} className="flex flex-col gap-1.5 border-t border-foreground/10 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[13px] font-black', freeSeats === 0 && vacancySystemActive ? 'text-foreground-2' : 'text-foreground')}>
                      Turma <span className="font-mono font-semibold">{turmaNome}</span>
                    </span>
                    {selos}
                  </div>
                  <span className={cn('text-[12.5px]', teachers.length > 0 ? 'uppercase text-foreground-2' : 'text-foreground')}>
                    {teachers.length > 0 ? teachers.join(', ') : 'Nenhum professor informado'}
                  </span>
                  <span className="font-mono text-[11.5px] text-foreground-2">
                    {resumoHorario || 'Horário a definir'}
                    {seatsCount > 0 && ` · ${seatsAccepted}/${seatsCount}`}
                  </span>
                  {botao}
                </div>
              );
            }

            return (
              <div key={section.id_ref} className="flex flex-col gap-4 border-b border-foreground/10 py-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xl font-black tracking-[-0.02em] text-foreground">
                    Turma <span className="font-mono font-medium">{turmaNome}</span>
                  </span>
                  {selos}
                </div>

                {botao}

                <div className="flex flex-col gap-1">
                  <span className="rotulo">Docente</span>
                  <span className={cn('text-sm', teachers.length > 0 ? 'font-bold uppercase text-foreground' : 'font-medium text-foreground-2')}>
                    {teachers.length > 0 ? teachers.join(', ') : 'Nenhum professor informado para a turma'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="rotulo">Período</span>
                    <span className="font-mono text-sm text-foreground">{(section as any)?.period || (section as any)?.term || currentTerm || 'Não informado'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="rotulo">Horários</span>
                    <span className="font-mono text-sm text-foreground">{timeCodes.length > 0 ? timeCodes.join(', ') : 'Não definido'}</span>
                  </div>
                </div>

                {porDiaCompleto.length > 0 ? (
                  porDiaCompleto.map(([dia, faixas]) => (
                    <div key={dia} className="flex flex-col gap-2">
                      <span className="text-[13px] font-extrabold text-foreground">{dia}</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {faixas.map((f, i) => (
                          <span key={i} className="rounded-xl bg-nevoa px-3 py-2.5 font-mono text-[13px] text-foreground">
                            {f.inicio} – {f.fim}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="rounded-xl bg-pitanga-tint px-3 py-2 text-xs font-semibold text-pitanga-ink">Horário não informado</span>
                )}

                {vacancySystemActive && seatsCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[13px] font-semibold text-foreground-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {seatsAccepted} preenchido{seatsAccepted !== 1 ? 's' : ''} · {freeSeats} livre{freeSeats !== 1 ? 's' : ''} de {seatsCount}
                      </span>
                      <span className={cn('font-mono font-semibold', freeSeats === 0 ? 'text-pitanga' : freeSeats <= 10 ? 'text-dende-ink' : 'text-mar')}>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-trilho">
                      <div className={cn('h-full rounded-full', freeSeats === 0 ? 'bg-pitanga' : freeSeats <= 10 ? 'bg-dende' : 'bg-mar')} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {!vacancySystemActive && !hasExclusive && (
                  <span className="self-start rounded-full bg-nevoa px-2.5 py-[3px] text-[11px] font-extrabold text-foreground-2">Sem reservas para o curso</span>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export default Planejador;
