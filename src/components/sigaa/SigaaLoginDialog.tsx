import { useState, type FormEvent } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function SigaaLoginDialog() {
  const { open, setOpen } = useSigaaLoginDialog();
  const { login } = useSigaaAuth();
  const sync = useSigaaSync();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
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
      login.reset();
    }
    setOpen(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="hidden h-5 w-5 text-mar" />
            Entrar com o SIGAA
          </DialogTitle>
          <DialogDescription>
            Opcional. Com a sua conta, o CADEE importa o histórico sozinho e confere a grade com os dados oficiais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sigaa-usuario">Usuário do SIGAA</Label>
            <Input
              id="sigaa-usuario"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="seu.login"
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sigaa-senha">Senha</Label>
            <Input
              id="sigaa-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={busy}
              required
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={lembrar}
              onCheckedChange={(v) => setLembrar(v === true)}
              disabled={busy}
              className="mt-0.5"
            />
            <span>
              Manter conectado neste navegador
              <span className="block text-xs">
                O servidor guarda a senha cifrada, só na memória, para reconectar quando o SIGAA derrubar a sessão.
              </span>
            </span>
          </label>

          {login.isError && (
            <p role="alert" className="rounded-[14px] bg-pitanga-tint px-4 py-2.5 text-sm font-semibold text-pitanga-ink">
              {mensagemDeErro(login.error)}
            </p>
          )}

          <div className="flex gap-2 rounded-[18px] bg-nevoa p-4 text-xs font-medium text-foreground-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-mar" />
            <p>
              Sua senha vai direto para a API do SIGAA usada pelo CADEE e nunca é gravada. O acesso é só de leitura: nada é
              alterado na sua matrícula.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
              Agora não
            </Button>
            <Button type="submit" disabled={busy || !usuario.trim() || !senha}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {login.isPending ? 'Entrando…' : sync.isPending ? 'Importando histórico…' : 'Entrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
