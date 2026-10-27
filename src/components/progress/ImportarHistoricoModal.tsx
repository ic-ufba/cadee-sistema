import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, Upload, X } from 'lucide-react';

interface ImportarHistoricoModalProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descricao: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  texto: string;
  onTextoChange: (texto: string) => void;
  /** Lê o texto colado (chamado ao colar e ao sair do campo). */
  onTextoPronto: (texto: string) => void;
  isParsing: boolean;
  erro?: string;
  detectadas: number;
  onCancelar: () => void;
  onAplicar: () => void;
  rotuloAplicar: string;
  children?: ReactNode;
}

/** Gaveta (mobile) / diálogo (desktop) de importação do histórico escolar — só apresentação. */
export function ImportarHistoricoModal({
  open,
  onClose,
  titulo,
  descricao,
  onFileChange,
  texto,
  onTextoChange,
  onTextoPronto,
  isParsing,
  erro,
  detectadas,
  onCancelar,
  onAplicar,
  rotuloAplicar,
  children,
}: ImportarHistoricoModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-start sm:p-4 sm:pt-[12vh]"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-importar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-background sm:max-w-[520px] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-trilho sm:hidden" />

            <div className="flex flex-col gap-3 overflow-y-auto px-6 pb-5 pt-3.5 sm:gap-[18px] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="rotulo !text-foreground hidden sm:block">Histórico escolar</span>
                  <h2 id="titulo-importar" className="pt-1.5 text-2xl font-black leading-[1.1] tracking-[-0.03em] text-foreground sm:pt-0">
                    {titulo}
                  </h2>
                  <p className="text-[13.5px] font-medium leading-relaxed text-foreground-2 sm:text-[13px]">{descricao}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                </button>
              </div>

              {/* Arquivo: o input cobre a área, então dá para clicar ou arrastar o PDF */}
              <label className="relative mt-2 flex h-16 cursor-pointer items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-foreground/25 text-[14.5px] font-extrabold text-foreground transition-colors hover:bg-nevoa sm:mt-0 sm:h-auto sm:min-h-[120px] sm:flex-col sm:gap-2 sm:rounded-xl sm:border-tracejado sm:bg-nevoa/50 sm:text-sm">
                <Upload className="h-[19px] w-[19px] sm:h-[22px] sm:w-[22px] sm:text-mar" strokeWidth={2.1} />
                <span>{isParsing ? 'Lendo PDF…' : 'Selecionar PDF'}</span>
                <span className="hidden text-xs font-medium text-foreground-2 sm:block">ou arraste o arquivo aqui</span>
                <input
                  type="file"
                  accept=".pdf,text/plain"
                  onChange={onFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Selecionar PDF do histórico"
                />
              </label>

              <div className="flex flex-col gap-2">
                <label htmlFor="historico-texto" className="text-xs font-bold text-foreground">
                  Ou cole o texto do histórico
                </label>
                <textarea
                  id="historico-texto"
                  rows={3}
                  value={texto}
                  onChange={(e) => onTextoChange(e.target.value)}
                  onPaste={(e) => {
                    const colado = e.clipboardData.getData('text');
                    if (colado.trim()) setTimeout(() => onTextoPronto(colado), 0);
                  }}
                  onBlur={(e) => {
                    if (e.target.value.trim()) onTextoPronto(e.target.value);
                  }}
                  className="w-full resize-y rounded-xl border-0 bg-nevoa p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>

              {erro && <p className="rounded-xl bg-pitanga-tint px-3.5 py-2.5 text-[13px] font-semibold text-pitanga-ink">{erro}</p>}
              {!erro && detectadas > 0 && (
                <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mar" />
                  {detectadas} disciplina{detectadas > 1 ? 's' : ''} aprovada{detectadas > 1 ? 's' : ''} detectada{detectadas > 1 ? 's' : ''}
                </p>
              )}

              {children}

              <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 sm:flex sm:gap-2">
                <Lock className="mt-px h-[18px] w-[18px] text-foreground-2 sm:mt-0.5 sm:h-3.5 sm:w-3.5" strokeWidth={2.1} />
                <div className="flex flex-col gap-1">
                  <span className="text-[13.5px] font-extrabold text-foreground sm:hidden">Privacidade</span>
                  <p className="text-[12.5px] font-medium leading-relaxed text-foreground-2 sm:text-xs">
                    <span className="sm:hidden">
                      Seu histórico não é armazenado em nenhum local. É utilizado apenas para extração de texto sobre as disciplinas e progresso, sendo automaticamente descartado após a extração.
                    </span>
                    <span className="hidden sm:inline">
                      Seu histórico não é armazenado: ele só é lido para extrair as disciplinas cursadas.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-foreground/10 px-6 pb-[22px] pt-3.5 sm:justify-end sm:border-0 sm:px-7 sm:pb-7 sm:pt-0">
              <button
                type="button"
                onClick={onCancelar}
                className="h-[52px] rounded-full border-[1.5px] border-foreground/20 px-[22px] text-sm font-extrabold text-foreground hover:bg-nevoa sm:h-11 sm:px-[18px] sm:text-[13px] sm:font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onAplicar}
                disabled={isParsing}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:h-11 sm:flex-none sm:px-5 sm:text-[13px] sm:font-bold"
              >
                <Check className="h-[17px] w-[17px] sm:hidden" strokeWidth={2.4} />
                {rotuloAplicar}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
