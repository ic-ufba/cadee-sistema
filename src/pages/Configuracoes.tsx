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
} from 'lucide-react';
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

  return (
    <MainLayout>
      <div className="mx-auto max-w-[1100px] animate-fade-in px-5 pb-6 pt-4 sm:px-[clamp(20px,4vw,56px)] sm:pt-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[clamp(30px,2.8vw,40px)]">
            Ajustes
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Personalize sua experiência no portal
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
          {/* Coluna 1 */}
          <div className="space-y-10">
            {/* Courses */}
            <div className="border-t-2 border-foreground pt-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-nevoa">
                  <User className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.03em] text-foreground">Meu curso</h3>
                  {!hasPrograms && (
                    <p className="text-sm text-muted-foreground">Nenhum curso adicionado</p>
                  )}
                </div>
              </div>
              {/* Lista de cursos como tags */}
              {hasPrograms && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {myPrograms.map((program) => (
                    <span
                      key={program.id_ref}
                      className="inline-flex items-center gap-2 rounded-full bg-mar-claro px-3.5 py-1.5 text-[13px] font-bold text-mar-ink"
                      title={`${program.title} • ${program.location}`}
                    >
                      <span className="max-w-[220px] truncate">{program.title}</span>
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja mudar de curso? Todos os dados serão perdidos e as informações serão reiniciadas.')) {
                    handleAddCourse();
                  }
                }}
                className="h-11 w-full rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground transition-colors hover:bg-nevoa"
              >
                Mudar Curso
              </button>
            </div>

            {/* Carga Horária Manual do Curso */}
            <div className="space-y-4 border-t-2 border-foreground pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa">
                    <Clock className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-[22px] font-black tracking-[-0.03em] text-foreground">Carga horária do curso</h3>
                    <p className="text-xs text-muted-foreground">
                      {customCourseWorkload?.enabled
                        ? 'Edição manual ativada'
                        : 'Valores de carga horária do curso'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="manual-workload-switch"
                    checked={Boolean(customCourseWorkload?.enabled)}
                    onCheckedChange={handleToggleClick}
                    aria-label="Ativar edição manual de carga horária"
                  />
                </div>
              </div>

              {/* Quadro Informativo */}
              <div className="flex items-start gap-2.5 rounded-[18px] bg-mar-claro p-4 text-xs leading-relaxed text-mar-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-mar" />
                <div className="space-y-1">
                  <span className="block text-[13px] font-extrabold text-mar-ink">
                    Para que serve este ajuste?
                  </span>
                  <p>
                    Esta opção permite definir manualmente a carga horária exigida de disciplinas obrigatórias, optativas e complementares do seu curso.
                  </p>
                  <p className="text-[11px] opacity-80">
                    Útil para quem não possui o histórico escolar em PDF, para casos onde houve divergência na contagem automática da importação, ou para quem os dados cadastrados no SIGAA estão inconsistentes.
                  </p>
                </div>
              </div>

              {/* Formulário de Edição (quando ativado) */}
              {customCourseWorkload?.enabled && (
                <form onSubmit={handleSaveHours} className="animate-fade-in space-y-4 border-t border-foreground/10 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Horas Obrigatórias */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mandatory-hours" className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-mar" />
                        Obrigatórias (h)
                      </Label>
                      <Input
                        id="mandatory-hours"
                        type="number"
                        min="0"
                        step="1"
                        value={formMandatory}
                        onChange={(e) => setFormMandatory(e.target.value)}
                        placeholder="Ex: 2400"
                        className="text-sm font-medium"
                      />
                    </div>

                    {/* Horas Optativas */}
                    <div className="space-y-1.5">
                      <Label htmlFor="elective-hours" className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-dende" />
                        Optativas (h)
                      </Label>
                      <Input
                        id="elective-hours"
                        type="number"
                        min="0"
                        step="1"
                        value={formElective}
                        onChange={(e) => setFormElective(e.target.value)}
                        placeholder="Ex: 600"
                        className="text-sm font-medium"
                      />
                    </div>

                    {/* Horas Complementares */}
                    <div className="space-y-1.5">
                      <Label htmlFor="complementary-hours" className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ouro" />
                        Complementares (h)
                      </Label>
                      <Input
                        id="complementary-hours"
                        type="number"
                        min="0"
                        step="1"
                        value={formComplementary}
                        onChange={(e) => setFormComplementary(e.target.value)}
                        placeholder="Ex: 200"
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>

                  {/* Resumo do Total */}
                  <div className="flex items-center justify-between rounded-[14px] bg-nevoa px-4 py-3 text-xs">
                    <span className="rotulo">Carga horária total resultante</span>
                    <span className="font-mono text-base font-bold text-foreground">
                      {calculatedTotal}h
                    </span>
                  </div>

                  {/* Botão de Salvar */}
                  <button
                    type="submit"
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Carga Horária
                  </button>
                </form>
              )}
            </div>

            {/* Theme */}
            <div className="border-t-2 border-foreground pt-5">
              <h3 className="mb-4 text-[22px] font-black tracking-[-0.03em] text-foreground">Aparência</h3>
              <div className="flex gap-1 rounded-full bg-nevoa p-1">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition-all ${theme === 'light'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground-2 hover:text-foreground'
                    }`}
                >
                  <Sun className="h-[18px] w-[18px]" />
                  <span>Claro</span>
                </button>
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold transition-all ${theme === 'dark'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground-2 hover:text-foreground'
                    }`}
                >
                  <Moon className="h-[18px] w-[18px]" />
                  <span>Escuro</span>
                </button>
              </div>
            </div>
          </div>

          {/* Coluna 2 */}
          <div className="space-y-10">
            <SigaaSettingsCard />

            {/* Export/Import */}
            <div className="space-y-4 border-t-2 border-foreground pt-5">
              <div>
                <h3 className="mb-1 text-[22px] font-black tracking-[-0.03em] text-foreground">Backup & sincronização</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exporte ou importe um arquivo JSON completo com todas as suas informações e alterações no sistema.
                </p>
              </div>

              <div className="space-y-1.5 rounded-[18px] bg-nevoa p-4 text-xs text-foreground-2">
                <span className="rotulo block">Itens inclusos no backup</span>
                <ul className="list-inside list-disc space-y-0.5 text-[12px] font-medium">
                  <li>Turmas e grade horária planejada</li>
                  <li>Disciplinas concluídas e resultados por período</li>
                  <li>Histórico escolar do SIGAA importado</li>
                  <li>Ajustes manuais da carga horária do curso</li>
                  <li>Curso selecionado, preferências e tema</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/20 text-xs font-bold text-foreground transition-colors hover:bg-nevoa sm:text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar Backup</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] text-xs font-bold transition-colors sm:text-sm ${
                    importSuccess
                      ? 'border-mar bg-mar text-white'
                      : 'border-foreground/20 text-foreground hover:bg-nevoa'
                  }`}
                >
                  {importSuccess ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  <span>{importSuccess ? 'Restaurado!' : 'Importar Backup'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="border-t-2 border-foreground pt-5">
              <h3 className="mb-4 text-[22px] font-black tracking-[-0.03em] text-foreground">Ações</h3>
              <div className="space-y-2.5">
                <button
                  onClick={handleClearSchedule}
                  className="flex h-[52px] w-full items-center gap-3 rounded-[18px] bg-nevoa px-4 text-sm font-bold text-foreground transition-colors hover:bg-trilho"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                  <span>Limpar grade horária</span>
                </button>
                <button
                  onClick={handleResetAll}
                  className="flex h-[52px] w-full items-center gap-3 rounded-[18px] bg-pitanga-tint px-4 text-sm font-bold text-pitanga-ink transition-colors hover:bg-pitanga hover:text-white"
                >
                  <RotateCcw className="h-[18px] w-[18px]" />
                  <span>Resetar todos os dados</span>
                </button>
              </div>
            </div>
          </div>
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

        {/* Footer */}
        <div className="mt-14 border-t border-foreground/10 pb-4 pt-8 text-center text-[13px] font-medium text-muted-foreground">
          <p>CADEE - Catálogo Auxiliar de Disciplinas e Estruturação de Estudos</p>
          <p className="mt-1">Desenvolvido com ❤️ para estudantes</p>
          <p className="mt-1">
            Desenvolvido por{' '}
            <a
              href="https://github.com/FormigTeen"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-mar hover:underline"
            >
              Matheus Freitas (FormigTeen)
            </a>
            {' '}e{' '}
            <a
              href="https://github.com/adaah"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-mar hover:underline"
            >
              Eduarda Almeida (adaah)
            </a>
          </p>
          <p className="mt-1">
            Orientador:{' '}
            <span className="text-mar">
              Rodrigo Rocha
            </span>
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
