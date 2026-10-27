import { Clock, Check, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { useFavoriteCourses } from '@/hooks/useFavoriteCourses';
import { Course } from '@/services/api';
import { FavoriteButton } from '@/components/common/FavoriteButton';

interface LargeDisciplineCardProps {
  // Código da disciplina (obrigatório em ambos os casos)
  code: string;
  // Se "synced" verdadeiro, exibe nome, favoritos e contador de turmas
  synced?: boolean;
  // Nome quando sincronizada
  name?: string;
  // Resumo (opcional) para obter dados como sections_count
  summary?: Partial<Course> | null;
  // Clique habilitado apenas quando synced
  onClick?: () => void;
  // Se é equivalente (esconde coração)
  isEquivalent?: boolean;
  // Se deve mostrar botão de marcar como cursada
  showCompletedButton?: boolean;
  // Callback para ação restrita (bloqueio)
  onRestrictedAction?: (type: 'completed' | 'favorite', course: Course, mainCode?: string) => void | Promise<void>;
  // Dados do curso para verificar bloqueio
  courseData?: Course | null;
  // Código da disciplina principal (para equivalentes)
  mainCode?: string;
  // Pré-requisitos da equivalente
  equivPrerequisites?: any[];
}

export function LargeDisciplineCard({ 
  code, 
  synced = false, 
  name, 
  summary, 
  onClick, 
  isEquivalent = false,
  showCompletedButton = true,
  onRestrictedAction,
  courseData,
  mainCode,
  equivPrerequisites
}: LargeDisciplineCardProps) {
  const { completedDisciplines, toggleCompletedDiscipline, getDisciplineStatus, setDisciplineStatus, clearDisciplineStatus } = useApp();
  const { isFavorite, toggleFavorite } = useFavoriteCourses();

  const status = getDisciplineStatus(code);
  // Na tela Disciplinas: failed / dropped NÃO são exibidos. Apenas cancela o cursada.
  const hasFailedOrDropped = status === 'failed' || status === 'dropped';
  const isFailed = false;
  const isDropped = false;
  // failed / dropped cancela completed mas não mostra selo
  let isCompleted = completedDisciplines.includes(code) || status === 'approved';
  if (hasFailedOrDropped) isCompleted = false;
  const favorite = isFavorite(code);
  const sectionsCount = (summary as any)?.sections_count ?? 0;

  // Disciplinas não sincronizadas nunca devem mostrar botão de marcar como cursada
  const shouldShowCompletedButton = synced && showCompletedButton;

  // Verificar se equivalente tem pré-requisitos bloqueados
  const hasEquivPrereqs = equivPrerequisites && equivPrerequisites.length > 0;
  const hasEquivPrereqsDone = hasEquivPrereqs ? equivPrerequisites.some((option: any[]) => {
    if (!option || option.length === 0) return false;
    return option.every((prereq: any) => completedDisciplines.includes(prereq.code || prereq));
  }) : true; // Se não tem pré-requisitos, considera como disponível (não bloqueado)

  const handleCompletedClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Helper: toggle um único código entre completed (approved) e não-completed
    const toggleSingle = (c: string) => {
      const cStatus = getDisciplineStatus(c);
      const isCurCompleted = completedDisciplines.includes(c) || cStatus === 'approved';
      if (isCurCompleted) {
        // Desmarcar sempre permitido
        if (completedDisciplines.includes(c)) {
          toggleCompletedDiscipline(c);
        } else if (cStatus === 'approved') {
          clearDisciplineStatus(c);
        }
      } else {
        // Marcar como completed
        if (onRestrictedAction && courseData && !isEquivalent) {
          // Somente chama onRestrictedAction para marcar (não para desmarcar)
          // mas para large card, equivalentes usam mainCode → vamos tratar depois
        }
        if (!completedDisciplines.includes(c)) {
          toggleCompletedDiscipline(c);
          setDisciplineStatus(c, 'approved');
        }
      }
    };

    const relatedCodes = new Set<string>([code]);
    if (mainCode && mainCode !== code) relatedCodes.add(mainCode);

    // Marcar/desmarcar completed: se for equivalente + mainCode, marca os dois sempre
    // (o usuário não pode desfazer de um sem o outro — mesma regra antiga, mas funciona para desmarcar também)
    if (isCompleted) {
      // DESMARCAÇÃO (sempre permitido, sem restrições)
      relatedCodes.forEach(toggleSingle);
      return;
    }

    // MARCAÇÃO (sujeita a bloqueio se aplicável)
    if (isEquivalent && hasEquivPrereqs && !hasEquivPrereqsDone) {
      if (onRestrictedAction && courseData) {
        onRestrictedAction('completed', courseData, mainCode);
        return;
      }
      return;
    }

    if (onRestrictedAction && courseData) {
      onRestrictedAction('completed', courseData, mainCode);
    } else {
      relatedCodes.forEach(toggleSingle);
    }
  };

  const anel = (
    <span
      className={cn(
        'flex h-[26px] w-[26px] items-center justify-center rounded-full',
        isCompleted ? 'bg-mar text-white' : isEquivalent ? 'border-2 border-dende' : 'border-2 border-foreground/30'
      )}
    >
      {isCompleted && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
    </span>
  );

  if (!synced) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-foreground/10 py-3.5 last:border-b-0">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs font-semibold text-muted-foreground">{code}</span>
          <span className="text-sm font-extrabold leading-tight text-muted-foreground">Não disponível</span>
          <span className="text-xs font-medium leading-relaxed text-muted-foreground">Essa disciplina ainda não está sincronizada.</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {shouldShowCompletedButton && (
            <button
              onClick={handleCompletedClick}
              className="-mb-1 -mr-2.5 -mt-2 flex h-11 w-11 items-center justify-center"
              aria-label={isCompleted ? `Desmarcar como cursada: ${code}` : `Marcar como cursada: ${code}`}
            >
              {anel}
            </button>
          )}
          <span className="whitespace-nowrap rounded-full bg-trilho px-[9px] py-[3px] text-[10.5px] font-extrabold text-foreground-2">Indisponível</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-foreground/10 py-3.5 transition-colors last:border-b-0 hover:bg-nevoa/50"
      onClick={onClick}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn('font-mono text-xs font-semibold', isCompleted ? 'text-mar-ink' : isEquivalent ? 'text-dende-ink' : 'text-foreground-2')}>
          {code}
        </span>
        <span className="text-sm font-extrabold uppercase leading-tight text-foreground">{name ?? code}</span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center">
          {!isEquivalent && <FavoriteButton active={favorite} onToggle={() => toggleFavorite(code)} />}
          {shouldShowCompletedButton && (
            <button
              onClick={handleCompletedClick}
              className="-mb-1 -mr-2.5 -mt-2 flex h-11 w-11 items-center justify-center"
              aria-label={isCompleted ? `Desmarcar como cursada: ${code}` : `Marcar como cursada: ${code}`}
            >
              {anel}
            </button>
          )}
        </div>
        <span className="flex items-center gap-1 font-mono text-[11.5px] text-foreground-2" aria-label={`${sectionsCount} turmas`}>
          <Users className="h-[13px] w-[13px]" />
          {sectionsCount}
        </span>
      </div>
    </div>
  );
}
