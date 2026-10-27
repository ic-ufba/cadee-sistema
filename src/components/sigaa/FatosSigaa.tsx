import { useMemo } from 'react';
import { useSigaaAuth, useSigaaPlanejamento } from '@/hooks/useSigaa';
import { SeloSigaa } from '@/components/sigaa/IndicesSigaa';
import { cn } from '@/lib/utils';

/**
 * Quadro discreto com o que o SIGAA sabe desta disciplina para o aluno logado:
 * semestre ideal (e se está atrasada), situação do pré-requisito e o que ela destrava.
 * Sem login, ou se a disciplina não está entre as candidatas do período, não aparece.
 */
export function FatosSigaa({ code, className }: { code: string; className?: string }) {
  const { isLoggedIn } = useSigaaAuth();
  const planejamento = useSigaaPlanejamento(isLoggedIn);
  const candidato = useMemo(
    () => planejamento.data?.candidatos.find((c) => c.codigo.toUpperCase() === code.toUpperCase()) ?? null,
    [planejamento.data, code],
  );

  if (!isLoggedIn || !candidato) return null;

  const rotulo = 'text-[10px] font-extrabold uppercase tracking-[0.1em] text-foreground-2';
  const valor = 'text-[13px] font-extrabold';

  const preReq =
    candidato.apto === true
      ? { texto: candidato.pre_requisitos ? 'cumprido' : 'nenhum', cor: 'text-mar-ink' }
      : candidato.apto === false
        ? { texto: candidato.faltando_minimo.length ? `falta ${candidato.faltando_minimo.join(' · ')}` : 'pendente', cor: 'text-pitanga-ink' }
        : { texto: 'não informado', cor: 'text-foreground-2' };

  return (
    <div className={cn('flex flex-col gap-2.5 rounded-2xl bg-nevoa px-4 py-3.5', className)}>
      <SeloSigaa className="self-start" />
      <div className="grid grid-cols-3 gap-2.5">
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className={rotulo}>Semestre</span>
          <span className={cn(valor, candidato.atrasado ? 'text-dende-ink' : 'text-foreground')}>
            {candidato.semestre_ideal ? `${candidato.semestre_ideal}º` : '—'}
            {candidato.atrasado && ' · atrasada'}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className={rotulo}>Pré-requisito</span>
          <span className={cn(valor, preReq.cor, 'break-words')}>{preReq.texto}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className={rotulo}>Destrava</span>
          <span className="break-words font-mono text-xs font-bold text-foreground">
            {candidato.desbloqueia.length ? candidato.desbloqueia.join(' · ') : '—'}
          </span>
        </span>
      </div>
      {candidato.reprovacoes_anteriores > 0 && (
        <span className="text-xs font-semibold text-foreground-2">
          Você já cursou {candidato.reprovacoes_anteriores === 1 ? '1 vez' : `${candidato.reprovacoes_anteriores} vezes`} sem aprovação.
        </span>
      )}
    </div>
  );
}
