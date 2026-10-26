import { useEffect, useRef, useState, useMemo } from 'react';
import { Check, GraduationCap, Search, Loader2, MapPin, ChevronDown, Filter, X, School, BookOpen, Sun, Sunset, Moon, Clock } from 'lucide-react';
import { AnimatePresence, motion, AnimatePresence as MotionPresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { usePrograms } from '@/hooks/useApi';
import { useMyPrograms } from '@/hooks/useMyPrograms';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { LogoAssinatura } from '@/components/brand/Logo';

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

// Componente para o dropdown de localização
function LocationFilter({ locations, selectedLocation, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Encurtar o texto da localização se for muito longo
  const displayLocation = useMemo(() => {
    if (!selectedLocation) return 'Todas as localizações';
    return selectedLocation.length > 15 ? `${selectedLocation.substring(0, 12)}...` : selectedLocation;
  }, [selectedLocation]);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-full bg-nevoa px-4",
          "text-[13px] font-bold text-foreground transition-colors hover:bg-trilho",
          isOpen && "ring-2 ring-foreground/15"
        )}
      >
        <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{displayLocation}</span>
        <ChevronDown className={cn("w-4 h-4 ml-auto flex-shrink-0 text-muted-foreground/70 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 mt-1.5 w-full min-w-[200px] overflow-hidden rounded-[18px] bg-popover shadow-lg"
          >
            <div className="p-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onSelect('');
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold",
                  !selectedLocation 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-nevoa"
                )}
              >
                Todas as localizações
              </button>
              {locations.map((location) => (
                <button
                  key={location}
                  onClick={() => {
                    onSelect(location);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold",
                    selectedLocation === location
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-nevoa"
                  )}
                >
                  {location}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Componente para o dropdown de modalidade
function ModeFilter({ modes, selectedMode, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Encurtar o texto da modalidade se for muito longo
  const displayMode = useMemo(() => {
    if (!selectedMode) return 'Todas as modalidades';
    return selectedMode.length > 15 ? `${selectedMode.substring(0, 12)}...` : selectedMode;
  }, [selectedMode]);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-full bg-nevoa px-4",
          "text-[13px] font-bold text-foreground transition-colors hover:bg-trilho",
          isOpen && "ring-2 ring-foreground/15"
        )}
      >
        <Filter className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{displayMode}</span>
        <ChevronDown className={cn("w-4 h-4 ml-auto flex-shrink-0 text-muted-foreground/70 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-10 mt-1.5 w-full min-w-[200px] overflow-hidden rounded-[18px] bg-popover shadow-lg"
          >
            <div className="p-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onSelect('');
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold",
                  !selectedMode 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-nevoa"
                )}
              >
                Todas as modalidades
              </button>
              {modes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onSelect(mode);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold",
                    selectedMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-nevoa"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const { setIsOnboarded } = useApp();
  const { selectedPrograms, setSelectedPrograms } = useMyPrograms();
  const { data: programs = [], isLoading, error } = usePrograms();
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
    (programs as any[]).forEach(program => {
      if (program.location) locs.add(program.location);
      if (program.mode) modeSet.add(program.mode.toUpperCase());
    });
    return {
      locations: Array.from(locs).sort(),
      modes: Array.from(modeSet).sort()
    };
  }, [programs]);
  
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
      return fuzzyFilter(result, search, ['title', 'program_type', 'mode', 'location']);
    }
    
    return result;
  }, [programs, selectedLocation, selectedMode, search]);

  const handleSelectProgram = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };

  const clearSelection = () => {
    setSelectedId(null);
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
  
  const selectedProgram = programs.find((p: any) => p.id_ref === selectedId);

  return (
    <>
      <div className="flex min-h-screen w-full items-start justify-center bg-background p-5 pt-6 sm:items-start sm:pt-12">
        <div className="w-full max-w-2xl h-auto max-h-[calc(100vh-2rem)] sm:h-[calc(100vh-6rem)] flex flex-col animate-fade-in overflow-hidden">
          {/* Header */}
          <motion.div 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-7 flex items-center gap-3 px-1 sm:mb-9"
          >
            <h1 className="sr-only">CADEE</h1>
            <LogoAssinatura />
          </motion.div>

        {/* Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex max-h-[calc(100vh-10rem)] flex-1 flex-col overflow-hidden bg-background sm:h-full sm:max-h-[none]"
        >
          <div className="flex flex-1 flex-col overflow-hidden px-1 pt-1">
            <h2 className="mb-4 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[36px]">
              Selecione seu curso
            </h2>

            {/* Filtros */}
            <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
              {/* Barra de busca */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar curso..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-12 w-full rounded-full bg-nevoa pl-11 pr-4 text-[15px] font-medium text-foreground transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>
              
              {/* Filtros de localização e modalidade */}
              <div className="grid grid-cols-2 gap-2">
                <LocationFilter 
                  locations={locations} 
                  selectedLocation={selectedLocation} 
                  onSelect={setSelectedLocation} 
                />
                
                <ModeFilter 
                  modes={modes}
                  selectedMode={selectedMode}
                  onSelect={setSelectedMode}
                />
              </div>
            </div>

            {/* Course List */}
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto border-t-2 border-foreground px-1 pb-4 pt-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-12 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-mar" />
                  <p className="text-sm text-muted-foreground">Carregando cursos...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <p className="text-destructive">Erro ao carregar os cursos</p>
                  <p className="text-sm text-muted-foreground mt-1">Tente novamente mais tarde</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {filteredPrograms.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-8"
                      >
                        <p className="text-muted-foreground">Nenhum curso encontrado</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                          Tente ajustar os filtros de busca
                        </p>
                      </motion.div>
                    ) : (
                      filteredPrograms.slice(0, 50).map((program, index) => {
                        const isSelected = selectedId === program.id_ref;
                        return (
                          <motion.button
                            key={program.id_ref}
                            layout
                            onClick={() => handleSelectProgram(program.id_ref)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              transition: { 
                                delay: Math.min(index * 0.03, 0.3),
                                duration: 0.3
                              }
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "flex w-full items-start rounded-[18px] p-4 text-left transition-all",
                              "border-[1.5px]",
                              isSelected
                                ? "border-foreground bg-nevoa"
                                : "border-foreground/10 bg-background hover:bg-nevoa"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div>
                                <p className="truncate text-sm font-extrabold uppercase text-foreground">
                                  {program.title}
                                </p>
                                {/* Mostrar a área apenas se não for um código de turno */}
                                {program.program_type === 'BACHARELADO' && 
                                 program.time_code && 
                                 !['MT', 'N', 'T', 'M', 'I', 'MN', 'TN', 'MTN'].includes(program.time_code) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {program.time_code}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {program.program_type && (
                                  <span className="inline-flex items-center text-xs text-muted-foreground">
                                    {program.program_type === 'BACHARELADO' ? (
                                      <GraduationCap className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    ) : program.program_type === 'LICENCIATURA' ? (
                                      <School className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    ) : (
                                      <BookOpen className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    )}
                                    {program.program_type}
                                  </span>
                                )}
                                {program.time_code && (program.time_code === 'MT' || program.time_code === 'N' || program.time_code === 'T' || program.time_code === 'M' || program.time_code === 'I' || program.time_code === 'MN' || program.time_code === 'TN' || program.time_code === 'MTN') && (
                                  <span className="inline-flex items-center text-xs text-muted-foreground">
                                    {program.time_code === 'M' || program.time_code === 'MT' ? (
                                      <Sun className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    ) : program.time_code === 'T' ? (
                                      <Sunset className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    ) : program.time_code === 'N' ? (
                                      <Moon className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    ) : (
                                      <Clock className="w-3 h-3 mr-1.5 text-muted-foreground/70" />
                                    )}
                                    {getTurnoNome(program.time_code)}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 ml-3 flex items-center h-5">
                              <div className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors",
                                isSelected 
                                  ? "border-mar bg-mar"
                                  : "border-foreground/20"
                              )}>
                                {isSelected && (
                                  <motion.span
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-white"
                                  >
                                    <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                                  </motion.span>
                                )}
                              </div>
                            </div>
                          </motion.button>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Bottom Section - Fixed */}
            <div className="sticky bottom-0 left-0 right-0 -mx-1 -mb-4 border-t border-foreground/10 bg-background/95 px-1 pb-4 pt-3 backdrop-blur-sm sm:mb-0 sm:mt-auto sm:pb-6 sm:pt-4">
              {/* Selected Program Preview */}
              {selectedProgram && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative mb-3 rounded-[18px] bg-mar-claro p-3.5"
                >
                  <button
                    onClick={clearSelection}
                    className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-foreground-2 transition-colors hover:text-foreground"
                    aria-label="Remover seleção"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <h3 className="rotulo mb-1.5 !text-mar-ink">Curso selecionado</h3>
                  <div className="flex items-start">
                    <div className="mr-2.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mar">
                      <GraduationCap className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold uppercase text-foreground">{selectedProgram.title}</p>
                      {selectedProgram.program_type === 'BACHARELADO' && 
                       selectedProgram.time_code && 
                       !['MT', 'N', 'T', 'M', 'I', 'MN', 'TN', 'MTN'].includes(selectedProgram.time_code) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedProgram.time_code}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {selectedProgram.program_type}
                        {selectedProgram.time_code && (selectedProgram.time_code === 'MT' || selectedProgram.time_code === 'N' || selectedProgram.time_code === 'T' || selectedProgram.time_code === 'M' || selectedProgram.time_code === 'I' || selectedProgram.time_code === 'MN' || selectedProgram.time_code === 'TN' || selectedProgram.time_code === 'MTN') && (
                          ` • ${getTurnoNome(selectedProgram.time_code)}`
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.button
                onClick={handleSubmit}
                disabled={!selectedId}
                whileTap={{ scale: selectedId ? 0.98 : 1 }}
                className={cn(
                  "flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-colors",
                  selectedId
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-nevoa text-muted-foreground"
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                {selectedId ? 'Continuar' : 'Selecione um curso'}
                {selectedId && (
                  <Check className="w-4 h-4" />
                )}
              </motion.button>

              <p className="text-[11px] sm:text-xs text-center text-muted-foreground mt-2 sm:mt-3">
                Seus dados são salvos localmente no navegador
              </p>
            </div>
          </div>
          
          </motion.div>
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

              <div className="mb-5 grid gap-2.5 sm:grid-cols-2">
                <label className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors",
                  modalExperienceMode === 'simplificada' ? "border-foreground bg-nevoa" : "border-foreground/10 hover:bg-nevoa"
                )}>
                  <input
                    type="radio"
                    name="experience-modal"
                    value="simplificada"
                    checked={modalExperienceMode === 'simplificada'}
                    onChange={() => setModalExperienceMode('simplificada')}
                    className="mt-1 accent-mar"
                  />
                  <div className="text-sm">
                    <p className="font-extrabold text-foreground">Versão simplificada</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Ir direto para o Planejador. Ideal para começar rápido.</p>
                  </div>
                </label>

                <label className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] p-4 transition-colors",
                  modalExperienceMode === 'completa' ? "border-foreground bg-nevoa" : "border-foreground/10 hover:bg-nevoa"
                )}>
                  <input
                    type="radio"
                    name="experience-modal"
                    value="completa"
                    checked={modalExperienceMode === 'completa'}
                    onChange={() => setModalExperienceMode('completa')}
                    className="mt-1 accent-mar"
                  />
                  <div className="text-sm">
                    <p className="font-extrabold text-foreground">Versão completa</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Acesso a todos os recursos. Sempre pode mudar depois.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 justify-end">
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
                    "h-12 rounded-full px-6 text-sm font-extrabold",
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
