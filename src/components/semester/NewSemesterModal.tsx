import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface NewSemesterModalProps {
  open: boolean;
  planningTerm: string | null;
  currentTerm: string | null;
  unresolvedCodes: string[];
  canAdvance: boolean;
  onAdvance: () => void;
  onResolveOnHome: () => void;
}

export function NewSemesterModal({
  open,
  planningTerm,
  currentTerm,
  unresolvedCodes,
  canAdvance,
  onAdvance,
  onResolveOnHome,
}: NewSemesterModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-t-[28px] bg-background p-6 pb-8 shadow-xl sm:rounded-[28px] sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="hidden">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">
                  {canAdvance ? 'Pronto para o novo semestre' : 'Novo semestre disponível'}
                </p>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                  {canAdvance ? (
                    <>
                      Todas as disciplinas do semestre <strong>{planningTerm}</strong> foram finalizadas.
                      Avance para o semestre <strong>{currentTerm}</strong>.
                    </>
                  ) : (
                    <>
                      O semestre letivo mudou de <strong>{planningTerm}</strong> para <strong>{currentTerm}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-sm text-foreground leading-relaxed">
                Para iniciar o planejamento do novo semestre, finalize as disciplinas da grade anterior:
                remova cada turma ou marque o <strong>resultado</strong> (cursada, reprovada ou trancada).
              </p>
              <p className="text-xs text-muted-foreground">
                Suas marcações de progresso serão mantidas. Apenas a grade de planejamento será limpa ao avançar.
              </p>

              {unresolvedCodes.length > 0 && (
                <div className="rounded-[18px] bg-dende-claro p-4">
                  <div className="mb-2.5 flex items-center gap-2 text-[13px] font-extrabold text-dende-ink">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {unresolvedCodes.length} disciplina{unresolvedCodes.length > 1 ? 's' : ''} pendente{unresolvedCodes.length > 1 ? 's' : ''}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unresolvedCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] font-bold text-dende-ink"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {canAdvance && (
                <div className="flex items-start gap-2 rounded-[18px] bg-mar-claro p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mar" />
                  <p className="text-xs font-semibold text-mar-ink">
                    Todas as disciplinas foram finalizadas. Você pode avançar para o semestre {currentTerm}.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              {!canAdvance && (
                <button
                  type="button"
                  onClick={onResolveOnHome}
                  className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                >
                  Resolver na tela inicial
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onAdvance}
                disabled={!canAdvance}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/85 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Iniciar semestre {currentTerm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
