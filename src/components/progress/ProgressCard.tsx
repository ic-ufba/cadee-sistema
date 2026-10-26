import { TrendingUp } from 'lucide-react';
import { InfoPopup } from '@/components/ui/info-popup';
import { cn } from '@/lib/utils';

export type ProgressCategory = 'mandatory' | 'elective' | 'complementary' | 'general';

interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  showInfo?: boolean;
  infoText?: string;
  isEstimated?: boolean;
  category?: ProgressCategory;
  className?: string;
}

const CATEGORY_STYLES: Record<ProgressCategory, { bar: string; excessText: string }> = {
  mandatory: {
    bar: 'bg-mar',
    excessText: 'text-mar-ink',
  },
  elective: {
    bar: 'bg-dende',
    excessText: 'text-dende-ink',
  },
  complementary: {
    bar: 'bg-ouro',
    excessText: 'text-foreground-2',
  },
  general: {
    bar: 'bg-foreground',
    excessText: 'text-foreground-2',
  },
};

export function ProgressCard({
  title,
  current,
  total,
  showInfo = false,
  infoText = '',
  isEstimated = false,
  category,
  className,
}: ProgressCardProps) {
  const rawPercentage = total > 0 ? (current / total) * 100 : 0;
  const percentage = Math.min(100, Math.round(rawPercentage));
  const excess = current > total ? current - total : 0;

  const inferredCategory: ProgressCategory =
    category ||
    (title.toLowerCase().includes('obrigat')
      ? 'mandatory'
      : title.toLowerCase().includes('optat')
      ? 'elective'
      : title.toLowerCase().includes('comp')
      ? 'complementary'
      : 'general');

  const styles = CATEGORY_STYLES[inferredCategory];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', styles.bar)} />
          <h3 className="text-[15px] font-extrabold text-foreground">{title}</h3>
          {showInfo && (
            <InfoPopup
              iconClassName="w-3.5 h-3.5"
              content={infoText}
            />
          )}
          {isEstimated && (
            <InfoPopup
              customTrigger={
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-dende">
                  <TrendingUp className="w-2 h-2 text-white" />
                </div>
              }
              content="Valor estimado. Importe seu histórico para dados precisos."
            />
          )}
        </div>
        <span className="text-2xl font-black tracking-[-0.04em] text-foreground">
          {percentage}%
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-trilho">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isEstimated ? 'bg-amber-500' : styles.bar
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{Math.min(current, total)} / {total} horas</span>
        {excess > 0 ? (
          <span className={cn('font-medium', styles.excessText)}>
            +{excess}h excedentes
          </span>
        ) : isEstimated ? (
          <span className="font-sans font-bold text-dende-ink">
            Estimado
          </span>
        ) : null}
      </div>
    </div>
  );
}
