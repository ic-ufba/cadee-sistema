import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CalendarArrowDown, ChevronDown, Github, GraduationCap, LogIn, LogOut, RefreshCw, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useSigaaAuth, useSigaaLoginDialog, useSigaaSync } from '@/hooks/useSigaa';
import { baixarGradeIcs } from '@/lib/sigaaActions';
import { detalheCurso, iniciais, nomeCurto, tituloCurso } from '@/lib/curso-texto';
import { cn } from '@/lib/utils';

const itemClass =
  'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-foreground focus:bg-nevoa';

/**
 * Botão de conta da barra superior: mostra o aluno quando o SIGAA está conectado
 * ou o curso escolhido quando não está. Reúne curso, histórico e conta num só menu.
 */
export function ContaMenu() {
  const navigate = useNavigate();
  const { myPrograms } = useMyPrograms();
  const curso = myPrograms[0];
  const { isConfigured, isLoggedIn, session, logout } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();
  const sync = useSigaaSync();

  const logado = isConfigured && isLoggedIn;
  const nome = nomeCurto(session?.nome ?? session?.usuario);
  const detalhe = detalheCurso(curso);

  if (!curso && !logado) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-full border-[1.5px] border-foreground/15 py-1 pl-1.5 pr-3 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa data-[state=open]:bg-nevoa"
        >
          {logado ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mar text-xs font-extrabold text-white">
              {iniciais(session?.nome ?? session?.usuario)}
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nevoa">
              <GraduationCap className="h-4 w-4" />
            </span>
          )}
          <span className="max-w-[180px] truncate">{logado ? nome : tituloCurso(curso?.title)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[300px] rounded-[14px] p-2">
        {logado ? (
          <div className="mb-1.5 flex items-center gap-3 border-b border-border px-2.5 pb-3.5 pt-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mar text-sm font-extrabold text-white">
              {iniciais(session?.nome ?? session?.usuario)}
            </span>
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate text-sm font-extrabold text-foreground">{nome}</span>
              {curso && (
                <span className="truncate font-mono text-[11px] text-foreground-2">
                  {[tituloCurso(curso.title), curso.program_type ? tituloCurso(curso.program_type) : null].filter(Boolean).join(' · ')}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-mar-ink">
                <span className="h-[7px] w-[7px] rounded-full bg-mar" />
                SIGAA conectado
              </span>
            </span>
          </div>
        ) : (
          curso && (
            <div className="mb-1.5 flex flex-col gap-[3px] border-b border-border px-2.5 pb-3.5 pt-2.5">
              <span className="text-sm font-extrabold text-foreground">{tituloCurso(curso.title)}</span>
              <span className="font-mono text-[11px] text-foreground-2">
                {[detalhe, 'UFBA'].filter(Boolean).join(' · ')}
              </span>
            </div>
          )
        )}

        {logado ? (
          <>
            <DropdownMenuItem className={itemClass} onSelect={openLogin}>
              <RefreshCw className="h-4 w-4" />
              Atualizar autenticação
            </DropdownMenuItem>
            <DropdownMenuItem className={itemClass} disabled={sync.isPending} onSelect={() => sync.mutate()}>
              <Upload className={cn('h-4 w-4', sync.isPending && 'animate-pulse')} />
              {sync.isPending ? 'Sincronizando…' : 'Sincronizar histórico'}
            </DropdownMenuItem>
            <DropdownMenuItem className={itemClass} onSelect={() => void baixarGradeIcs()}>
              <CalendarArrowDown className="h-4 w-4" />
              Baixar grade (.ics)
            </DropdownMenuItem>
            <DropdownMenuItem className={cn(itemClass, 'text-pitanga focus:text-pitanga')} onSelect={() => void logout()}>
              <LogOut className="h-4 w-4" />
              Sair do SIGAA
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem className={itemClass} onSelect={() => navigate('/?importar=1')}>
          <Upload className="h-4 w-4" />
          Atualizar histórico
        </DropdownMenuItem>
        <DropdownMenuItem className={itemClass} onSelect={() => navigate('/configuracoes')}>
          <ArrowLeftRight className="h-4 w-4" />
          Mudar de curso
        </DropdownMenuItem>
        {/* Login do SIGAA temporariamente oculto
        {isConfigured && !logado && (
          <DropdownMenuItem className={itemClass} onSelect={openLogin}>
            <LogIn className="h-4 w-4" />
            Entrar com o SIGAA
          </DropdownMenuItem>
        )} */}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={cn(itemClass, 'text-foreground-2')}>
          <a href="https://github.com/FormigTeen/sigaa-static" target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4" />
            Código no GitHub
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
