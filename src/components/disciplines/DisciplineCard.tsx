import { Clock, Check, Users, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { Course } from '@/services/api';
import { useMode } from '@/hooks/useMode';
import { useFavoriteCourses } from '@/hooks/useFavoriteCourses';
import { FavoriteButton } from '@/components/common/FavoriteButton';

interface DisciplineCardProps {
  discipline: Course;
  onClick: () => void;
  available?: boolean;
  blocked?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isFailed?: boolean;
  isDropped?: boolean;
  onToggleCompleted?: (code: string) => void | Promise<void>;
  onRestrictedAction?: (type: 'completed' | 'favorite', course: Course) => void | Promise<void>;
}

export function DisciplineCard({ 
  discipline, 
  onClick, 
  available, 
  blocked, 
  isSelected, 
  isCompleted: isCompletedProp,
  isFailed: isFailedProp,
  isDropped: isDroppedProp,
  onToggleCompleted,
  onRestrictedAction 
}: DisciplineCardProps) {
  const { completedDisciplines, toggleCompletedDiscipline, getDisciplineStatus } = useApp();
  const { isSimplified } = useMode();
  const { isFavorite, toggleFavorite } = useFavoriteCourses();

  const status = getDisciplineStatus(discipline.code);
  // Na tela Disciplinas: failed / dropped NÃO são exibidos. Se reprovada/trancada, volta para status padrão.
  // Ou seja: se status é failed/dropped, considera como se não tivesse nenhum status especial
  const isFailed = false;
  const isDropped = false;
  // Apenas approved OU completedDisciplines contam como cursada (failed/dropped cancelam o completed)
  const hasFailedOrDroppedStatus = (isFailedProp !== undefined ? isFailedProp : (status === 'failed')) || (isDroppedProp !== undefined ? isDroppedProp : (status === 'dropped'));
  let isCompleted = isCompletedProp !== undefined ? isCompletedProp : (completedDisciplines.includes(discipline.code) || status === 'approved');
  if (hasFailedOrDroppedStatus) isCompleted = false;
  const favorite = isFavorite(discipline.code);
  const showCompletedStyles = isCompleted;
  const showFailedStyles = false;
  const showDroppedStyles = false;
  const showBlocked = !!blocked;
  const showAvailable = !!available;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRestrictedAction) {
      onRestrictedAction('favorite', discipline);
    } else {
      toggleFavorite(discipline.code);
    }
  };

  const handleCompletedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Se já está cursada, permite desmarcar diretamente sem modal
    if (isCompleted) {
      if (onToggleCompleted) {
        onToggleCompleted(discipline.code);
      } else {
        toggleCompletedDiscipline(discipline.code);
      }
    } else if (onRestrictedAction) {
      onRestrictedAction('completed', discipline);
    } else {
      if (onToggleCompleted) {
        onToggleCompleted(discipline.code);
      } else {
        toggleCompletedDiscipline(discipline.code);
      }
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        "group relative min-h-[140px] cursor-pointer rounded-[18px] border-[1.5px] border-foreground/10 bg-background pb-3 pl-3.5 pr-2 pt-2",
        "flex h-full flex-col gap-1",
        "transition-colors duration-200 hover:border-foreground/30",
        showCompletedStyles && "border-mar/30 bg-mar-claro hover:border-mar/50",
        isSelected && !showCompletedStyles && "border-2 border-foreground bg-background hover:border-foreground",
        !showCompletedStyles && !isSelected && showAvailable && "border-dende/40 bg-dende-claro hover:border-dende/70",
        !showCompletedStyles && !isSelected && showBlocked && "border-dashed border-foreground/20 bg-nevoa text-muted-foreground"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "pt-2 font-mono text-xs font-semibold",
            showCompletedStyles
              ? "text-mar-ink"
              : isSelected
              ? "text-foreground"
              : showAvailable
              ? "text-dende-ink"
              : showBlocked
              ? "text-muted-foreground"
              : "text-foreground-2"
          )}
        >
          {discipline.code}
        </span>
        <div className="flex items-center gap-1">
          <motion.button
            onClick={handleCompletedClick}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              isCompleted
                ? "text-white"
                : isSelected
                ? "text-foreground"
                : showAvailable
                ? "text-dende"
                : "text-tracejado hover:text-foreground"
            )}
            whileHover={{ scale: 1.08 }}
          >
            <span className={cn("relative block h-[26px] w-[26px] rounded-full", isCompleted ? "bg-mar" : "bg-background")}>
              {/* Static circle border always present */}
              <span className={cn("absolute inset-0 rounded-full border-current", isCompleted ? "border-0" : showBlocked && !isSelected ? "border-[1.5px] border-dashed" : "border-2")} />
              {!isCompleted && isSelected && <span className="absolute inset-[7px] rounded-full bg-foreground" />}
              <AnimatePresence mode="wait" initial={false}>
                {isCompleted && (
                  <motion.span
                    key="check"
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 0.6, rotate: -180 }}
                    animate={{ opacity: 1, scale: [0.6, 1.1, 1], rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: -180 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1">
        <h3 className={cn("mb-1.5 line-clamp-3 text-[12.5px] font-extrabold uppercase leading-[1.25] sm:text-[13.5px]", showBlocked && !isCompleted && !isSelected ? "text-muted-foreground" : "text-foreground")}>
          {discipline.name}
        </h3>

        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          {typeof (discipline as any).workload === 'number' && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{(discipline as any).workload}h</span>
            </div>
          )}
          {typeof (discipline as any).credits === 'number' && (
            <span>{(discipline as any).credits} créditos</span>
          )}
        </div>

        {(discipline as any).prerequisites?.length > 0 && (
          <p className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">
            Pré-req: {(discipline as any).prerequisites?.join(', ')}
          </p>
        )}
      </div>

      {/* Rodapé compacto com status e contador de turmas */}
      <div className="mt-auto pr-1.5 pt-2">
        <div className="flex items-center justify-between">
          {/* Reserve space to avoid layout shift (empty component) */}
          <div className="flex h-6 items-center gap-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {isCompleted && (
                <motion.span
                  key="tag-cursada"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="inline-flex items-center rounded-full bg-mar px-2.5 py-[3px] text-[10.5px] font-extrabold text-white"
                >
                  Cursada
                </motion.span>
              )}
              {!isCompleted && isSelected && (
                <motion.span
                  key="tag-selecionada"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="inline-flex items-center rounded-full bg-primary px-2.5 py-[3px] text-[10.5px] font-extrabold text-primary-foreground"
                >
                  Selecionada
                </motion.span>
              )}
            </AnimatePresence>
            {!isCompleted && !isSelected && showAvailable && (
              <span className="inline-flex items-center rounded-full bg-dende px-2.5 py-[3px] text-[10.5px] font-extrabold text-foreground dark:text-background">
                Disponível
              </span>
            )}
            {!isCompleted && !isSelected && !showAvailable && showBlocked && (
              <span className="inline-flex items-center rounded-full bg-trilho px-2.5 py-[3px] text-[10.5px] font-extrabold text-foreground-2">
                Bloqueada
              </span>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 font-mono text-[11.5px] text-foreground-2">
            <Users className="h-[13px] w-[13px]" />
            <span>{(discipline as any).sections_count ?? 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
