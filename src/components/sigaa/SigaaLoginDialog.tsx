import { useState, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, X } from 'lucide-react';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useSigaaAuth, useSigaaLoginDialog, useSigaaSync } from '@/hooks/useSigaa';
import { SigaaApiError } from '@/services/sigaaApi';

const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'Usuário ou senha incorretos. Use o mesmo login do SIGAA.',
  muitas_tentativas: 'Muitas tentativas seguidas. Espere alguns minutos antes de tentar de novo.',
  sigaa_indisponivel: 'O SIGAA está fora do ar agora. Tente mais tarde.',
  sigaa_ocupado: 'O SIGAA está sobrecarregado agora. Tente de novo em instantes.',
  https_obrigatorio: 'Este servidor só aceita login por HTTPS. Avise quem mantém o CADEE.',
  sem_conexao: 'Não foi possível falar com a API do SIGAA. Ela está no ar?',
  tempo_esgotado: 'O SIGAA demorou demais para responder. Tente de novo.',
};

function mensagemDeErro(error: unknown): string {
  if (error instanceof SigaaApiError) return MENSAGENS[error.codigo] ?? error.message;
  if (error instanceof Error) return error.message;
  return 'Erro inesperado ao entrar.';
}

const CAMPO =
  'h-[50px] w-full rounded-[14px] border-0 bg-nevoa px-[18px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15 disabled:opacity-60';

export function SigaaLoginDialog() {
  const { open, setOpen } = useSigaaLoginDialog();
  const { login } = useSigaaAuth();
  const sync = useSigaaSync();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(false);

  const busy = login.isPending || sync.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha) return;
    try {
      await login.mutateAsync({ usuario, senha, lembrar });
      setSenha('');
      // importa o histórico logo após entrar: é o principal motivo do login
      await sync.mutateAsync().catch(() => undefined);
      setOpen(false);
    } catch {
      // erro exibido abaixo via login.error
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (busy) return;
    if (!value) {
      setSenha('');
      setVerSenha(false);
      login.reset();
    }
    setOpen(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-[28px] bg-background duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[18vh] sm:max-w-[460px] sm:-translate-x-1/2 sm:rounded-3xl sm:shadow-xl sm:data-[state=closed]:slide-out-to-bottom-2 sm:data-[state=open]:slide-in-from-bottom-2"
        >
          <span aria-hidden className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-trilho sm:hidden" />

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="flex flex-col gap-4 px-6 pt-3.5 sm:px-7 sm:pt-[26px]">
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <DialogTitle className="text-[22px] sm:text-2xl font-black leading-[1.1] tracking-[-0.03em] text-foreground">
                    Entrar com o SIGAA
                  </DialogTitle>
                  <DialogDescription className="text-[13px] font-medium leading-relaxed text-foreground-2 sm:sr-only">
                    Use o mesmo usuário e senha do SIGAA da UFBA.
                  </DialogDescription>
                </div>
                <DialogPrimitive.Close
                  disabled={busy}
                  aria-label="Fechar"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground transition-colors hover:bg-trilho disabled:opacity-50 sm:h-10 sm:w-10"
                >
                  <X className="h-[18px] w-[18px] sm:h-4 sm:w-4" strokeWidth={2.4} />
                </DialogPrimitive.Close>
              </div>

              <label className="flex flex-col gap-[7px] text-xs font-extrabold text-foreground">
                Usuário do SIGAA
                <input
                  id="sigaa-usuario"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="seu.login"
                  disabled={busy}
                  required
                  className={`${CAMPO} font-mono text-sm font-semibold`}
                />
              </label>

              <label className="flex flex-col gap-[7px] text-xs font-extrabold text-foreground">
                Senha
                <span className="relative flex items-center">
                  <input
                    id="sigaa-senha"
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={busy}
                    required
                    className={`${CAMPO} pr-14 text-[15px] font-medium`}
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                    className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground-2 hover:bg-trilho"
                  >
                    {verSenha ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-foreground">
                <Checkbox
                  checked={lembrar}
                  onCheckedChange={(v) => setLembrar(v === true)}
                  disabled={busy}
                  className="h-5 w-5 rounded-md border-foreground/30 data-[state=checked]:border-mar data-[state=checked]:bg-mar data-[state=checked]:text-white"
                />
                Manter conectado neste navegador
              </label>

              {login.isError && (
                <p role="alert" className="rounded-[14px] bg-pitanga-tint px-4 py-2.5 text-[13px] font-semibold text-pitanga-ink">
                  {mensagemDeErro(login.error)}
                </p>
              )}

              <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 rounded-[14px] bg-nevoa px-3.5 py-3">
                <Lock className="mt-px h-[17px] w-[17px] text-foreground-2" strokeWidth={2.2} />
                <p className="text-xs font-medium leading-relaxed text-foreground-2">
                  <b className="font-extrabold text-foreground">Só leitura.</b> O CADEE só lê curso, histórico e matrícula: nada é
                  alterado no SIGAA e a senha não fica gravada no navegador.
                  {lembrar && ' Para reconectar sozinho, o servidor guarda a senha cifrada, só na memória.'}
                </p>
              </div>
            </div>

            <div className="mt-[18px] flex gap-2.5 border-t border-trilho px-6 pb-[22px] pt-3.5 sm:mt-[22px] sm:justify-end sm:px-7 sm:pb-6 sm:pt-4">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={busy}
                className="h-[52px] rounded-full border-[1.5px] border-foreground/20 px-[22px] text-sm font-extrabold text-foreground transition-colors hover:bg-nevoa disabled:opacity-50 sm:h-[46px] sm:px-5 sm:text-[13.5px]"
              >
                Agora não
              </button>
              <button
                type="submit"
                disabled={busy || !usuario.trim() || !senha}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-mar px-6 text-sm font-extrabold text-white transition-colors hover:bg-mar/90 disabled:opacity-60 sm:h-[46px] sm:flex-none sm:text-[13.5px]"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {login.isPending ? 'Entrando…' : sync.isPending ? 'Importando histórico…' : 'Entrar'}
                {!busy && <ArrowRight className="h-[17px] w-[17px] sm:hidden" strokeWidth={2.4} />}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
