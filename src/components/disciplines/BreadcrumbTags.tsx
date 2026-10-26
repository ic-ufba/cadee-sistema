import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  code: string;
}

interface BreadcrumbTagsProps {
  items: Crumb[];
  onSelectIndex: (index: number) => void;
}

export function BreadcrumbTags({ items, onSelectIndex }: BreadcrumbTagsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div key={`${item.code}-${idx}`} className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                'inline-block px-3 py-1 rounded-lg text-sm font-semibold',
                isLast ? 'bg-primary/10 text-mar cursor-default' : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
              onClick={() => !isLast && onSelectIndex(idx)}
              disabled={isLast}
            >
              {item.code}
            </button>
            {!isLast && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

