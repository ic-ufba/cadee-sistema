import { useMemo, useState, useEffect } from 'react';
import { useMySections } from '@/hooks/useMySections';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useMyCourses } from '@/hooks/useMyCourses';
import { ScheduleSummary } from '@/components/planner/ScheduleSummary';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { useOverallProgress } from '@/hooks/useOverallProgress';
import { Calendar, BookOpen, BarChart3, X, Sparkles, GraduationCap, Clock, AlertTriangle, Plus, TrendingUp, ArrowRight, Upload } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProgressView } from '@/components/progress/ProgressView';
import { MeuSemestre, SemestreAndamento, SemestreAtalhos } from '@/components/semestre/MeuSemestre';
import { useSemestreAtual, useSigaaAuth } from '@/hooks/useSigaa';
import { AnimatePresence, motion } from 'framer-motion';
import { useMode } from '@/hooks/useMode';
import { usePlannedDisciplineCategories } from '@/hooks/usePlannedDisciplineCategories';
import { InfoPopup } from '@/components/ui/info-popup';
import { Mare } from '@/components/brand/Mare';
import { tituloCurso, descricaoCurso, porcento } from '@/lib/curso-texto';

const Index = () => {
  const { mySections } = useMySections();
  const { myPrograms } = useMyPrograms();
  const { courses } = useMyCourses();
  const { currentTerm } = useCurrentTerm();
  const { pendingTransition, planningTerm, canAdvance, advanceToNewSemester, unresolvedCodes } = useSemesterTransition();
  const overallProgress = useOverallProgress();
  const { scheduledCount, disciplinesCount, workloadBreakdown } = usePlannedDisciplineCategories();
  const [activeTab, setActiveTabState] = useState<'semester' | 'schedule' | 'progress'>('schedule');
  const [abaEscolhida, setAbaEscolhida] = useState(false);
  const setActiveTab = (aba: 'semester' | 'schedule' | 'progress') => {
    setAbaEscolhida(true);
    setActiveTabState(aba);
  };
  const { isLoggedIn } = useSigaaAuth();
  const { emAndamento } = useSemestreAtual();

  // Com o SIGAA conectado, "Meu semestre" abre primeiro enquanto há aulas; fora do período, abre o Planejamento.
  useEffect(() => {
    if (!isLoggedIn) {
      setActiveTabState((aba) => (aba === 'semester' ? 'schedule' : aba));
      return;
    }
    if (!abaEscolhida && emAndamento !== null) setActiveTabState(emAndamento ? 'semester' : 'schedule');
  }, [isLoggedIn, emAndamento, abaEscolhida]);
  const { setMode, isFull, isSimplified } = useMode();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasImportedHistory, setHasImportedHistory] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [abrirImportacao, setAbrirImportacao] = useState(false);

  // "Atualizar histórico" no menu da conta abre a aba Progresso já com a importação aberta
  useEffect(() => {
    if (searchParams.get('importar') === '1') {
      setActiveTab('progress');
      setAbrirImportacao(true);
      const next = new URLSearchParams(searchParams);
      next.delete('importar');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const hasVisited = localStorage.getItem('firstVisit');
    if (!hasVisited) {
      setShowWelcomeModal(true);
    }
  }, []);

  useEffect(() => {
    const check = () => setHasImportedHistory(!!localStorage.getItem('progressData'));
    check();
    window.addEventListener('progressDataUpdated', check);
    return () => window.removeEventListener('progressDataUpdated', check);
  }, []);

  const renderTabContent = () => {
    if (activeTab === 'progress') {
      return <ProgressView abrirImportacao={abrirImportacao} onImportacaoAberta={() => setAbrirImportacao(false)} />;
    }
    if (activeTab === 'semester') return <MeuSemestre />;
    return <ScheduleSummary />;
  };

  return (
    <MainLayout>
      <div className="px-5 pt-4 sm:px-[clamp(20px,4vw,56px)] sm:pt-8 animate-fade-in">
        {/* Cabeçalho */}
        <div className="mb-6 sm:mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:gap-3.5">
              {activeTab !== 'progress' ? (
                <div className="flex min-h-5 items-center gap-2.5">
                  {/* mobile: universidade e curso; desktop: semestre letivo */}
                  {myPrograms.length > 0 && (
                    <span className="rotulo !text-foreground truncate sm:hidden">UFBA · {tituloCurso(myPrograms[0]?.title)}</span>
                  )}
                  <span className="rotulo !text-foreground hidden sm:inline">Semestre letivo</span>
                  {currentTerm && (
                    <span className="shrink-0 rounded-full bg-mar px-[11px] py-[3px] font-mono text-xs font-semibold text-white">
                      {pendingTransition ? planningTerm : currentTerm}
                    </span>
                  )}
                </div>
              ) : (
                myPrograms.length > 0 && (
                  <span className="rotulo !text-foreground truncate">{descricaoCurso(myPrograms[0])}</span>
                )
              )}
              <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(30px,2.8vw,40px)]">
                {activeTab === 'schedule' ? 'Controle do semestre' : activeTab === 'semester' ? 'Meu semestre' : 'Meu progresso'}
              </h1>
              {activeTab === 'semester' && <SemestreAndamento />}
              {activeTab === 'schedule' && myPrograms.length > 0 && (
                <p className="mt-1.5 hidden text-[15px] font-medium text-foreground-2 sm:block">{descricaoCurso(myPrograms[0])}</p>
              )}
            </div>

            {/* Abas (+ ações do Progresso no desktop) */}
            <div className="flex flex-col items-stretch gap-3 lg:items-end">
            {activeTab === 'semester' && <SemestreAtalhos />}
            <div className="flex flex-wrap items-center gap-2.5">
            <div role="group" aria-label="Visão" className="flex w-full rounded-full bg-nevoa p-1 lg:w-auto">
              {isLoggedIn && (
                <button
                  aria-pressed={activeTab === 'semester'}
                  onClick={() => setActiveTab('semester')}
                  className={`inline-flex min-h-11 flex-[1.2] items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] transition-all sm:px-5 sm:text-[13px] lg:flex-none ${activeTab === 'semester'
                      ? 'bg-primary font-bold text-primary-foreground'
                      : 'font-semibold text-foreground-2 hover:text-foreground'
                    }`}
                >
                  Meu semestre
                </button>
              )}
              <button
                aria-pressed={activeTab === 'schedule'}
                onClick={() => setActiveTab('schedule')}
                className={`inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] transition-all sm:px-5 sm:text-[13px] lg:flex-none ${activeTab === 'schedule'
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'font-semibold text-foreground-2 hover:text-foreground'
                  }`}
              >
                Planejamento
              </button>
              <button
                aria-pressed={activeTab === 'progress'}
                onClick={() => setActiveTab('progress')}
                className={`inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] transition-all sm:px-5 sm:text-[13px] lg:flex-none ${activeTab === 'progress'
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'font-semibold text-foreground-2 hover:text-foreground'
                  }`}
              >
                Progresso
              </button>
            </div>
            {activeTab === 'progress' && (
              <>
                {!isLoggedIn && <button
                  onClick={() => setAbrirImportacao(true)}
                  className="hidden min-h-11 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 px-4 text-xs font-bold text-foreground transition-colors hover:bg-nevoa lg:inline-flex"
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Importar histórico
                </button>}
                {hasImportedHistory && (
                  <button
                    onClick={() => window.dispatchEvent(new Event('cadee:limpar-progresso'))}
                    className="hidden min-h-11 items-center rounded-full border border-pitanga/30 px-4 text-xs font-bold text-pitanga transition-colors hover:bg-pitanga-tint lg:inline-flex"
                  >
                    Limpar dados
                  </button>
                )}
              </>
            )}
            </div>
            </div>
          </div>
        </div>

        {/* Painel do semestre atual */}
        {activeTab === 'schedule' && (
          <>
            {pendingTransition && (
              <div className="mb-5 rounded-2xl bg-dende-claro p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-dende" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-dende-ink">
                      Novo semestre {currentTerm} disponível
                    </p>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-dende-ink">
                      Finalize a grade do semestre {planningTerm}: remova as turmas ou marque o resultado de cada disciplina.
                      {unresolvedCodes.length > 0 && (
                        <> Faltam <strong>{unresolvedCodes.length}</strong> disciplina{unresolvedCodes.length > 1 ? 's' : ''}.</>
                      )}
                    </p>
                    {canAdvance && (
                      <button
                        onClick={advanceToNewSemester}
                        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-extrabold text-primary-foreground hover:bg-primary/85"
                      >
                        Iniciar semestre {currentTerm}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isFull && !hasImportedHistory && (
              <div className="mb-5 rounded-2xl bg-mar-claro p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-mar" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-foreground">
                      Importe seu histórico escolar
                    </p>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-foreground-2">
                      Para aproveitar ao máximo a experiência completa, vá até a tela de Progresso e importe seu histórico do SIGAA para acompanhar seu progresso e pré-requisitos automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const proj = overallProgress.projected;
              const pctObr = proj.mandatory.total > 0 ? Math.min(100, (proj.mandatory.completed / proj.mandatory.total) * 100) : 0;
              const pctOpt = proj.electives.total > 0 ? Math.min(100, (proj.electives.completed / proj.electives.total) * 100) : 0;
              const mostrarPrevia = isFull && hasImportedHistory;
              return (
                <section aria-label="Resumo do semestre" className="mb-6 flex flex-col border-t-2 border-foreground lg:flex-row">
                  <div className="grid grid-cols-2 lg:flex lg:flex-[2_1_480px]">
                    {/* Disciplinas */}
                    <div className="flex flex-col gap-2.5 py-[18px] pr-4 sm:gap-4 sm:pb-6 sm:pt-5 sm:pr-7 lg:flex-1">
                      <span className="rotulo !text-foreground">Disciplinas</span>
                      <div className="flex items-baseline gap-2.5">
                        <span className="numero text-[38px] leading-[0.9] text-foreground sm:text-[48px]">{scheduledCount}</span>
                        <span className="hidden text-sm font-semibold text-foreground-2 sm:inline">na grade</span>
                      </div>
                      <div className="flex h-1.5 gap-[3px] sm:h-2 sm:gap-1" aria-hidden>
                        <span className="rounded-full bg-mar" style={{ flex: disciplinesCount.mandatory }} />
                        <span className="rounded-full bg-dende" style={{ flex: disciplinesCount.elective }} />
                        <span className="rounded-full bg-ouro" style={{ flex: disciplinesCount.offered }} />
                      </div>
                      <ul className="flex flex-col gap-1.5 text-xs sm:text-[13px]">
                        <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-mar" />Obrigatórias</span><span className="font-mono font-semibold text-foreground">{disciplinesCount.mandatory}</span></li>
                        <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-dende" />Optativas</span><span className="font-mono font-semibold text-foreground">{disciplinesCount.elective}</span></li>
                        {disciplinesCount.offered > 0 && (
                          <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-ouro" />Ofertadas</span><span className="font-mono font-semibold text-foreground">{disciplinesCount.offered}</span></li>
                        )}
                      </ul>
                    </div>

                    {/* Carga horária */}
                    <div className="flex flex-col gap-2.5 border-l border-foreground/10 py-[18px] pl-4 sm:gap-4 sm:pb-6 sm:pt-5 sm:pl-7 lg:flex-1 lg:pr-7">
                      <span className="rotulo !text-foreground">Carga horária</span>
                      <div className="flex items-baseline gap-2.5">
                        <span className="numero text-[38px] leading-[0.9] text-foreground sm:text-[48px]">
                          {workloadBreakdown.total}<span className="text-lg tracking-[-0.02em] sm:text-[22px]">h</span>
                        </span>
                        <span className="hidden text-sm font-semibold text-foreground-2 sm:inline">neste semestre</span>
                      </div>
                      <div className="flex h-1.5 gap-[3px] sm:h-2 sm:gap-1" aria-hidden>
                        <span className="rounded-full bg-mar" style={{ flex: workloadBreakdown.mandatory }} />
                        <span className="rounded-full bg-dende" style={{ flex: workloadBreakdown.elective }} />
                        <span className="rounded-full bg-ouro" style={{ flex: workloadBreakdown.offered }} />
                        <span className="rounded-full bg-pedra" style={{ flex: workloadBreakdown.complementary }} />
                      </div>
                      <ul className="flex flex-col gap-1.5 text-xs sm:text-[13px]">
                        <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-mar" />Obrigatórias</span><span className="font-mono font-semibold text-foreground">{workloadBreakdown.mandatory}h</span></li>
                        <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-dende" />Optativas</span><span className="font-mono font-semibold text-foreground">{workloadBreakdown.elective}h</span></li>
                        {workloadBreakdown.offered > 0 && (
                          <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-ouro" />Ofertadas</span><span className="font-mono font-semibold text-foreground">{workloadBreakdown.offered}h</span></li>
                        )}
                        {workloadBreakdown.complementary > 0 && (
                          <li className="flex justify-between"><span className="inline-flex items-center gap-2 text-foreground-2"><span className="h-2 w-2 rounded-full bg-pedra" />Complementares</span><span className="font-mono font-semibold text-foreground">{workloadBreakdown.complementary}h</span></li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {mostrarPrevia && (
                    <>
                      {/* Prévia — mobile */}
                      <div className="flex flex-col gap-[18px] border-t border-foreground/10 pb-[26px] pt-[22px] lg:hidden">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">Prévia da progressão</h2>
                          <InfoPopup iconClassName="w-4 h-4" content="Estimativa do progresso da sua formação ao concluir com aprovação as disciplinas planejadas na grade deste semestre." />
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-end justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="rotulo">Geral</span>
                              <span className="numero text-[40px] leading-[0.9] text-foreground">{porcento(proj.overallProgress)}</span>
                            </div>
                            <span className="pb-1 font-mono text-xs text-muted-foreground">{proj.totalHours} / {overallProgress.totalRequiredHours} h</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-trilho">
                            <div className="h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${Math.min(proj.overallProgress, 100)}%` }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                          <div className="flex flex-col gap-[7px]">
                            <span className="text-xs font-bold text-foreground-2">Obrigatórias</span>
                            <span className="text-[26px] font-black leading-none tracking-[-0.04em] text-mar">{porcento(pctObr)}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-trilho"><div className="h-full rounded-full bg-mar" style={{ width: `${pctObr}%` }} /></div>
                            <span className="font-mono text-[11px] text-muted-foreground">{Math.min(proj.mandatory.completed, proj.mandatory.total)} / {proj.mandatory.total} h</span>
                          </div>
                          <div className="flex flex-col gap-[7px]">
                            <span className="text-xs font-bold text-foreground-2">Optativas</span>
                            <span className="text-[26px] font-black leading-none tracking-[-0.04em] text-dende-ink dark:text-dende">{porcento(pctOpt)}</span>
                            <div className="h-2 overflow-hidden rounded-full bg-trilho"><div className="h-full rounded-full bg-dende" style={{ width: `${pctOpt}%` }} /></div>
                            <span className="font-mono text-[11px] text-muted-foreground">{Math.min(proj.electives.completed, proj.electives.total)} / {proj.electives.total} h</span>
                          </div>
                        </div>
                      </div>

                      {/* Prévia — desktop */}
                      <div className="hidden flex-col gap-4 border-l border-foreground/10 pb-6 pl-7 pt-5 lg:flex lg:flex-[1.5_1_380px]">
                        <div className="flex items-center gap-1.5">
                          <span className="rotulo !text-foreground">Prévia da progressão</span>
                          <InfoPopup iconClassName="w-3.5 h-3.5" content="Estimativa do progresso da sua formação ao concluir com aprovação as disciplinas planejadas na grade deste semestre." />
                        </div>
                        <div className="flex flex-wrap items-center gap-[22px]">
                          <Mare percent={proj.overallProgress} size={56} />
                          <div className="flex flex-col gap-1.5">
                            <span className="numero text-[40px] leading-[0.9] text-foreground">{porcento(proj.overallProgress)}</span>
                            <span className="font-mono text-xs text-foreground-2">{proj.totalHours} / {overallProgress.totalRequiredHours} h · se tudo for aprovado</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-7">
                          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                            <div className="flex justify-between text-xs"><span className="font-semibold text-foreground-2">Obrigatórias</span><span className="font-extrabold text-mar">{porcento(pctObr)}</span></div>
                            <div className="h-1.5 rounded-full bg-trilho"><div className="h-1.5 rounded-full bg-mar" style={{ width: `${pctObr}%` }} /></div>
                            <span className="font-mono text-[11px] text-muted-foreground">{Math.min(proj.mandatory.completed, proj.mandatory.total)} / {proj.mandatory.total} h</span>
                          </div>
                          <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                            <div className="flex justify-between text-xs"><span className="font-semibold text-foreground-2">Optativas</span><span className="font-extrabold text-dende-ink dark:text-dende">{porcento(pctOpt)}</span></div>
                            <div className="h-1.5 rounded-full bg-trilho"><div className="h-1.5 rounded-full bg-dende" style={{ width: `${pctOpt}%` }} /></div>
                            <span className="font-mono text-[11px] text-muted-foreground">{Math.min(proj.electives.completed, proj.electives.total)} / {proj.electives.total} h</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              );
            })()}

            {scheduledCount > 0 && !pendingTransition && (
              <Link
                to="/planejador"
                className="-mt-3 mb-5 inline-flex min-h-10 items-center gap-2 text-[13px] font-extrabold text-mar sm:hidden"
              >
                Editar grade no Planejador
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
            )}

            {scheduledCount === 0 ? (
              <div className="rounded-[20px] bg-nevoa px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
                  <Plus className="h-6 w-6 text-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-black tracking-[-0.03em] text-foreground">Nenhuma disciplina planejada</h3>
                <p className="mx-auto mb-5 max-w-sm text-[13px] font-medium leading-relaxed text-foreground-2">
                  Adicione disciplinas no Planejador para montar sua grade do semestre {currentTerm || 'atual'}.
                </p>
                <Link
                  to="/planejador"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-extrabold text-primary-foreground hover:bg-primary/85"
                >
                  Ir para o Planejador
                </Link>
              </div>
            ) : null}
          </>
        )}

        {renderTabContent()}
      </div>

      {/* Boas-vindas: gaveta no mobile, diálogo central no desktop */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
            onClick={() => setShowWelcomeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-md rounded-t-3xl bg-background px-6 pb-7 pt-3 sm:rounded-3xl sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-trilho sm:hidden" />
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="hidden">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[26px] font-black leading-[1.08] tracking-[-0.035em] text-foreground">Bem-vindo ao CADEE!</p>
                    <p className="mt-2 text-sm font-extrabold text-foreground-2">Seu controle de planejamento semestral</p>
                  </div>
                </div>
                <button onClick={() => setShowWelcomeModal(false)} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-7 space-y-3">
                <p className="text-sm font-medium leading-relaxed text-foreground">
                  O CADEE te ajuda a montar e acompanhar sua grade do semestre <strong>{currentTerm || 'atual'}</strong>.
                  Planeje disciplinas, acompanhe carga horária e marque resultados ao final do período.
                </p>
                {isFull && (
                  <p className="text-sm font-medium leading-relaxed text-foreground-2">
                    No modo completo, você também pode gerenciar sua formação: registrar disciplinas já cursadas,
                    acompanhar seu progresso e planejar os semestres futuros.
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {isSimplified && (
                  <button
                    onClick={() => {
                      setMode('full');
                      setShowWelcomeModal(false);
                      localStorage.setItem('firstVisit', 'true');
                    }}
                    className="h-12 rounded-full border-[1.5px] border-foreground/20 px-5 text-sm font-bold text-foreground hover:bg-nevoa"
                  >
                    Mudar para modo completo
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowWelcomeModal(false);
                    localStorage.setItem('firstVisit', 'true');
                  }}
                  className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-extrabold text-primary-foreground hover:bg-primary/85"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
};

export default Index;
