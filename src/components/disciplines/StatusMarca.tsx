import { cn } from '@/lib/utils';

export type TipoStatus = 'cursada' | 'disponivel' | 'bloqueada' | 'grade';

/** Marcas de status do catálogo (identidade: cursada, disponível, bloqueada, na grade). */
export function StatusMarca({ tipo, size = 16, className }: { tipo: TipoStatus; size?: number; className?: string }) {
  const cls = cn('shrink-0', className);
  if (tipo === 'cursada') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="11" className="fill-mar" />
        <path d="M8.4 12.3l2.5 2.5 4.8-5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tipo === 'disponivel') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" className="stroke-dende" strokeWidth="2.6" />
      </svg>
    );
  }
  if (tipo === 'bloqueada') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" className="stroke-muted-foreground" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cls} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" className="stroke-foreground" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" className="fill-foreground" />
    </svg>
  );
}
