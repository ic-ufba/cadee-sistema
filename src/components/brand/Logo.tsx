// CADEE — logo (componente puramente visual)
import { cn } from "@/lib/utils";

type LogoProps = {
  /** tamanho da fonte em px (header mobile 25, desktop 28) */
  size?: number;
  className?: string;
};

export function Logo({ size = 25, className }: LogoProps) {
  return (
    <span
      className={cn("font-black leading-none tracking-[-0.05em] text-foreground select-none", className)}
      style={{ fontSize: size }}
    >
      cadee<span className="text-dende">.</span>
    </span>
  );
}

/** Assinatura do onboarding: logo + filete + nome por extenso */
export function LogoAssinatura({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <Logo size={28} />
      <span aria-hidden className="w-[1.5px] self-stretch rounded-full bg-foreground/15" />
      <span className="text-[11px] font-semibold leading-[1.35] text-foreground-2">
        Catálogo Auxiliar de Disciplinas
        <br />
        e Estruturação de Estudos
      </span>
    </div>
  );
}
