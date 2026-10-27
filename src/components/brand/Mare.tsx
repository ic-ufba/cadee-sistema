// CADEE — "A maré": medidor de progresso (componente puramente visual).
// Recebe a porcentagem JÁ CALCULADA pelo sistema. Não calcula nada de negócio.
// O mar (verde-mar) sobe sobre a areia clara até a porcentagem.
import { animate, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function ondaPath(size: number, amp: number) {
  const s = size;
  const h = amp * 2;
  return `M0 ${amp} C ${s * 0.125} 0, ${s * 0.375} 0, ${s / 2} ${amp} S ${s * 0.875} ${h}, ${s} ${amp} S ${s * 1.375} 0, ${s * 1.5} ${amp} S ${s * 1.875} ${h}, ${s * 2} ${amp} V${h} H0 Z`;
}

type MareProps = {
  /** 0–100 */
  percent: number;
  /** diâmetro em px */
  size?: number;
  /** onda correndo devagar (use só no medidor grande) */
  ondaAnimada?: boolean;
  className?: string;
};

export function Mare({ percent, size = 200, ondaAnimada = true, className }: MareProps) {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const amp = Math.max(3, Math.round(size * 0.05));
  const y = p >= 99.9 ? -amp - 2 : size * (1 - p / 100);

  return (
    <div
      aria-hidden
      className={cn("relative shrink-0 overflow-hidden rounded-full bg-areia", className)}
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ y: reduce ? y : size }}
        animate={{ y }}
        transition={{ duration: reduce ? 0 : 1.6, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <motion.svg
          width={size * 2}
          height={amp * 2}
          viewBox={`0 0 ${size * 2} ${amp * 2}`}
          className="absolute left-0 fill-mar"
          style={{ top: -amp }}
          animate={ondaAnimada && !reduce ? { x: [0, -size] } : undefined}
          transition={{ duration: 5, ease: "linear", repeat: Infinity }}
        >
          <path d={ondaPath(size, amp)} />
        </motion.svg>
        <div className="absolute inset-x-0 bottom-0 bg-mar" style={{ top: amp - 1 }} />
      </motion.div>
    </div>
  );
}

/** Número que conta junto com a maré (ex.: "59.1%") */
export function PercentAnimado({ value, casas = 1, sufixo = "%" }: { value: number; casas?: number; sufixo?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(shown, value, { duration: 1.6, ease: [0.2, 0.7, 0.2, 1], onUpdate: setShown });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return (
    <>
      {shown.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}
      {sufixo}
    </>
  );
}

/** Círculo de semestre: 100% = mar cheio + ✓ sutil; 0% = contorno tracejado; entre = nível do mar. */
export function SemestreCirculo({ percent, size = 56 }: { percent: number; size?: number }) {
  if (percent <= 0) {
    return (
      <span
        aria-hidden
        className="block rounded-full border-[1.5px] border-dashed border-tracejado bg-nevoa"
        style={{ width: size, height: size }}
      />
    );
  }
  if (percent >= 100) {
    return (
      <span aria-hidden className="flex items-center justify-center rounded-full bg-mar text-white" style={{ width: size, height: size }}>
        <Check style={{ width: size * 0.34, height: size * 0.34 }} strokeWidth={2.2} />
      </span>
    );
  }
  return <Mare percent={percent} size={size} ondaAnimada={false} />;
}
