/**
 * Cliente da {sigaa} api. Versão usada pelo CADEE: fork do IC, https://github.com/ic-ufba/sigaa-ufba-api
 * (original de Caio Alcarria: https://github.com/caioalcarria/sigaa-ufba-api).
 *
 * - Rotas públicas (/v1/publico/...): sem login, usadas pra enriquecer o catálogo (ementa, requisitos, programa).
 * - Rotas logadas: só quando o aluno entra com a conta do SIGAA (opcional).
 *
 * A URL vem de VITE_SIGAA_API_URL (ver .env.example). Sem ela, o CADEE funciona como antes, só com a API estática.
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { getSigaaSession, setSigaaSession } from '@/lib/sigaaSession';

const RAW_URL = (import.meta.env.VITE_SIGAA_API_URL as string | undefined)?.trim() ?? '';
export const SIGAA_API_URL = RAW_URL.replace(/\/+$/, '');
export const isSigaaApiConfigured = SIGAA_API_URL.length > 0;

/** Evento disparado quando a API recusa o token (expirou, logout em outro lugar...). */
export const SIGAA_SESSION_EXPIRED_EVENT = 'sigaaSessionExpired';

export class SigaaApiError extends Error {
  constructor(
    message: string,
    public codigo: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'SigaaApiError';
  }
}

const client = axios.create({
  baseURL: SIGAA_API_URL || undefined,
  // o SIGAA é lento: login e histórico podem levar dezenas de segundos
  timeout: 90_000,
});

