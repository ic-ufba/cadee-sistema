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

  if (!synced) {
    return (
      <div
        className={cn(
          'group relative rounded-[18px] border-[1.5px] border-dashed border-tracejado bg-nevoa px-5 py-4',
          'flex flex-col gap-2 opacity-90',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[13px] font-bold text-foreground-2">{code}</span>
          {shouldShowCompletedButton && (
            <button
              onClick={handleCompletedClick}
              className={cn(
                'flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors',
                isCompleted ? 'bg-mar text-white' : 'text-foreground/30 hover:text-foreground/60',
              )}
              aria-label={isCompleted ? 'Desmarcar como cursada' : 'Marcar como cursada'}
            >
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                <span className="block h-[22px] w-[22px] rounded-full border-[1.5px] border-current" />
              )}
            </button>
          )}
        </div>

        <h3 className="text-sm font-extrabold uppercase text-foreground">Não disponível</h3>
        <p className="text-xs text-muted-foreground">Essa disciplina ainda não está sincronizada.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative cursor-pointer rounded-[18px] border-[1.5px] border-foreground/10 bg-background px-5 py-4',
        'flex h-full flex-col transition-all duration-200 hover:bg-nevoa',
        isCompleted && 'border-transparent bg-mar-claro hover:bg-mar-claro',
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "font-mono text-[13px] font-bold",
          isCompleted ? "text-mar-ink" :
          "text-mar"
        )}>{code}</span>
        <div className="flex items-center gap-1">
          {!isEquivalent && <FavoriteButton active={favorite} onToggle={() => toggleFavorite(code)} />}
          {shouldShowCompletedButton && (
            <button
              onClick={handleCompletedClick}
              className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors', isCompleted ? 'bg-mar text-white' : 'text-foreground/30 hover:text-foreground/60')}
              aria-label={isCompleted ? 'Desmarcar como cursada' : 'Marcar como cursada'}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <span className="block h-[22px] w-[22px] rounded-full border-[1.5px] border-current" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="mb-2 line-clamp-2 text-sm font-extrabold uppercase leading-snug text-foreground">{name ?? code}</h3>
        {typeof (summary as any)?.workload === 'number' && (
          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{(summary as any).workload}h</span>
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-foreground/10 pt-2">
        <div className="flex items-center justify-between">
          {isCompleted && (
            <span className="inline-flex items-center rounded-full bg-mar px-2.5 py-0.5 text-[10px] font-bold text-white sm:text-[11px]">Cursada</span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{sectionsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
