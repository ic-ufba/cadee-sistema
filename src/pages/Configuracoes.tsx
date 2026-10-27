import { useRef, useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useMySections } from '@/hooks/useMySections';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useOverallProgress } from '@/hooks/useOverallProgress';
import {
  Sun,
  Moon,
  Trash2,
  RotateCcw,
  User,
  Download,
  Upload,
  Check,
  Clock,
  AlertCircle,
  Save,
  ArrowLeftRight,
} from 'lucide-react';
import { useMode } from '@/hooks/useMode';
import { useSigaaAuth } from '@/hooks/useSigaa';
import { tituloCurso, detalheCurso } from '@/lib/curso-texto';
import { toast } from '@/hooks/use-toast';
import { SigaaSettingsCard } from '@/components/sigaa/SigaaSettingsCard';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Configuracoes = () => {
  const {
    theme,
    toggleTheme,
    setIsOnboarded,
    exportSettings,
    importSettings,
    customCourseWorkload,
    setCustomCourseWorkload,
  } = useApp();
  const { clearSections } = useMySections();
  const { myPrograms } = useMyPrograms();
  const overallProgress = useOverallProgress();
  const { mode, setMode } = useMode();
  const { isConfigured: sigaaConfigurado } = useSigaaAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Verificação se há histórico importado
  const hasImportedHistory = Boolean(localStorage.getItem('progressData'));

  // Estados locais do formulário de carga horária
  const [formMandatory, setFormMandatory] = useState<number | string>(() => {
    if (customCourseWorkload?.enabled) return customCourseWorkload.mandatory;
    return overallProgress.mandatory.total || 0;
  });
  const [formElective, setFormElective] = useState<number | string>(() => {
    if (customCourseWorkload?.enabled) return customCourseWorkload.elective;
    return overallProgress.electives.total || 0;
  });
  const [formComplementary, setFormComplementary] = useState<number | string>(() => {
    if (customCourseWorkload?.enabled) return customCourseWorkload.complementary;
    return overallProgress.complementary.total || 0;
  });

  // Diálogo de confirmação para ativar/desativar
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);

  // Sincronizar estados locais caso as propriedades externas mudem
  useEffect(() => {
    if (customCourseWorkload?.enabled) {
      setFormMandatory(customCourseWorkload.mandatory);
      setFormElective(customCourseWorkload.elective);
      setFormComplementary(customCourseWorkload.complementary);
    } else {
      setFormMandatory(overallProgress.mandatory.total || 0);
      setFormElective(overallProgress.electives.total || 0);
      setFormComplementary(overallProgress.complementary.total || 0);
    }
  }, [
    customCourseWorkload?.enabled,
    customCourseWorkload?.mandatory,
    customCourseWorkload?.elective,
    customCourseWorkload?.complementary,
    overallProgress.mandatory.total,
    overallProgress.electives.total,
    overallProgress.complementary.total,
  ]);

  const hasPrograms = myPrograms.length > 0;

  const handleToggleClick = (checked: boolean) => {
    if (checked) {
      setPendingAction('enable');
      setConfirmDialogOpen(true);
    } else {
      setPendingAction('disable');
      setConfirmDialogOpen(true);
    }
  };

  const handleConfirmAction = () => {
    if (pendingAction === 'enable') {
      const m = Math.max(0, Number(formMandatory) || 0);
      const e = Math.max(0, Number(formElective) || 0);
      const c = Math.max(0, Number(formComplementary) || 0);

      setCustomCourseWorkload({
        enabled: true,
        mandatory: m,
        elective: e,
        complementary: c,
      });

      toast({
        title: "Edição manual ativada",
        description: "Você pode ajustar a carga horária obrigatória, optativa e complementar.",
      });
    } else if (pendingAction === 'disable') {
      setCustomCourseWorkload((prev) => ({
        ...prev,
        enabled: false,
      }));

      toast({
        title: "Edição manual desativada",
        description: "Os requisitos de carga horária padrão foram restaurados.",
      });
    }

    setConfirmDialogOpen(false);
    setPendingAction(null);
  };

  const handleSaveHours = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const m = Math.max(0, Number(formMandatory) || 0);
    const eHours = Math.max(0, Number(formElective) || 0);
    const c = Math.max(0, Number(formComplementary) || 0);

    setCustomCourseWorkload({
      enabled: true,
      mandatory: m,
      elective: eHours,
      complementary: c,
    });

    toast({
      title: "Carga horária atualizada",
      description: `Requisitos definidos para ${m + eHours + c}h no total (${m}h obrigatórias, ${eHours}h optativas, ${c}h complementares).`,
    });
  };

  const calculatedTotal =
    (Number(formMandatory) || 0) +
    (Number(formElective) || 0) +
    (Number(formComplementary) || 0);

  const handleResetAll = () => {
    if (confirm('Tem certeza que deseja resetar todos os dados? Esta ação não pode ser desfeita.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleClearSchedule = () => {
    clearSections();
    toast({
      title: "Grade limpa",
      description: "Todas as turmas foram removidas do planejador."
    });
  };

  const handleAddCourse = () => {
    setIsOnboarded(false);
  };

  const handleExport = async () => {
    const data = exportSettings();
    const blob = new Blob([data], { type: 'application/json' });
    const fileName = `cadee-configuracoes-${new Date().toISOString().split('T')[0]}.json`;
    const file = new File([blob], fileName, { type: 'application/json' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Configurações CADEE',
          text: 'Minhas configurações do CADEE'
        });
        toast({
          title: "Exportação concluída",
          description: "Suas configurações foram compartilhadas."
        });
        return;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Erro ao compartilhar:', error);
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: "Suas configurações foram salvas em um arquivo JSON."
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importSettings(content);

      if (success) {
        setImportSuccess(true);
        toast({
          title: "Importação concluída",
          description: "Suas configurações foram restauradas com sucesso."
        });
        setTimeout(() => setImportSuccess(false), 2000);
      } else {
        toast({
          title: "Erro na importação",
          description: "O arquivo selecionado não é válido.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const totalBarra = Math.max(1, calculatedTotal);
  let numeroSecao = 0;
  const proximo = () => String(++numeroSecao).padStart(2, '0');

  const Linha = ({
    titulo,
    descricao,
    perigo = false,
    acaoTitulo,
    children,
  }: {
    titulo: string;
    descricao: React.ReactNode;
    perigo?: boolean;
    acaoTitulo?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const n = proximo();
    return (
      <section className="flex flex-col border-b border-foreground/10 py-6 md:flex-row md:py-0 last:border-b-0">
        <div className="flex flex-col gap-1.5 md:w-[38%] md:shrink-0 md:border-r md:border-foreground/10 md:py-7 md:pr-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-baseline gap-3 text-[22px] font-black tracking-[-0.03em] text-foreground md:text-xl">
              <span className={`font-mono text-xs font-semibold ${perigo ? 'text-pitanga' : 'text-mar'}`}>{n}</span>
              {titulo}
            </h2>
            {acaoTitulo && <div className="md:hidden">{acaoTitulo}</div>}
          </div>
          <p className="hidden pl-8 text-[13px] leading-relaxed text-foreground-2 md:block">{descricao}</p>
        </div>
        <div className="mt-4 min-w-0 flex-1 md:mt-0 md:py-7 md:pl-8">{children}</div>
      </section>
    );
  };

  return (
    <MainLayout>
      <div className="px-5 pb-6 pt-4 animate-fade-in sm:px-[clamp(20px,4vw,56px)] sm:pt-8">
        {/* HERO */}
        <section className="flex flex-col gap-3 pb-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="flex flex-col gap-3.5">
            <span className="rotulo !text-foreground">Preferências e dados</span>
            <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(30px,2.8vw,40px)]">
              Ajustes
            </h1>
          </div>
          <p className="max-w-[360px] text-[15px] leading-relaxed text-foreground-2 md:text-sm">
            <span className="md:hidden">Tudo fica salvo neste navegador. Exporte um backup para levar a outro aparelho.</span>
            <span className="hidden md:inline">Tudo fica salvo localmente no seu navegador. Exporte um backup para levar a outro dispositivo.</span>
          </p>
        </section>

        <div className="border-t-2 border-foreground">
          {/* Meu curso */}
          <Linha titulo="Meu curso" descricao="Define catálogo, pré-requisitos e carga horária usados em todo o sistema.">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                {hasPrograms ? (
                  <>
                    <span className="truncate text-xl font-black tracking-[-0.03em] text-foreground md:text-[22px]">{tituloCurso(myPrograms[0].title)}</span>
                    <span className="font-mono text-[11px] uppercase text-foreground-2">{[detalheCurso(myPrograms[0]), 'UFBA'].filter(Boolean).join(' · ')}</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-foreground-2">Nenhum curso adicionado</span>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja mudar de curso? Todos os dados serão perdidos e as informações serão reiniciadas.')) {
                    handleAddCourse();
                  }
                }}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-foreground/20 px-[18px] text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span className="md:hidden">Mudar</span>
                <span className="hidden md:inline">Mudar curso</span>
              </button>
            </div>
          </Linha>

          {/* Modo de experiência */}
          <Linha titulo="Modo de experiência" descricao="Troque quando quiser, sem perder dados.">
            <div role="radiogroup" aria-label="Modo de experiência" className="flex flex-col md:flex-row">
              {([
                { valor: 'simplified', titulo: 'Versão simplificada', texto: 'Direto para o Planejador. Ideal para começar rápido.', curto: 'Direto para o Planejador.' },
                { valor: 'full', titulo: 'Versão completa', texto: 'Histórico, progresso, pré-requisitos e semestres futuros.', curto: 'Histórico, progresso e pré-requisitos.' },
              ] as const).map((op, i) => {
                const ativo = mode === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setMode(op.valor)}
                    className={`flex flex-1 items-start gap-3.5 py-4 text-left md:px-6 md:py-1 ${i > 0 ? 'border-t border-foreground/10 md:border-l md:border-t-0' : 'md:pl-2.5'}`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${ativo ? 'border-foreground' : 'border-foreground/25'}`}>
                      {ativo && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 text-[15px] font-extrabold text-foreground md:text-base">
                        {op.titulo}
                        {ativo && <span className="rounded-full bg-dende px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[#1C1B19]">Ativa</span>}
                      </span>
                      <span className="text-[13px] leading-relaxed text-foreground-2">
                        <span className="md:hidden">{op.curto}</span>
                        <span className="hidden md:inline">{op.texto}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Linha>

          {/* Aparência */}
          <Linha titulo="Aparência" descricao="O tema escuro mantém as mesmas cores da grade.">
            <div className="flex w-full rounded-full bg-nevoa p-1 md:inline-flex md:w-auto">
              <button
                onClick={() => theme === 'dark' && toggleTheme()}
                aria-pressed={theme === 'light'}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-[22px] text-[13px] font-bold transition-all md:flex-none ${theme === 'light'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground-2 hover:text-foreground'
                  }`}
              >
                <Sun className="h-4 w-4" />
                <span>Claro</span>
              </button>
              <button
                onClick={() => theme === 'light' && toggleTheme()}
                aria-pressed={theme === 'dark'}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-[22px] text-[13px] font-bold transition-all md:flex-none ${theme === 'dark'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground-2 hover:text-foreground'
                  }`}
              >
                <Moon className="h-4 w-4" />
                <span>Escuro</span>
              </button>
            </div>
          </Linha>

          {/* Conta SIGAA (só quando a API está configurada) */}
          {sigaaConfigurado && (
            <Linha titulo="Conta SIGAA" descricao="Sincronize histórico e turmas direto da sua conta.">
              <SigaaSettingsCard />
            </Linha>
          )}

          {/* Carga horária */}
          <Linha
            titulo="Carga horária do curso"
            descricao="Defina à mão as horas exigidas quando não houver histórico em PDF, quando a importação contar diferente ou quando os dados do SIGAA estiverem inconsistentes."
            acaoTitulo={
              <Switch
                checked={Boolean(customCourseWorkload?.enabled)}
                onCheckedChange={handleToggleClick}
                aria-label="Ativar edição manual de carga horária"
              />
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="hidden md:inline-flex">
                  <Switch
                    id="manual-workload-switch"
                    checked={Boolean(customCourseWorkload?.enabled)}
                    onCheckedChange={handleToggleClick}
                    aria-label="Ativar edição manual de carga horária"
                  />
                </span>
                <span className={`text-sm font-bold md:text-[15px] ${customCourseWorkload?.enabled ? 'text-mar md:text-foreground' : 'text-foreground-2'}`}>
                  {customCourseWorkload?.enabled ? 'Edição manual ativada' : 'Usando os valores do curso'}
                </span>
              </div>

              <div className="flex items-start gap-2.5 rounded-2xl bg-nevoa p-4 text-[13px] leading-relaxed text-foreground-2 md:hidden">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                Use quando não tiver o histórico em PDF ou quando a contagem automática divergir do SIGAA.
              </div>

              {customCourseWorkload?.enabled && (
                <form onSubmit={handleSaveHours} className="flex animate-fade-in flex-col gap-4">
                  <div className="grid grid-cols-1 gap-x-3.5 gap-y-4 md:grid-cols-2">
                    {([
                      { id: 'mandatory-hours', rotulo: 'Obrigatórias', cor: 'bg-mar', valor: formMandatory, set: setFormMandatory, ph: 'Ex: 2400' },
                      { id: 'elective-hours', rotulo: 'Optativas', cor: 'bg-dende', valor: formElective, set: setFormElective, ph: 'Ex: 600' },
                      { id: 'complementary-hours', rotulo: 'Complementares', cor: 'bg-pedra', valor: formComplementary, set: setFormComplementary, ph: 'Ex: 200' },
                    ] as const).map((c, i) => (
                      <div key={c.id} className={`flex flex-col gap-2 ${i === 2 ? 'md:col-span-2' : ''}`}>
                        <Label htmlFor={c.id} className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${c.cor}`} />
                          {c.rotulo}
                        </Label>
                        <div className="relative">
                          <Input
                            id={c.id}
                            type="number"
                            min="0"
                            step="1"
                            value={c.valor}
                            onChange={(e) => c.set(e.target.value)}
                            placeholder={c.ph}
                            className="h-[52px] rounded-2xl pr-10 font-mono text-[17px]"
                          />
                          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">h</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex h-2 gap-1" aria-hidden>
                    <span className="rounded-full bg-mar" style={{ flex: (Number(formMandatory) || 0) / totalBarra }} />
                    <span className="rounded-full bg-dende" style={{ flex: (Number(formElective) || 0) / totalBarra }} />
                    <span className="rounded-full bg-pedra" style={{ flex: (Number(formComplementary) || 0) / totalBarra }} />
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-baseline justify-between gap-3 md:justify-start">
                      <span className="text-[13px] font-bold text-foreground-2">Total resultante</span>
                      <span className="numero text-[34px] leading-none text-foreground">{calculatedTotal}h</span>
                    </div>
                    <button
                      type="submit"
                      className="inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-[22px] text-[15px] font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 md:text-[13px]"
                    >
                      Salvar carga horária
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Linha>

          {/* Backup */}
          <Linha titulo="Backup e sincronização" descricao="Exporte ou importe um arquivo JSON com todas as suas informações.">
            <ul className="mb-5 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm text-foreground-2 md:grid-cols-2 md:text-[13px]">
              {['Turmas e grade horária planejada', 'Disciplinas concluídas e resultados', 'Histórico escolar do SIGAA importado', 'Ajustes manuais da carga horária', 'Curso, preferências e tema'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-mar" strokeWidth={2.6} />
                  {t}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2.5 md:flex">
              <button
                onClick={handleExport}
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground px-5 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa md:h-11"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="md:hidden">Exportar</span>
                <span className="hidden md:inline">Exportar backup</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] px-5 text-[13px] font-bold transition-colors md:h-11 ${
                  importSuccess ? 'border-mar bg-mar text-white' : 'border-foreground/20 text-foreground hover:bg-nevoa'
                }`}
              >
                {importSuccess ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                {importSuccess ? 'Restaurado!' : (<><span className="md:hidden">Importar</span><span className="hidden md:inline">Importar backup</span></>)}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </div>
          </Linha>

          {/* Ações */}
          <Linha titulo="Ações" perigo descricao="Não podem ser desfeitas. Faça um backup antes.">
            <div className="flex flex-col gap-2.5 md:flex-row">
              <button
                onClick={handleClearSchedule}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/20 px-5 text-[13px] font-bold text-foreground transition-colors hover:bg-nevoa md:h-11"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar grade horária
              </button>
              <button
                onClick={handleResetAll}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-pitanga/60 px-5 text-[13px] font-bold text-pitanga transition-colors hover:bg-pitanga-tint md:h-11"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Resetar todos os dados
              </button>
            </div>
          </Linha>
        </div>

        {/* Diálogo de Confirmação para Ativar/Desativar */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction === 'enable'
                  ? hasImportedHistory
                    ? 'Substituir carga horária do histórico?'
                    : 'Ativar edição manual de carga horária?'
                  : 'Restaurar carga horária padrão?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction === 'enable' ? (
                  hasImportedHistory ? (
                    <span>
                      Atenção: Os dados atuais de carga horária do seu curso são baseados no histórico escolar importado do SIGAA. Ao ativar a edição manual, esses requisitos serão substituídos pelos valores informados aqui. Tem certeza de que deseja continuar?
                    </span>
                  ) : (
                    <span>
                      Tem certeza de que deseja ativar a edição manual das horas obrigatórias, optativas e complementares do seu curso?
                    </span>
                  )
                ) : (
                  <span>
                    Ao desativar a edição manual, as horas exigidas do curso voltarão a ser calculadas automaticamente com base no histórico importado ou na matriz curricular padrão. Tem certeza de que deseja restaurar?
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}>
                {pendingAction === 'enable' ? 'Confirmar' : 'Sim, restaurar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rodapé */}
        <footer className="mt-0 flex flex-col gap-2 border-t-2 border-foreground pb-4 pt-4 text-[13px] text-foreground-2 md:flex-row md:items-center md:justify-between">
          <span>
            <span className="font-black text-foreground">cadee<span className="text-dende">.</span></span> Catálogo Auxiliar de Disciplinas e Estruturação de Estudos
          </span>
          <span className="font-mono text-[11px]">
            <a href="https://github.com/FormigTeen" target="_blank" rel="noopener noreferrer" className="text-foreground-2 hover:text-mar">Matheus Freitas</a>
            {' · '}
            <a href="https://github.com/adaah" target="_blank" rel="noopener noreferrer" className="text-foreground-2 hover:text-mar">Eduarda Almeida</a>
            {' · '}orientação Rodrigo Rocha
          </span>
        </footer>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