client.interceptors.request.use((config) => {
  const session = getSigaaSession();
  if (session?.token && !config.headers.Authorization && config.url && !config.url.startsWith('/v1/publico')) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ erro?: { codigo?: string; mensagem?: string } }>) => {
    const status = error.response?.status;
    const erro = error.response?.data?.erro;
    const codigo = erro?.codigo ?? (error.code === 'ECONNABORTED' ? 'tempo_esgotado' : status ? 'erro' : 'sem_conexao');
    const mensagem =
      erro?.mensagem ??
      (codigo === 'sem_conexao'
        ? 'Não foi possível falar com a API do SIGAA. Ela está no ar?'
        : codigo === 'tempo_esgotado'
          ? 'O SIGAA demorou demais para responder. Tente de novo em instantes.'
          : error.message);

    const hadToken = Boolean((error.config?.headers as Record<string, unknown> | undefined)?.Authorization);
    if (status === 401 && hadToken && (codigo === 'token_invalido' || codigo === 'sessao_expirada')) {
      setSigaaSession(null);
      window.dispatchEvent(new Event(SIGAA_SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(new SigaaApiError(mensagem, codigo, status));
  },
);

function ensureConfigured() {
  if (!isSigaaApiConfigured) {
    throw new SigaaApiError('A API do SIGAA não está configurada (VITE_SIGAA_API_URL).', 'nao_configurada');
  }
}

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  ensureConfigured();
  const { data } = await client.get<T>(url, config);
  return data;
}

async function post<T>(url: string, body: unknown, config?: AxiosRequestConfig): Promise<T> {
  ensureConfigured();
  const { data } = await client.post<T>(url, body, config);
  return data;
}

// ---------------------------------------------------------------- tipos (espelham sigaa/models/*.py)

export interface SessaoInfo {
  token: string | null;
  tipo: string;
  criada_em: string;
  expira_em: string;
  ocioso_expira_em_min: number;
  lembrar: boolean;
  sigaa_logado: boolean;
}

export interface ApiStatus {
  api: string;
  versao?: string;
  sigaa: { url: string; no_ar: boolean; latencia_ms: number | null };
}

export interface CargaHorariaCategoria {
  categoria: string;
  exigido: number | null;
  integralizado: number | null;
  pendente: number | null;
}

export interface ComponenteCursado {
  periodo: string;
  codigo: string;
  nome: string;
  natureza: string | null;
  carga_horaria: number | null;
  nota: number | null;
  frequencia: number | null;
  situacao: string;
  situacao_descricao: string | null;
  aprovado: boolean;
  cursando: boolean;
}

export interface ComponentePendente {
  codigo: string;
  nome: string;
  carga_horaria: number | null;
  matriculado: boolean;
}

export interface ComponenteRef {
  codigo: string;
  nome?: string | null;
  carga_horaria?: number | null;
}

export interface Equivalencia {
  tipo: string;
  componente: ComponenteRef;
  atraves_de: ComponenteRef[];
  texto: string;
}

export interface EstatisticaPeriodo {
  periodo: string;
  componentes: number;
  carga_horaria: number;
  carga_horaria_aprovada: number;
  aprovados: number;
  reprovados: number;
  trancados: number;
  cursando: number;
  cr_periodo: number | null;
  cr_acumulado: number | null;
  iap_acumulado: number | null;
}

export interface CargaExtensionista {
  descricao: string;
  periodo: string | null;
  carga_horaria: number | null;
}

export interface Historico {
  dados_pessoais: { nome: string | null; matricula: string | null };
  vinculo: {
    curso: string | null;
    status: string | null;
    curriculo: string | null;
    ingresso_periodo: string | null;
    periodo_letivo_atual: number | null;
    prazo_conclusao_padrao: string | null;
    prazo_conclusao_maximo: string | null;
  };
  indices: { cr: number | null; iap: number | null; outros: Record<string, number> };
  componentes: ComponenteCursado[];
  carga_horaria: CargaHorariaCategoria[];
  carga_horaria_extensionista: CargaExtensionista[];
  obrigatorios_pendentes: ComponentePendente[];
  equivalencias: Equivalencia[];
  estatisticas: {
    por_periodo: EstatisticaPeriodo[];
    cr_calculado: number | null;
    iap_calculado: number | null;
    taxa_aprovacao: number | null;
  } | null;
}

export interface IndicesResposta {
  oficiais: { cr: number | null; iap: number | null };
  cr_calculado: number | null;
  iap_calculado: number | null;
  calculo_confere_com_oficial: boolean | null;
  evolucao: EstatisticaPeriodo[];
}

export interface Integralizacao {
  curriculo: string | null;
  percentual: number | null;
  carga_horaria: CargaHorariaCategoria[];
  obrigatorios_pendentes: ComponentePendente[];
  carga_horaria_extensionista: CargaExtensionista[];
  periodo_letivo_atual: number | null;
  prazo_conclusao_padrao: string | null;
  prazo_conclusao_maximo: string | null;
}

export interface HorarioAula {
  dia: string;
  dia_numero: number;
  turno: string;
  aula: number;
  inicio: string | null;
  fim: string | null;
}

export interface TurmaCandidata {
  turma_id: number | null;
  codigo_turma: string | null;
  docentes: string[];
  horario_codigo: string | null;
  horarios: HorarioAula[];
  local: string | null;
  capacidade: number | null;
  matriculados: number | null;
  vagas_livres: number | null;
  situacao: string | null;
}

export interface ComponenteCandidato {
  codigo: string;
  nome: string;
  carga_horaria: number | null;
  natureza: string;
  semestre_ideal: number | null;
  atrasado: boolean;
  pre_requisitos: string | null;
  apto: boolean | null;
  faltando_minimo: string[];
  desbloqueia: string[];
  reprovacoes_anteriores: number;
  turmas: TurmaCandidata[];
}

export interface PlanejamentoMatricula {
  ano: number | null;
  periodo: number | null;
  curso: string | null;
  ch_maxima_periodo: number | null;
  candidatos: ComponenteCandidato[];
  total_ofertados_para_o_curso: number;
  avisos: string[];
}

export interface Choque {
  turmas: string[];
  dia: string;
  horario: string;
}

export interface ItemSimulado {
  codigo: string;
  turma: string | null;
  turma_id: number | null;
  carga_horaria: number | null;
  apto: boolean | null;
  faltando: string[];
  ja_aprovado: boolean;
  natureza: string | null;
}

export interface SimulacaoMatricula {
  itens: ItemSimulado[];
  ch_total: number;
  ch_maxima_periodo: number | null;
  excede_ch_maxima: boolean;
  choques: Choque[];
  problemas: string[];
  valida: boolean;
  ch_obrigatoria_pendente_depois: number | null;
  ch_optativa_pendente_depois: number | null;
  percentual_integralizado_depois: number | null;
  grade: Record<string, string[]>;
}

export interface EscolhaTurma {
  codigo?: string;
  turma?: string;
  turma_id?: number;
}

export interface CargaHorariaGestao {
  categorias: CargaHorariaCategoria[];
  percentual_integralizado: number | null;
  complementar_exigida: number | null;
  complementar_integralizada: number | null;
  complementar_pendente: number | null;
  atividades_aceitas_ch: number;
  atividades_em_analise_ch: number;
  extensao: CargaExtensionista[];
  extensao_total_ch: number;
  dicas: string[];
}

export interface PrevisaoPeriodo {
  periodo: string;
  provavel: boolean | null;
  probabilidade: number | null;
  confianca: 'alta' | 'media' | 'baixa' | 'sem_dados' | string;
  ja_publicada: boolean;
  motivo: string;
}

export interface PrevisaoComponente {
  codigo: string;
  nome: string | null;
  natureza: string | null;
  semestre_ideal: number | null;
  sem_turma: boolean;
  requisito: { apto: boolean | null; faltando_minimo?: string[] };
  previsao: PrevisaoPeriodo | null;
  erro: string | null;
}

export interface PrevisaoOfertaAluno {
  alvo: string;
  desde: string;
  periodo_atual: string | null;
  componentes: PrevisaoComponente[];
  provaveis: string[];
  improvaveis: string[];
  sem_historico: string[];
  avisos: string[];
}

/** Detalhe público do componente (/v1/publico/componentes/codigo/{codigo}). */
export interface ComponenteCurricular {
  id: number | null;
  codigo: string | null;
  nome: string | null;
  tipo: string | null;
  modalidade: string | null;
  unidade_responsavel: string | null;
  pre_requisitos: string | null;
  co_requisitos: string | null;
  equivalencias: string | null;
  pre_requisitos_codigos: string[];
  co_requisitos_codigos: string[];
  equivalencias_codigos: string[];
  ementa: string | null;
  carga_horaria_total: number | null;
  carga_horaria_teorica: number | null;
  carga_horaria_pratica: number | null;
  carga_horaria_extensionista: number | null;
  requisito_de: ComponenteRef[];
  equivalente_de: ComponenteRef[];
}

export interface ProgramaComponente {
  codigo: string | null;
  nome: string | null;
  periodo: string | null;
  ementa: string | null;
  objetivos: string | null;
  conteudo: string | null;
  metodologia: string | null;
  avaliacao: string | null;
  competencias_habilidades: string | null;
  referencias: string | null;
}

// ---------------------------------------------------------------- sistema

export const fetchApiStatus = () => get<ApiStatus>('/v1/status', { timeout: 15_000 });

// ---------------------------------------------------------------- autenticação

export function loginSigaa(usuario: string, senha: string, lembrar: boolean) {
  return post<SessaoInfo>('/v1/auth/login', { usuario, senha, lembrar });
}

export const fetchSessao = () => get<SessaoInfo>('/v1/auth/sessao');

export async function logoutSigaa() {
  ensureConfigured();
  await client.delete('/v1/auth/sessao');
}

// ---------------------------------------------------------------- acadêmico (logado)

export const fetchHistorico = () => get<Historico>('/v1/historico');
export const fetchIndices = () => get<IndicesResposta>('/v1/indices');
export const fetchIntegralizacao = () => get<Integralizacao>('/v1/integralizacao');
export const fetchCargaHoraria = () => get<CargaHorariaGestao>('/v1/carga-horaria');

export function simularIndices(notas: Array<{ codigo: string; nota: number; carga_horaria?: number }>) {
  return post<{ cr_atual: number | null; cr_simulado: number | null; iap_atual: number | null; iap_simulado: number | null }>(
    '/v1/indices/simular',
    { notas },
  );
}

// ---------------------------------------------------------------- planejamento (logado)

export const fetchPlanejamentoMatricula = () => get<PlanejamentoMatricula>('/v1/planejamento/matricula');

export function simularMatricula(turmas: EscolhaTurma[]) {
  return post<SimulacaoMatricula>('/v1/planejamento/simular', { turmas });
}

export function fetchSugestaoMatricula(params: { turnos?: string; ch_maxima?: number; incluir_optativas?: boolean } = {}) {
  return get<SimulacaoMatricula>('/v1/planejamento/sugestao', { params });
}

export function fetchPrevisaoOferta(params: { alvo?: string; incluir_optativas?: boolean } = {}) {
  return get<PrevisaoOfertaAluno>('/v1/planejamento/previsao-oferta', { params });
}

/** Grade horária em iCalendar, pronta pra baixar/importar no Google Agenda. */
export async function fetchGradeIcs(): Promise<Blob> {
  ensureConfigured();
  const { data } = await client.get<Blob>('/v1/grade-horaria.ics', { responseType: 'blob' });
  return data;
}

// ---------------------------------------------------------------- público (sem login)

export const fetchComponentePublico = (codigo: string) =>
  get<ComponenteCurricular>(`/v1/publico/componentes/codigo/${encodeURIComponent(codigo)}`);

/** Cursos de graduação do SIGAA (público). Itens crus: o CADEE só precisa do id e do nome para casar com o curso. */
export const fetchCursosPublicos = (nome: string) =>
  get<{ itens: Record<string, unknown>[] }>('/v1/publico/cursos', {
    params: { nivel: 'G', nome, por_pagina: 100 },
    timeout: 30_000,
  });

/** Turmas do período com vaga reservada pro curso (público). Itens crus, convertidos em lib/ofertaAoVivo. */
export const fetchTurmasDoCursoPublico = (cursoId: number, ano: number, periodo: number) =>
  get<Record<string, unknown>[] | { itens: Record<string, unknown>[] }>(`/v1/publico/cursos/${cursoId}/turmas`, {
    params: { ano, periodo },
    timeout: 45_000,
  });

export async function fetchProgramaComponente(codigo: string): Promise<ProgramaComponente | null> {
  try {
    return await get<ProgramaComponente>(`/v1/publico/componentes/codigo/${encodeURIComponent(codigo)}/programa`);
  } catch (e) {
    // 404 é o caso comum na UFBA: o componente não tem programa cadastrado
    if (e instanceof SigaaApiError && e.status === 404) return null;
    throw e;
  }
}

// ---------------------------------------------------------------- meu semestre (logado)
// Rotas do "portal do aluno". No servidor da Rede IC elas precisam estar em SIGAA_API_ROTAS_PERMITIDAS.

export interface AulaGrade {
  dia: number; // 1 = domingo … 7 = sábado
  dia_nome: string;
  inicio: string | null;
  fim: string | null;
  turno: string;
  codigos: string[];
  turma_id: number | null;
  codigo: string | null;
  nome: string;
  turma: string | null;
  local: string | null;
}

export interface GradeHoraria {
  periodo: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  aulas: AulaGrade[];
  conflitos: string[];
  sem_horario: string[];
}

export interface AvaliacaoAgendada {
  id: number | null;
  data: string | null;
  hora: string | null;
  descricao: string;
  turma_id: number | null;
  turma_codigo: string | null;
  turma_nome: string | null;
}

export interface TarefaPendente {
  id: number | null;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  enviada: boolean | null;
  nota: number | null;
  em_grupo: boolean | null;
  aberta: boolean | null;
  turma_id: number | null;
  turma_codigo: string | null;
  turma_nome: string | null;
}

export interface Atualizacao {
  data: string | null;
  turma_id: number | null;
  turma: string;
  periodo: string | null;
  tipo: string | null;
  titulo: string | null;
}

export interface AvaliacaoNota {
  abreviacao: string;
  denominacao: string | null;
  peso: number | null;
  nota: number | null;
}

export interface NotasTurma {
  turma_id: number | null;
  codigo: string | null;
  nome: string | null;
  periodo: string | null;
  lancadas: boolean;
  mensagem: string | null;
  unidades: Array<{ rotulo: string; nota: number | null; avaliacoes: AvaliacaoNota[] }>;
  reposicao: number | null;
  resultado: number | null;
  faltas: number | null;
  situacao: string | null;
}

export interface FrequenciaResumo {
  turma_id: number | null;
  codigo: string | null;
  nome: string | null;
  frequencia: {
    lancada: boolean;
    total_faltas: number;
    max_faltas: number | null;
    faltas_restantes: number | null;
    percentual_ch: number | null;
    minimo_percentual: number | null;
  };
}

export interface EventoCalendario {
  rotulo: string;
  grupo: string | null;
  inicio: string | null;
  fim: string | null;
  definido: boolean;
}

export interface Calendario {
  ano: number | null;
  periodo: number | null;
  periodo_letivo: { inicio: string | null; fim: string | null; definido: boolean } | null;
  eventos: EventoCalendario[];
}

export interface MensagemResumo {
  id: string | null;
  remetente: string | null;
  assunto: string;
  data: string | null;
  lida: boolean | null;
}

export const fetchGradeHoraria = () => get<GradeHoraria>('/v1/grade-horaria');
export const fetchAvaliacoes = () => get<AvaliacaoAgendada[]>('/v1/avaliacoes');
export const fetchTarefas = () => get<TarefaPendente[]>('/v1/tarefas');
export const fetchAtualizacoes = () => get<Atualizacao[]>('/v1/atualizacoes');
export const fetchNotas = () => get<NotasTurma[]>('/v1/notas');
export const fetchFrequencia = () => get<FrequenciaResumo[]>('/v1/frequencia');
export const fetchCalendario = () => get<Calendario>('/v1/calendario');
export const fetchMensagens = () => get<{ mensagens: MensagemResumo[] }>('/v1/mensagens');

export type DocumentoSigaa = 'comprovante' | 'declaracao' | 'historico';

const DOCUMENTOS: Record<DocumentoSigaa, string> = {
  comprovante: '/v1/documentos/comprovante-inscricao/html',
  declaracao: '/v1/documentos/declaracao-vinculo/pdf',
  historico: '/v1/historico/pdf',
};

/** Baixa o documento oficial (PDF ou HTML do SIGAA) já com o token e devolve o arquivo. */
export async function fetchDocumento(tipo: DocumentoSigaa): Promise<Blob> {
  ensureConfigured();
  const { data } = await client.get<Blob>(DOCUMENTOS[tipo], { responseType: 'blob', timeout: 90_000 });
  return data;
}
