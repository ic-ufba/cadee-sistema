import { useEffect, useRef, useState, useMemo } from 'react';
import { Check, Search, Loader2, ChevronDown, X, ArrowRight, Lock, Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useApp } from '@/contexts/AppContext';
import { usePrograms } from '@/hooks/useApi';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { useSigaaAuth, useSigaaHistorico, useSigaaLoginDialog } from '@/hooks/useSigaa';
import { approvedCodes } from '@/lib/sigaaSync';
import { encontrarCursoDoSigaa } from '@/lib/curso-sigaa';
import { iniciais, tituloCurso, turnoCurso } from '@/lib/curso-texto';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { LogoAssinatura } from '@/components/brand/Logo';
import type { Program } from '@/services/api';

const CODIGOS_TURNO = ['MT', 'N', 'T', 'M', 'I', 'MN', 'TN', 'MTN'];

// Função para converter códigos de turno em nomes legíveis
const getTurnoNome = (codigo: string): string => {
  const turnos: Record<string, string> = {
    'M': 'MATUTINO',
    'T': 'TARDE',
    'N': 'NOITE',
    'I': 'INTEGRAL',
    'MT': 'MATUTINO/TARDE',
    'MN': 'MATUTINO/NOITE',
    'TN': 'TARDE/NOITE',
    'MTN': 'MATUTINO/TARDE/NOITE'
  };

  return turnos[codigo] || codigo;
};

/** "BACHARELADO · NOITE" (ou a área, quando o código não é turno) */
function metaCurso(p: Program) {
  return [p.program_type, p.time_code ? getTurnoNome(p.time_code) : null].filter(Boolean).join(' · ');
}

const ITENS_SIGAA = ['Curso, turno e currículo', 'Histórico e disciplinas cursadas', 'Turmas já matriculadas'];

