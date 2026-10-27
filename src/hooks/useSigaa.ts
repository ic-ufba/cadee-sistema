import { useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/contexts/AppContext';
import { useMode } from '@/hooks/useMode';
import { usePlanningTerm } from '@/hooks/usePlanningTerm';
import { toast } from '@/hooks/use-toast';
import { setSigaaSession, updateSigaaSession, useSigaaSession } from '@/lib/sigaaSession';
import { buildProgressData, buildStatusUpdates } from '@/lib/sigaaSync';
import {
  fetchApiStatus,
  fetchAtualizacoes,
  fetchAvaliacoes,
  fetchCalendario,
  fetchCargaHoraria,
  fetchFrequencia,
  fetchGradeHoraria,
  fetchMensagens,
  fetchNotas,
  fetchTarefas,
  fetchHistorico,
  fetchIndices,
  fetchIntegralizacao,
  fetchPlanejamentoMatricula,
  fetchPrevisaoOferta,
  isSigaaApiConfigured,
  loginSigaa,
  logoutSigaa,
  type Historico,
} from '@/services/sigaaApi';

/** Prefixo de todas as queries que dependem do aluno logado (apagadas no logout). */
export const SIGAA_USER_KEY = 'sigaa-user';

const loginDialogOpenAtom = atom(false);

export function useSigaaLoginDialog() {
  const [open, setOpen] = useAtom(loginDialogOpenAtom);
  return { open, setOpen, openLogin: () => setOpen(true) };
}

export function useSigaaApiStatus(enabled = true) {
  return useQuery({
    queryKey: ['sigaa-status'],
    queryFn: fetchApiStatus,
    enabled: enabled && isSigaaApiConfigured,
    staleTime: 1000 * 60,
    retry: 0,
  });
}

export function useSigaaAuth() {
  const session = useSigaaSession();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (vars: { usuario: string; senha: string; lembrar: boolean }) => {
      const info = await loginSigaa(vars.usuario.trim(), vars.senha, vars.lembrar);
      if (!info.token) throw new Error('A API não devolveu um token.');
      queryClient.removeQueries({ queryKey: [SIGAA_USER_KEY] });
      setSigaaSession({
        token: info.token,
        usuario: vars.usuario.trim(),
        lembrar: vars.lembrar,
        criadaEm: info.criada_em,
        expiraEm: info.expira_em,
      });
      return info;
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutSigaa();
    } catch {
      // mesmo se a API não responder, a sessão local é encerrada
    }
    setSigaaSession(null);
    queryClient.removeQueries({ queryKey: [SIGAA_USER_KEY] });
  }, [queryClient]);

  return {
    isConfigured: isSigaaApiConfigured,
    isLoggedIn: !!session,
    session,
    login,
    logout,
  };
}

function userQueryOptions<T>(name: string, queryFn: () => Promise<T>, enabled: boolean) {
  return {
    queryKey: [SIGAA_USER_KEY, name],
    queryFn,
    enabled: enabled && isSigaaApiConfigured,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 0,
  };
}

export function useSigaaHistorico(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('historico', fetchHistorico, enabled && !!session));
}

export function useSigaaIndices(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('indices', fetchIndices, enabled && !!session));
}

export function useSigaaIntegralizacao(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('integralizacao', fetchIntegralizacao, enabled && !!session));
}

export function useSigaaCargaHoraria(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('carga-horaria', fetchCargaHoraria, enabled && !!session));
}

export function useSigaaPlanejamento(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('planejamento', fetchPlanejamentoMatricula, enabled && !!session));
}

export function useSigaaPrevisaoOferta(enabled = true) {
  const session = useSigaaSession();
  return useQuery(
    userQueryOptions('previsao-oferta', () => fetchPrevisaoOferta({ incluir_optativas: false }), enabled && !!session),
  );
}

/**
 * Busca o histórico no SIGAA e aplica no CADEE do mesmo jeito que a importação do PDF:
 * disciplinas cursadas, carga horária, semestres e o desfecho do semestre em planejamento.
 */
