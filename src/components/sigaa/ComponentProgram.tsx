import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Radio } from 'lucide-react';
import { SeloSigaa } from '@/components/sigaa/IndicesSigaa';
import { useComponentProgram } from '@/hooks/useApi';
import { isSigaaApiConfigured } from '@/services/sigaaApi';
import { cn } from '@/lib/utils';

const SECOES: Array<{ key: 'objetivos' | 'conteudo' | 'metodologia' | 'avaliacao' | 'competencias_habilidades' | 'referencias'; titulo: string }> = [
  { key: 'objetivos', titulo: 'Objetivos' },
  { key: 'conteudo', titulo: 'Conteúdo programático' },
  { key: 'metodologia', titulo: 'Metodologia' },
  { key: 'avaliacao', titulo: 'Avaliação' },
  { key: 'competencias_habilidades', titulo: 'Competências e habilidades' },
  { key: 'referencias', titulo: 'Referências' },
];

/** Selo discreto indicando que o dado veio ao vivo do SIGAA. */
export function LiveDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-mar-claro px-2.5 py-0.5 text-[10px] font-bold text-mar-ink',
        className,
      )}
      title="Atualizado agora pelo SIGAA público"
    >
      <Radio className="h-3 w-3" />
      SIGAA ao vivo
    </span>
  );
}

/**
 * Programa da disciplina (objetivos, conteúdo, referências) vindo do SIGAA público.
 * Só busca quando o aluno abre a seção, porque cada consulta vai até o SIGAA.
 */
export function ComponentProgram({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const { data: programa, isLoading, isError } = useComponentProgram(code, open);

  if (!isSigaaApiConfigured) return null;

  const secoes = programa ? SECOES.filter((s) => programa[s.key]?.trim()) : [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[58px] w-full items-center gap-2.5 text-left text-foreground"
        aria-expanded={open}
      >
        <h3 className="text-base font-black tracking-[-0.01em]">Programa da disciplina</h3>
        <SeloSigaa />
        <span className="flex-1" />
        {open ? <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2.2} />}
      </button>

      {open && (
        <div className="flex flex-col gap-3.5 pb-5 pt-1 text-[13px]">
          {isLoading && (
            <p className="flex items-center gap-2 text-foreground-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando o SIGAA…
            </p>
          )}
          {isError && <p className="text-foreground-2">Não foi possível consultar o programa agora.</p>}
          {!isLoading && !isError && (!programa || secoes.length === 0) && (
            <p className="text-foreground-2">O departamento ainda não cadastrou o programa desta disciplina no SIGAA.</p>
          )}
          {programa &&
            secoes.map((s) => (
              <div key={s.key} className="flex flex-col gap-1">
                <h4 className="text-[13px] font-extrabold text-foreground">{s.titulo}</h4>
                <p className="whitespace-pre-line leading-[1.55] text-foreground-2">{programa[s.key]}</p>
              </div>
            ))}
          {programa && secoes.length > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {programa.periodo ? `vigente desde ${programa.periodo}` : 'programa atual'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
