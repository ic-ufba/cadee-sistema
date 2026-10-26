import { useMemo, useState, useEffect } from 'react';
import { useMySections } from '@/hooks/useMySections';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useMyCourses } from '@/hooks/useMyCourses';
import { ScheduleSummary } from '@/components/planner/ScheduleSummary';
import { useCurrentTerm } from '@/hooks/useCurrentTerm';
import { useSemesterTransition } from '@/hooks/useSemesterTransition';
import { useOverallProgress } from '@/hooks/useOverallProgress';
import { Calendar, BookOpen, BarChart3, X, Sparkles, GraduationCap, Clock, AlertTriangle, Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProgressView } from '@/components/progress/ProgressView';
import { SigaaInsights } from '@/components/sigaa/SigaaInsights';
import { AnimatePresence, motion } from 'framer-motion';
import { useMode } from '@/hooks/useMode';
import { usePlannedDisciplineCategories } from '@/hooks/usePlannedDisciplineCategories';
import { InfoPopup } from '@/components/ui/info-popup';

const Index = () => {
  const { mySections } = useMySections();
  const { myPrograms } = useMyPrograms();
  const { courses } = useMyCourses();
  const { currentTerm } = useCurrentTerm();
  const { pendingTransition, planningTerm, canAdvance, advanceToNewSemester, unresolvedCodes } = useSemesterTransition();
  const overallProgress = useOverallProgress();
  const { scheduledCount, disciplinesCount, workloadBreakdown } = usePlannedDisciplineCategories();
  const [activeTab, setActiveTab] = useState<'schedule' | 'progress'>('schedule');
  const { setMode, isFull, isSimplified } = useMode();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasImportedHistory, setHasImportedHistory] = useState(false);

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
      return (
        <>
          <SigaaInsights />
          <ProgressView />
        </>
      );
    }
    return <ScheduleSummary />;
  };

  return (
    <MainLayout>
      <div className="px-5 pt-4 sm:px-[clamp(20px,4vw,56px)] sm:pt-8 animate-fade-in">
        {/* Cabeçalho */}
        <div className="mb-7 sm:mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-h-5 items-center gap-2">
                {myPrograms.length > 0 && (
                  <span className="rotulo flex min-w-0 items-center gap-2">
                    <GraduationCap className="hidden h-4 w-4 shrink-0" />
                    <span className="truncate">UFBA · {myPrograms[0]?.title || 'Seu Curso'}</span>
                  </span>
                )}
                {currentTerm && activeTab === 'schedule' && (
                  <span className="shrink-0 rounded-full bg-mar px-2.5 py-0.5 font-mono text-xs font-semibold text-white">
                    {pendingTransition ? planningTerm : currentTerm}
                  </span>
                )}
              </div>
              <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(30px,2.8vw,40px)]">
                {activeTab === 'schedule' ? 'Controle do semestre' : 'Meu progresso'}
              </h1>
            </div>

            {/* Abas */}
            <div className="grid w-full grid-cols-2 rounded-full bg-nevoa p-1 lg:w-[360px]">
              <button
                onClick={() => setActiveTab('schedule')}
                className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-all ${activeTab === 'schedule'
                    ? 'bg-primary font-extrabold text-primary-foreground'
                    : 'font-bold text-foreground-2 hover:text-foreground'
                  }`}
              >
                <Calendar className="h-4 w-4" />
                Planejamento
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-all ${activeTab === 'progress'
                    ? 'bg-primary font-extrabold text-primary-foreground'
                    : 'font-bold text-foreground-2 hover:text-foreground'
                  }`}
              >
                <BarChart3 className="h-4 w-4" />
                Progresso
              </button>
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

            <div className={`mb-8 grid border-t-2 border-foreground ${isFull && hasImportedHistory ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
              <div className="grid min-h-[120px] grid-cols-2 divide-x divide-border">
                {/* Disciplinas planejadas */}
                <div className="flex h-full flex-col justify-start gap-3 py-5 pr-4 sm:pr-6">
                  <div className="flex h-5 items-center gap-2">
                    <BookOpen className="hidden h-4 w-4 shrink-0" />
                    <span className="rotulo">Disciplinas</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="numero text-[38px] text-foreground sm:text-[48px]">{scheduledCount}</p>
                    <p className="text-xs font-semibold text-muted-foreground sm:text-[13px]">na grade</p>
                  </div>
                  <div className="flex h-1.5 gap-[3px]" aria-hidden>
                    <span className="rounded-full bg-mar" style={{ flex: disciplinesCount.mandatory }} />
                    <span className="rounded-full bg-dende" style={{ flex: disciplinesCount.elective }} />
                    <span className="rounded-full bg-ouro" style={{ flex: disciplinesCount.offered }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-mar"></span>
                      Obrigatórias <span className="ml-auto font-black text-foreground">{disciplinesCount.mandatory}</span>
                    </p>
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-dende"></span>
                      Optativas <span className="ml-auto font-black text-foreground">{disciplinesCount.elective}</span>
                    </p>
                    {disciplinesCount.offered > 0 && (
                      <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-ouro"></span>
                        Ofertadas <span className="ml-auto font-black text-foreground">{disciplinesCount.offered}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Carga horária */}
                <div className="flex h-full flex-col justify-start gap-3 py-5 pl-4 sm:pl-6 lg:pr-6">
                  <div className="flex h-5 items-center gap-2">
                    <Clock className="hidden h-4 w-4 shrink-0" />
                    <span className="rotulo">Carga horária</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="numero flex items-baseline text-[38px] text-foreground sm:text-[48px]">
                      {workloadBreakdown.total}
                      <span className="ml-0.5 text-lg font-extrabold tracking-normal text-foreground sm:text-2xl">h</span>
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground sm:text-[13px]">nesse semestre</p>
                  </div>
                  <div className="flex h-1.5 gap-[3px]" aria-hidden>
                    <span className="rounded-full bg-mar" style={{ flex: workloadBreakdown.mandatory }} />
                    <span className="rounded-full bg-dende" style={{ flex: workloadBreakdown.elective }} />
                    <span className="rounded-full bg-ouro" style={{ flex: workloadBreakdown.offered }} />
                    <span className="rounded-full bg-foreground-2" style={{ flex: workloadBreakdown.complementary }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-mar"></span>
                      Obrigatórias <span className="ml-auto font-mono font-semibold text-foreground">{workloadBreakdown.mandatory}h</span>
                    </p>
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-dende"></span>
                      Optativas <span className="ml-auto font-mono font-semibold text-foreground">{workloadBreakdown.elective}h</span>
                    </p>
                    {workloadBreakdown.offered > 0 && (
                      <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-ouro"></span>
                        Ofertadas <span className="ml-auto font-mono font-semibold text-foreground">{workloadBreakdown.offered}h</span>
                      </p>
                    )}
                    {workloadBreakdown.complementary > 0 && (
                      <p className="flex items-center gap-2 text-xs font-semibold text-foreground-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-foreground-2"></span>
                        Comp. <span className="ml-auto font-mono font-semibold text-foreground">{workloadBreakdown.complementary}h</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {isFull && hasImportedHistory && (
                <div className="flex flex-col gap-4 border-t border-border py-5 lg:border-l lg:border-t-0 lg:pl-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="hidden h-4 w-4 shrink-0" />
                    <span className="text-lg font-black tracking-[-0.03em] text-foreground sm:text-xl">Prévia da progressão</span>
                    <InfoPopup
                      iconClassName="w-4 h-4"
                      content="Estimativa do progresso da sua formação ao concluir com aprovação as disciplinas planejadas na grade deste semestre."
                    />
                  </div>

                  {/* Geral */}
                  <div>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="rotulo">Geral</span>
                        <span className="numero text-[38px] text-foreground sm:text-[44px]">{overallProgress.projected.overallProgress.toFixed(1)}%</span>
                      </div>
                      <p className="pb-1 font-mono text-xs text-muted-foreground">
                        {overallProgress.projected.totalHours}h / {overallProgress.totalRequiredHours}h
                      </p>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-trilho">
                      <div
                        className="h-full rounded-full bg-foreground transition-all duration-500"
                        style={{ width: `${Math.min(overallProgress.projected.overallProgress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    {/* Obrigatórias */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-foreground-2">Obrigatórias</span>
                      <span className="text-[26px] font-black leading-none tracking-[-0.04em] text-mar">
                        {overallProgress.projected.mandatory.total > 0
                          ? Math.min(100, (overallProgress.projected.mandatory.completed / overallProgress.projected.mandatory.total) * 100).toFixed(1)
                          : 0}%
                      </span>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-trilho">
                        <div
                          className="h-full rounded-full bg-mar transition-all duration-500"
                          style={{
                            width: `${Math.min(overallProgress.projected.mandatory.total > 0
                              ? (overallProgress.projected.mandatory.completed / overallProgress.projected.mandatory.total) * 100
                              : 0, 100)}%`
                          }}
                        />
                      </div>
                      <p className="flex flex-wrap justify-between gap-x-2 font-mono text-[11px] text-muted-foreground">
                        <span>{Math.min(overallProgress.projected.mandatory.completed, overallProgress.projected.mandatory.total)}h / {overallProgress.projected.mandatory.total}h</span>
                        {overallProgress.projected.mandatory.completed > overallProgress.projected.mandatory.total && (
                          <span className="font-semibold text-mar-ink">+{overallProgress.projected.mandatory.completed - overallProgress.projected.mandatory.total}h excedentes</span>
                        )}
                      </p>
                    </div>

                    {/* Optativas */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-foreground-2">Optativas</span>
                      <span className="text-[26px] font-black leading-none tracking-[-0.04em] text-dende-ink dark:text-dende">
                        {overallProgress.projected.electives.total > 0
                          ? Math.min(100, (overallProgress.projected.electives.completed / overallProgress.projected.electives.total) * 100).toFixed(1)
                          : 0}%
                      </span>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-trilho">
                        <div
                          className="h-full rounded-full bg-dende transition-all duration-500"
                          style={{
                            width: `${Math.min(overallProgress.projected.electives.total > 0
                              ? (overallProgress.projected.electives.completed / overallProgress.projected.electives.total) * 100
                              : 0, 100)}%`
                          }}
                        />
                      </div>
                      <p className="flex flex-wrap justify-between gap-x-2 font-mono text-[11px] text-muted-foreground">
                        <span>{Math.min(overallProgress.projected.electives.completed, overallProgress.projected.electives.total)}h / {overallProgress.projected.electives.total}h</span>
                        {overallProgress.projected.electives.completed > overallProgress.projected.electives.total && (
                          <span className="font-semibold text-dende-ink">+{overallProgress.projected.electives.completed - overallProgress.projected.electives.total}h excedentes</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
            ) : (
              !pendingTransition && (
                <div className="mb-2 flex justify-end">
                  <Link
                    to="/planejador"
                    className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-extrabold text-mar hover:text-foreground"
                  >
                    Editar grade no Planejador
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )
            )}
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
                    <p className="mt-1.5 text-sm font-bold text-foreground-2">Seu controle de planejamento semestral</p>
                  </div>
                </div>
                <button onClick={() => setShowWelcomeModal(false)} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground hover:bg-trilho">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-7 space-y-3">
                <p className="text-sm font-medium leading-relaxed text-foreground">
                  O CADEE te ajuda a montar e acompanhar sua grade do semestre {currentTerm || 'atual'}.
                  Planeje disciplinas, acompanhe carga horária e marque resultados ao final do período.
                </p>
                {isFull && (
                  <p className="text-sm font-medium leading-relaxed text-foreground-2">
                    No modo completo, você também pode gerenciar sua formação: registrar disciplinas já cursadas,
                    acompanhar seu progresso e planejar os semestres futuros.
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
                  className="h-12 rounded-full bg-primary px-6 text-sm font-extrabold text-primary-foreground hover:bg-primary/85"
                >
                  Continuar
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