export function useSigaaSync() {
  const { setDisciplineStatus } = useApp();
  const { setMode } = useMode();
  const { planningTerm } = usePlanningTerm();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      queryClient.fetchQuery<Historico>({ queryKey: [SIGAA_USER_KEY, 'historico'], queryFn: fetchHistorico, staleTime: 0 }),
    onSuccess: (historico) => {
      const progress = buildProgressData(historico);
      try {
        localStorage.setItem('progressData', JSON.stringify(progress));
      } catch {
        // sem armazenamento: os status abaixo ainda valem na sessão
      }

      for (const u of buildStatusUpdates(historico, planningTerm)) {
        setDisciplineStatus(u.code, u.status, u.term);
      }
      setMode('full');
      updateSigaaSession({
        nome: historico.dados_pessoais?.nome ?? undefined,
        curso: historico.vinculo?.curso ?? undefined,
        sincronizadoEm: new Date().toISOString(),
      });
      window.dispatchEvent(new Event('progressDataUpdated'));

      toast({
        title: 'Histórico sincronizado',
        description: `${progress.codes.length} disciplinas cumpridas e ${progress.semesters.length} semestres importados do SIGAA.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Não foi possível sincronizar', description: error.message, variant: 'destructive' });
    },
  });
}

// ------------------------------------------------------------------ meu semestre

export function useSigaaGradeHoraria(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('grade-horaria', fetchGradeHoraria, enabled && !!session));
}

export function useSigaaAvaliacoes(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('avaliacoes', fetchAvaliacoes, enabled && !!session));
}

export function useSigaaTarefas(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('tarefas', fetchTarefas, enabled && !!session));
}

export function useSigaaAtualizacoes(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('atualizacoes', fetchAtualizacoes, enabled && !!session));
}

export function useSigaaNotas(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('notas', fetchNotas, enabled && !!session));
}

export function useSigaaFrequencia(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('frequencia', fetchFrequencia, enabled && !!session));
}

export function useSigaaCalendario(enabled = true) {
  const session = useSigaaSession();
  return useQuery({ ...userQueryOptions('calendario', fetchCalendario, enabled && !!session), staleTime: 1000 * 60 * 60 * 6 });
}

export function useSigaaMensagens(enabled = true) {
  const session = useSigaaSession();
  return useQuery(userQueryOptions('mensagens', fetchMensagens, enabled && !!session));
}

function dataLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

/**
 * O semestre está em andamento? Usa o período letivo do calendário acadêmico do SIGAA e, se ele não vier,
 * o primeiro e o último dia de aula da grade horária do aluno. Sem login: `emAndamento` = null.
 */
export function useSemestreAtual() {
  const { isLoggedIn } = useSigaaAuth();
  const calendario = useSigaaCalendario(isLoggedIn);
  const precisaGrade = isLoggedIn && (calendario.isError || (calendario.isSuccess && !calendario.data?.periodo_letivo?.inicio));
  const grade = useSigaaGradeHoraria(precisaGrade);

  const inicio = dataLocal(calendario.data?.periodo_letivo?.inicio) ?? dataLocal(grade.data?.data_inicio);
  const fim = dataLocal(calendario.data?.periodo_letivo?.fim) ?? dataLocal(grade.data?.data_fim);
  const carregando = isLoggedIn && (calendario.isLoading || (precisaGrade && grade.isLoading));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const emAndamento = !isLoggedIn || carregando ? null : inicio && fim ? hoje >= inicio && hoje <= fim : false;
  const semana = inicio ? Math.max(1, Math.floor((hoje.getTime() - inicio.getTime()) / (7 * 864e5)) + 1) : null;
  const totalSemanas = inicio && fim ? Math.max(1, Math.ceil((fim.getTime() - inicio.getTime() + 864e5) / (7 * 864e5))) : null;

  return { emAndamento, carregando, inicio, fim, semana, totalSemanas, calendario: calendario.data };
}