/** Pílula de filtro com menu (cidade, modalidade). */
function FiltroPilula({
  opcoes,
  valor,
  rotuloTodos,
  onSelect,
}: {
  opcoes: string[];
  valor: string;
  rotuloTodos: string;
  onSelect: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const escolher = (v: string) => {
    onSelect(v);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-foreground/20 px-3.5 text-[12.5px] font-extrabold text-foreground transition-colors hover:bg-nevoa lg:h-[50px] lg:px-[18px] lg:text-[13px]',
          isOpen && 'bg-nevoa',
        )}
      >
        <span className="max-w-[140px] truncate">{valor ? tituloCurso(valor) : rotuloTodos}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} strokeWidth={2.4} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-20 mt-1.5 w-max min-w-[200px] overflow-hidden rounded-[18px] bg-popover shadow-lg lg:left-0 lg:right-auto"
          >
            <div role="listbox" className="max-h-60 overflow-y-auto p-1">
              {['', ...opcoes].map((op) => (
                <button
                  key={op || 'todos'}
                  type="button"
                  role="option"
                  aria-selected={valor === op}
                  onClick={() => escolher(op)}
                  className={cn(
                    'w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold',
                    valor === op ? 'bg-primary text-primary-foreground' : 'hover:bg-nevoa',
                  )}
                >
                  {op ? tituloCurso(op) : rotuloTodos}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BotaoTema() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const escuro = mounted && theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Tema claro' : 'Tema escuro'}
      className="hidden h-11 w-11 items-center justify-center rounded-full bg-nevoa text-foreground transition-colors hover:bg-trilho lg:flex"
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const { setIsOnboarded } = useApp();
  const { selectedPrograms, setSelectedPrograms } = useMyPrograms();
  const { data: programs = [], isLoading, error } = usePrograms();
  const { isConfigured, isLoggedIn, session, logout } = useSigaaAuth();
  const { openLogin } = useSigaaLoginDialog();
  const { data: historico, isFetching: lendoHistorico } = useSigaaHistorico(isLoggedIn);
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('SALVADOR');
  const [selectedMode, setSelectedMode] = useState<string>('PRESENCIAL');
  const [selectedId, setSelectedId] = useState<string | null>(selectedPrograms[0] || null);
  const [experienceMode, setExperienceMode] = useState<'simplificada' | 'completa' | null>(null);
  const [modalExperienceMode, setModalExperienceMode] = useState<'simplificada' | 'completa' | null>(null);
  const [showExperienceModal, setShowExperienceModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('experienceMode');
    if (stored === 'simplificada' || stored === 'completa') {
      setExperienceMode(stored);
    }
  }, []);

  // Extrair localizações e modalidades únicas dos programas
  const { locations, modes } = useMemo(() => {
    const locs = new Set<string>();
    const modeSet = new Set<string>();
    (programs as Program[]).forEach(program => {
      if (program.location) locs.add(program.location);
      if (program.mode) modeSet.add(program.mode.toUpperCase());
    });
    return {
      locations: Array.from(locs).sort(),
      modes: Array.from(modeSet).sort()
    };
  }, [programs]);

  // Curso informado pelo SIGAA (vínculo do aluno), quando logado
  const cursoSigaa = session?.curso ?? historico?.vinculo?.curso ?? null;
  const programaSigaa = useMemo(
    () => (isLoggedIn ? encontrarCursoDoSigaa(cursoSigaa, programs as Program[]) : null),
    [isLoggedIn, cursoSigaa, programs],
  );

  // Ao conectar, o curso do SIGAA já vem marcado (o aluno pode trocar)
  useEffect(() => {
    if (programaSigaa) setSelectedId(programaSigaa.id_ref);
  }, [programaSigaa]);

  // Filtrar programas por localização, modalidade e pesquisa
  const filteredPrograms = useMemo(() => {
    let result = [...programs];

    // Filtrar por localização (case insensitive)
    if (selectedLocation) {
      result = result.filter(program =>
        program.location && program.location.toUpperCase() === selectedLocation.toUpperCase()
      );
    }

    // Filtrar por modalidade (case insensitive)
    if (selectedMode) {
      result = result.filter(program =>
        program.mode && program.mode.toUpperCase() === selectedMode.toUpperCase()
      );
    }

    // Aplicar busca fuzzy
    if (search.trim()) {
      result = fuzzyFilter(result, search, ['title', 'program_type', 'mode', 'location']);
    }

    // O curso do SIGAA aparece sempre, no topo
    if (programaSigaa && !search.trim()) {
      result = [programaSigaa, ...result.filter((p) => p.id_ref !== programaSigaa.id_ref)];
    }

    return result;
  }, [programs, selectedLocation, selectedMode, search, programaSigaa]);

  // Resumo do que veio do SIGAA
  const achados = useMemo(() => {
    if (!historico) return [];
    const linhas: { rotulo: string; valor: string }[] = [];
    const curso = programaSigaa
      ? [tituloCurso(programaSigaa.title), turnoCurso(programaSigaa.time_code)].filter(Boolean).join(' · ')
      : cursoSigaa
        ? tituloCurso(cursoSigaa)
        : null;
    if (curso) linhas.push({ rotulo: 'Curso', valor: curso });
    const cursadas = approvedCodes(historico).length;
    linhas.push({ rotulo: 'Histórico', valor: `${cursadas} disciplina${cursadas === 1 ? '' : 's'}` });
    const matriculadas = historico.componentes.filter((c) => c.situacao?.toUpperCase().startsWith('MATR'));
    if (matriculadas.length > 0) {
      const periodo = matriculadas.map((c) => c.periodo).sort().pop();
      const n = matriculadas.filter((c) => c.periodo === periodo).length;
      linhas.push({ rotulo: `Matrícula ${periodo}`, valor: `${n} turma${n === 1 ? '' : 's'}` });
    }
    return linhas;
  }, [historico, programaSigaa, cursoSigaa]);

  const primeiroNome = session?.nome ? tituloCurso(session.nome.trim().split(/\s+/)[0]) : null;

  const handleSelectProgram = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };

  const naoSouEu = async () => {
    if (programaSigaa && selectedId === programaSigaa.id_ref) setSelectedId(null);
    await logout();
  };

  const finalizeExperience = (mode: 'simplificada' | 'completa') => {
    setExperienceMode(mode);
    localStorage.setItem('experienceMode', mode);
    // Sincronizar com o hook useMode
    localStorage.setItem('mode', mode === 'simplificada' ? 'simplified' : 'full');
    setIsOnboarded(true);
    setShowExperienceModal(false);

    // Redirecionar após o estado ser atualizado
    setTimeout(() => {
      if (mode === 'simplificada') {
        navigate('/planejador');
      } else {
        navigate('/');
      }
    }, 100);
  };

  const handleSubmit = () => {
    if (!selectedId) return;
    setSelectedPrograms([selectedId]);

    // Pequeno delay para garantir que o estado foi atualizado antes de finalizar
    setTimeout(() => {
      if (experienceMode) {
        finalizeExperience(experienceMode);
      } else {
        setModalExperienceMode(null);
        setShowExperienceModal(true);
      }
    }, 50);
  };

  const selectedProgram = (programs as Program[]).find((p) => p.id_ref === selectedId);
  const tituloLista = isLoggedIn ? 'Confira o curso' : isConfigured ? 'Ou escolha o curso' : 'Escolha o curso';

  return (
    <>
      <div className="min-h-screen w-full bg-background lg:h-screen lg:overflow-hidden">
        <div className="mx-auto flex min-h-screen w-full max-w-[1328px] flex-col lg:h-full lg:min-h-0 lg:gap-10 lg:px-14 lg:pb-10 lg:pt-8">
          {/* Topo */}
          <header className="flex items-center justify-between gap-4 px-6 pt-[22px] lg:px-0 lg:pt-0">
            <h1 className="sr-only">CADEE</h1>
            <LogoAssinatura />
            <BotaoTema />
          </header>

          <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            {/* Esquerda: título + SIGAA */}
            <div className="flex flex-col lg:min-h-0 lg:gap-7">
              <motion.h2
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="px-6 pt-7 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground lg:px-0 lg:pt-0 lg:text-[52px] lg:leading-none lg:tracking-[-0.045em]"
              >
                Vamos montar
                <br />
                seu semestre
              </motion.h2>

              {isConfigured && !isLoggedIn && (
                <section
                  aria-label="Entrar com o SIGAA"
                  className="mx-4 mt-5 flex flex-col gap-3.5 rounded-3xl bg-mar-claro px-[18px] pb-[18px] pt-5 lg:mx-0 lg:mt-0 lg:flex-1 lg:gap-[22px] lg:rounded-[28px] lg:p-8"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-[17px] font-black tracking-[-0.02em] text-foreground lg:text-2xl lg:tracking-[-0.03em]">Entrar com o SIGAA</span>
                    <span className="rounded-full bg-mar px-2.5 py-1 text-[10.5px] font-extrabold text-white">Mais rápido</span>
                  </div>
                  <ul className="flex flex-col gap-[9px] lg:gap-3">
                    {ITENS_SIGAA.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-[13px] font-semibold text-mar-ink lg:gap-3 lg:text-[15px]">
                        <span aria-hidden className="flex shrink-0 items-center justify-center lg:h-[26px] lg:w-[26px] lg:rounded-full lg:bg-background">
                          <Check className="h-[17px] w-[17px] text-mar lg:h-[15px] lg:w-[15px]" strokeWidth={2.8} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-3 lg:mt-auto">
                    <button
                      type="button"
                      onClick={openLogin}
                      className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-mar text-sm font-extrabold text-white transition-colors hover:bg-mar/90 lg:h-14 lg:text-[15px]"
                    >
                      Entrar com o SIGAA
                      <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
                    </button>
                    <span className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-mar-ink lg:text-xs">
                      <Lock className="h-[13px] w-[13px]" strokeWidth={2.2} />
                      Só leitura. A senha nunca é gravada.
                    </span>
                  </div>
                </section>
              )}

              {isConfigured && isLoggedIn && (
                <section
                  aria-label="SIGAA conectado"
                  className="mx-4 mt-5 flex flex-col gap-4 rounded-3xl bg-mar-claro px-[18px] pb-[18px] pt-5 lg:mx-0 lg:mt-0 lg:flex-1 lg:gap-[22px] lg:rounded-[28px] lg:p-8"
                >
                  <div className="flex items-center gap-3.5">
                    <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mar text-[15px] font-extrabold text-white lg:h-[52px] lg:w-[52px] lg:text-[17px]">
                      {session?.nome ? iniciais(session.nome) : <Check className="h-5 w-5" strokeWidth={2.8} />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xl font-black tracking-[-0.03em] text-foreground lg:text-2xl">
                        {primeiroNome ? `Pronto, ${primeiroNome}!` : 'Pronto!'}
                      </span>
                      <span className="text-[12.5px] font-bold text-mar">SIGAA conectado</span>
                    </span>
                  </div>

                  {achados.length > 0 ? (
                    <div className="flex flex-col">
                      {achados.map((a) => (
                        <div key={a.rotulo} className="flex items-baseline justify-between gap-3 border-b border-mar-tint py-3 lg:py-3.5">
                          <span className="text-[13px] font-semibold text-mar-ink">{a.rotulo}</span>
                          <span className="text-right font-mono text-[13px] font-semibold text-foreground lg:text-[13.5px]">{a.valor}</span>
                        </div>
                      ))}
                    </div>
                  ) : lendoHistorico ? (
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-mar-ink">
                      <Loader2 className="h-4 w-4 animate-spin" /> Importando histórico…
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void naoSouEu()}
                    className="h-11 self-start rounded-full border-[1.5px] border-mar-ink/30 px-[18px] text-[13px] font-extrabold text-mar-ink transition-colors hover:bg-mar-tint lg:mt-auto"
                  >
                    Não sou eu
                  </button>
                </section>
              )}

              {!isConfigured && (
                <p className="hidden items-center gap-1.5 text-xs font-medium text-foreground-2 lg:flex">
                  <Lock className="h-3 w-3" />
                  Seus dados são salvos localmente no navegador
                </p>
              )}
            </div>

            {/* Direita: curso */}
            <section aria-labelledby="titulo-curso" className="flex flex-1 flex-col lg:min-h-0 lg:gap-4">
              {/* Mobile: divisor; desktop: título */}
              <div
                role="separator"
                className={cn(
                  'mx-6 mt-[22px] flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground lg:hidden',
                  !isConfigured && 'hidden',
                )}
              >
                <span className="h-px flex-1 bg-trilho" />
                {tituloLista}
                <span className="h-px flex-1 bg-trilho" />
              </div>

              <div className="flex flex-col gap-2.5 px-6 pt-4 lg:min-h-[104px] lg:justify-end lg:gap-4 lg:px-0 lg:pt-0">
                <h3 id="titulo-curso" className="sr-only text-2xl font-black tracking-[-0.03em] text-foreground lg:not-sr-only">
                  {tituloLista}
                </h3>
                <div className="flex flex-col gap-2.5 lg:flex-row lg:gap-2">
                  <label className="flex h-[50px] min-w-0 items-center lg:flex-1 gap-2.5 rounded-full bg-nevoa px-[18px] text-foreground-2 focus-within:ring-2 focus-within:ring-foreground/15">
                    <Search className="h-[18px] w-[18px] shrink-0" />
                    <span className="sr-only">Pesquisar curso</span>
                    <input
                      type="text"
                      placeholder="Pesquisar curso…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </label>
                  <div className="flex gap-2">
                    <FiltroPilula opcoes={locations} valor={selectedLocation} rotuloTodos="Todas as cidades" onSelect={setSelectedLocation} />
                    <FiltroPilula opcoes={modes} valor={selectedMode} rotuloTodos="Todas as modalidades" onSelect={setSelectedMode} />
                  </div>
                </div>
              </div>

              {/* Lista de cursos */}
              <div className="mt-2 flex-1 px-3 pb-4 lg:-mx-1 lg:mt-0 lg:min-h-0 lg:overflow-y-auto lg:px-1 lg:pb-1 lg:pt-1">
                {isLoading ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-mar" />
                    <p className="text-sm text-muted-foreground">Carregando cursos...</p>
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center py-8">
                    <p className="text-destructive">Erro ao carregar os cursos</p>
                    <p className="mt-1 text-sm text-muted-foreground">Tente novamente mais tarde</p>
                  </div>
                ) : filteredPrograms.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">Nenhum curso encontrado</p>
                    <p className="mt-1 text-sm text-muted-foreground/70">Tente ajustar os filtros de busca</p>
                  </div>
                ) : (
                  <div role="radiogroup" aria-label="Cursos" className="flex flex-col gap-0.5 lg:grid lg:grid-cols-2 lg:gap-2">
                    {filteredPrograms.slice(0, 50).map((program, index) => {
                      const isSelected = selectedId === program.id_ref;
                      const doSigaa = programaSigaa?.id_ref === program.id_ref;
                      return (
                        <motion.button
                          key={program.id_ref}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleSelectProgram(program.id_ref)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.02, 0.25), duration: 0.25 } }}
                          whileTap={{ scale: 0.99 }}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-[13px] text-left text-foreground transition-colors lg:min-h-[76px] lg:rounded-[18px] lg:px-4 lg:py-3.5',
                            isSelected
                              ? 'rounded-2xl bg-mar-claro shadow-[inset_0_0_0_2px_hsl(var(--mar))]'
                              : 'shadow-[inset_0_-1px_0_hsl(var(--trilho))] hover:bg-nevoa/60 lg:shadow-[inset_0_0_0_1.5px_hsl(var(--trilho))]',
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold uppercase leading-[1.25]">{program.title}</span>
                              {doSigaa && (
                                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-extrabold text-mar-ink">do SIGAA</span>
                              )}
                            </span>
                            <span className={cn('text-[11px] font-bold uppercase tracking-[0.06em]', isSelected ? 'text-mar-ink' : 'text-foreground-2')}>
                              {metaCurso(program)}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
                              isSelected ? 'bg-mar' : 'border-2 border-foreground/25',
                            )}
                          >
                            {isSelected && <span className="h-2 w-2 rounded-full bg-background" />}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div className="sticky bottom-0 border-t border-trilho bg-background/95 px-6 pb-5 pt-3.5 backdrop-blur-sm lg:static lg:flex lg:items-center lg:justify-between lg:gap-4 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-5 lg:backdrop-blur-none">
                <span className="hidden flex-col gap-[3px] lg:flex">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Seu curso</span>
                  <span className={cn('text-[15px] font-extrabold', selectedProgram ? 'text-foreground' : 'text-muted-foreground')}>
                    {selectedProgram
                      ? [tituloCurso(selectedProgram.title), tituloCurso(selectedProgram.program_type), CODIGOS_TURNO.includes(selectedProgram.time_code) ? turnoCurso(selectedProgram.time_code) : null]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Nenhum selecionado'}
                  </span>
                </span>
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedId}
                  whileTap={{ scale: selectedId ? 0.98 : 1 }}
                  className={cn(
                    'flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-sm font-extrabold transition-colors lg:h-14 lg:w-auto lg:px-[30px] lg:text-[15px]',
                    selectedId
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'cursor-not-allowed bg-trilho text-muted-foreground',
                  )}
                >
                  {selectedId ? 'Continuar' : 'Selecione um curso'}
                  {selectedId && <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />}
                </motion.button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Modal de escolha de experiência */}
      <AnimatePresence>
        {showExperienceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-overlay/55 sm:items-center sm:p-4"
            onClick={() => setShowExperienceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-lg rounded-t-[28px] bg-background p-6 pb-8 shadow-xl sm:rounded-[28px] sm:pb-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground">Como você quer usar o CADEE?</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Você pode alterar depois nas Configurações.</p>
                </div>
                <button onClick={() => setShowExperienceModal(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nevoa text-foreground-2 hover:text-foreground">
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="mb-5 grid gap-2.5">
                <label className={cn(
                  "flex cursor-pointer flex-row-reverse items-center gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors",
                  modalExperienceMode === 'simplificada' ? "border-foreground bg-nevoa" : "border-foreground/10 hover:bg-nevoa"
                )}>
                  <input
                    type="radio"
                    name="experience-modal"
                    value="simplificada"
                    checked={modalExperienceMode === 'simplificada'}
                    onChange={() => setModalExperienceMode('simplificada')}
                    className="h-[22px] w-[22px] shrink-0 accent-mar"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-extrabold text-foreground">Versão simplificada</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Ir direto para o Planejador. Ideal para começar rápido.</p>
                  </div>
                </label>

                <label className={cn(
                  "flex cursor-pointer flex-row-reverse items-center gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors",
                  modalExperienceMode === 'completa' ? "border-foreground bg-nevoa" : "border-foreground/10 hover:bg-nevoa"
                )}>
                  <input
                    type="radio"
                    name="experience-modal"
                    value="completa"
                    checked={modalExperienceMode === 'completa'}
                    onChange={() => setModalExperienceMode('completa')}
                    className="h-[22px] w-[22px] shrink-0 accent-mar"
                  />
                  <div className="flex-1 text-sm">
                    <p className="font-extrabold text-foreground">Versão completa</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Acesso a todos os recursos. Sempre pode mudar depois.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowExperienceModal(false)}
                  className="h-12 px-5 rounded-full border-[1.5px] border-foreground/20 text-sm font-bold text-foreground hover:bg-nevoa"
                >
                  Voltar
                </button>
                <button
                  onClick={() => modalExperienceMode && finalizeExperience(modalExperienceMode)}
                  disabled={!modalExperienceMode}
                  className={cn(
                    "h-12 flex-1 rounded-full px-6 text-sm font-extrabold",
                    modalExperienceMode
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "cursor-not-allowed bg-nevoa text-muted-foreground"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
