import { useState } from 'react';
import { BookOpenText, ChevronDown, ChevronUp, Loader2, Radio } from 'lucide-react';
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
        'inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success',
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
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-card-foreground">
          <BookOpenText className="h-4 w-4 text-primary" />
          Programa da disciplina
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
          {isLoading && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando o SIGAA…
            </p>
          )}
          {isError && <p className="text-muted-foreground">Não foi possível consultar o programa agora.</p>}
          {!isLoading && !isError && (!programa || secoes.length === 0) && (
            <p className="text-muted-foreground">O departamento ainda não cadastrou o programa desta disciplina no SIGAA.</p>
          )}
          {programa && secoes.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {programa.periodo ? `Vigente desde ${programa.periodo}` : 'Programa atual'}
                </span>
                <LiveDataBadge />
              </div>
              {secoes.map((s) => (
                <div key={s.key}>
                  <h4 className="mb-1 font-medium text-card-foreground">{s.titulo}</h4>
                  <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{programa[s.key]}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
