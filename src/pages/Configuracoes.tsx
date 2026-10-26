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
      <div className="p-6 max-w-5xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Ajustes
          </h1>
          <p className="text-muted-foreground">
            Personalize sua experiência no portal
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna 1 */}
          <div className="space-y-6">
            {/* Courses */}
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground">Meu curso</h3>
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
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-xs text-foreground"
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
                className="w-full py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                Mudar Curso
              </button>
            </div>

            {/* Carga Horária Manual do Curso */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">Carga Horária do Curso</h3>
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
              <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-950 dark:text-blue-200 leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block text-blue-900 dark:text-blue-300">
                    Para que serve este ajuste?
                  </span>
                  <p>
                    Esta opção permite definir manualmente a carga horária exigida de disciplinas obrigatórias, optativas e complementares do seu curso.
                  </p>
                  <p className="text-[11px] text-muted-foreground dark:text-blue-200/80">
                    Útil para quem não possui o histórico escolar em PDF, para casos onde houve divergência na contagem automática da importação, ou para quem os dados cadastrados no SIGAA estão inconsistentes.
                  </p>
                </div>
              </div>

              {/* Formulário de Edição (quando ativado) */}
              {customCourseWorkload?.enabled && (
                <form onSubmit={handleSaveHours} className="space-y-4 pt-2 border-t border-border animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Horas Obrigatórias */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mandatory-hours" className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
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
                        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
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
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
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
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-border text-xs">
                    <span className="text-muted-foreground font-medium">Carga Horária Total Resultante:</span>
                    <span className="text-sm font-bold text-foreground">
                      {calculatedTotal}h
                    </span>
                  </div>

                  {/* Botão de Salvar */}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs sm:text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Carga Horária
                  </button>
                </form>
              )}
            </div>

            {/* Theme */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-4">Aparência</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${theme === 'light'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                >
                  <Sun className="w-5 h-5" />
                  <span>Claro</span>
                </button>
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                >
                  <Moon className="w-5 h-5" />
                  <span>Escuro</span>
                </button>
              </div>
            </div>
          </div>

          {/* Coluna 2 */}
          <div className="space-y-6">
            <SigaaSettingsCard />

            {/* Export/Import */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-card-foreground mb-1">Backup & Sincronização</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exporte ou importe um arquivo JSON completo com todas as suas informações e alterações no sistema.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-1">
                <span className="font-medium text-foreground block">Itens inclusos no backup:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
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
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-foreground hover:bg-muted font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar Backup</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-medium text-xs sm:text-sm transition-colors cursor-pointer ${
                    importSuccess
                      ? 'border-success bg-success/10 text-success'
                      : 'border-border text-foreground hover:bg-muted'
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
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold text-card-foreground mb-4">Ações</h3>
              <div className="space-y-3">
                <button
                  onClick={handleClearSchedule}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Limpar grade horária</span>
                </button>
                <button
                  onClick={handleResetAll}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <RotateCcw className="w-5 h-5" />
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
        <div className="text-center text-sm text-muted-foreground pt-12 pb-4">
          <p>CADEE - Catálogo Auxiliar de Disciplinas e Estruturação de Estudos</p>
          <p className="mt-1">Desenvolvido com ❤️ para estudantes</p>
          <p className="mt-1">
            Desenvolvido por{' '}
            <a
              href="https://github.com/FormigTeen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Matheus Freitas (FormigTeen)
            </a>
            {' '}e{' '}
            <a
              href="https://github.com/adaah"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Eduarda Almeida (adaah)
            </a>
          </p>
          <p className="mt-1">
            Orientador:{' '}
            <span className="text-primary">
              Rodrigo Rocha
            </span>
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
