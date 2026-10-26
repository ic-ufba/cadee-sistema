import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { DisciplineStatus, SemesterOutcome } from '@/lib/semester';
import { emptySemesterOutcome } from '@/lib/semester';

export interface CustomCourseWorkload {
  enabled: boolean;
  mandatory: number;
  elective: number;
  complementary: number;
}

interface AppSettings {
  completedDisciplines: string[];
  isOnboarded: boolean;
}

interface AppContextType {
  completedDisciplines: string[];
  toggleCompletedDiscipline: (code: string) => void;
  disciplineStatuses: Record<string, DisciplineStatus>;
  getDisciplineStatus: (code: string) => DisciplineStatus | null;
  setDisciplineStatus: (code: string, status: DisciplineStatus, term?: string) => void;
  clearDisciplineStatus: (code: string, term?: string) => void;
  semesterOutcomes: Record<string, SemesterOutcome>;
  customCourseWorkload: CustomCourseWorkload;
  setCustomCourseWorkload: (value: CustomCourseWorkload | ((prev: CustomCourseWorkload) => CustomCourseWorkload)) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isOnboarded: boolean;
  setIsOnboarded: (value: boolean) => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const completedDisciplinesAtom = atomWithStorage<string[]>('completedDisciplines', []);
const disciplineStatusesAtom = atomWithStorage<Record<string, DisciplineStatus>>('disciplineStatuses', {});
const semesterOutcomesAtom = atomWithStorage<Record<string, SemesterOutcome>>('semesterOutcomes', {});
const customCourseWorkloadAtom = atomWithStorage<CustomCourseWorkload>('customCourseWorkload', {
  enabled: false,
  mandatory: 0,
  elective: 0,
  complementary: 0,
});

// Detectar tema do sistema se não houver preferência salva
const getInitialTheme = (): 'light' | 'dark' => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  // Se não houver preferência salva, usar tema do sistema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const themeAtom = atomWithStorage<'light' | 'dark'>('theme', getInitialTheme());
const onboardedAtom = atomWithStorage<boolean>('isOnboarded', false);

const toggleCompletedDisciplineAtom = atom(null, (get, set, code: string) => {
  const prev = get(completedDisciplinesAtom);
  const isAlreadyCompleted = prev.includes(code);
  const next = isAlreadyCompleted
    ? prev.filter((c) => c !== code)
    : [...prev, code];
  set(completedDisciplinesAtom, next);

  // If unmarking as completed, also clear the discipline status
  if (isAlreadyCompleted) {
    const statuses = { ...get(disciplineStatusesAtom) };
    delete statuses[code];
    set(disciplineStatusesAtom, statuses);
  } else {
    // If marking as completed, also set status to approved
    const statuses = { ...get(disciplineStatusesAtom), [code]: 'approved' as DisciplineStatus };
    set(disciplineStatusesAtom, statuses);
  }
});

const toggleThemeAtom = atom(null, (get, set) => {
  const current = get(themeAtom);
  set(themeAtom, current === 'light' ? 'dark' : 'light');
});

function removeFromOutcome(outcome: SemesterOutcome, code: string): SemesterOutcome {
  return {
    approved: outcome.approved.filter((c) => c !== code),
    failed: outcome.failed.filter((c) => c !== code),
    dropped: outcome.dropped.filter((c) => c !== code),
  };
}

function addToOutcomeList(outcome: SemesterOutcome, status: DisciplineStatus, code: string): SemesterOutcome {
  const cleaned = removeFromOutcome(outcome, code);
  if (status === 'approved') return { ...cleaned, approved: [...cleaned.approved, code] };
  if (status === 'failed') return { ...cleaned, failed: [...cleaned.failed, code] };
  return { ...cleaned, dropped: [...cleaned.dropped, code] };
}

const setDisciplineStatusAtom = atom(
  null,
  (get, set, code: string, status: DisciplineStatus, term?: string) => {
    const statuses = { ...get(disciplineStatusesAtom), [code]: status };
    set(disciplineStatusesAtom, statuses);

    const completed = get(completedDisciplinesAtom);
    if (status === 'approved') {
      if (!completed.includes(code)) {
        set(completedDisciplinesAtom, [...completed, code]);
      }
    } else {
      set(completedDisciplinesAtom, completed.filter((c) => c !== code));
    }

    if (term) {
      const outcomes = { ...get(semesterOutcomesAtom) };
      const current = outcomes[term] || emptySemesterOutcome();
      outcomes[term] = addToOutcomeList(current, status, code);
      set(semesterOutcomesAtom, outcomes);
    }
  }
);

const clearDisciplineStatusAtom = atom(null, (get, set, code: string, term?: string) => {
  const statuses = { ...get(disciplineStatusesAtom) };
  delete statuses[code];
  set(disciplineStatusesAtom, statuses);

  const completed = get(completedDisciplinesAtom);
  set(completedDisciplinesAtom, completed.filter((c) => c !== code));

  if (term) {
    const outcomes = { ...get(semesterOutcomesAtom) };
    if (outcomes[term]) {
      outcomes[term] = removeFromOutcome(outcomes[term], code);
      set(semesterOutcomesAtom, outcomes);
    }
  }
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const completedDisciplines = useAtomValue(completedDisciplinesAtom);
  const setCompletedDisciplines = useSetAtom(completedDisciplinesAtom);
  const toggleCompletedDiscipline = useSetAtom(toggleCompletedDisciplineAtom);
  const disciplineStatuses = useAtomValue(disciplineStatusesAtom);
  const semesterOutcomes = useAtomValue(semesterOutcomesAtom);
  const setDisciplineStatus = useSetAtom(setDisciplineStatusAtom);
  const clearDisciplineStatus = useSetAtom(clearDisciplineStatusAtom);
  const [customCourseWorkload, setCustomCourseWorkloadInternal] = useAtom(customCourseWorkloadAtom);
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const isOnboarded = useAtomValue(onboardedAtom);
  const setIsOnboarded = useSetAtom(onboardedAtom);

  const setCustomCourseWorkload = (
    value: CustomCourseWorkload | ((prev: CustomCourseWorkload) => CustomCourseWorkload)
  ) => {
    setCustomCourseWorkloadInternal(value);
    setTimeout(() => {
      window.dispatchEvent(new Event('progressDataUpdated'));
    }, 0);
  };

  const getDisciplineStatus = (code: string): DisciplineStatus | null =>
    disciplineStatuses[code] ?? null;

  const exportSettings = (): string => {
    const settings: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // o token do SIGAA nunca vai para o backup
      if (key && key !== 'sigaaSession') {
        settings[key] = localStorage.getItem(key) || '';
      }
    }

    // Garante que os estados atuais em memória estejam explicitamente presentes
    if (completedDisciplines) {
      settings['completedDisciplines'] = JSON.stringify(completedDisciplines);
    }
    if (disciplineStatuses) {
      settings['disciplineStatuses'] = JSON.stringify(disciplineStatuses);
    }
    if (semesterOutcomes) {
      settings['semesterOutcomes'] = JSON.stringify(semesterOutcomes);
    }
    if (customCourseWorkload) {
      settings['customCourseWorkload'] = JSON.stringify(customCourseWorkload);
    }
    if (isOnboarded !== undefined) {
      settings['isOnboarded'] = JSON.stringify(isOnboarded);
    }
    if (theme) {
      settings['theme'] = JSON.stringify(theme);
    }

    const backupPayload = {
      cadeeBackup: true,
      version: 2,
      exportedAt: new Date().toISOString(),
      summary: {
        completedDisciplinesCount: completedDisciplines.length,
        hasHistory: Boolean(settings['progressData']),
        customWorkloadEnabled: Boolean(customCourseWorkload?.enabled),
      },
      data: settings,
    };

    return JSON.stringify(backupPayload, null, 2);
  };

  const importSettings = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') return false;

      // 1. Caso seja backup estruturado (versão 1 ou 2)
      if (parsed.cadeeBackup && parsed.data && typeof parsed.data === 'object') {
        localStorage.clear();
        for (const [key, value] of Object.entries(parsed.data)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          } else {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('progressDataUpdated'));

        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
        return true;
      }

      // 2. Caso seja backup no formato plano / legado
      const legacyData: Record<string, any> = parsed.data || parsed;
      let hasValidKey = false;

      const recognizedKeys = [
        'completedDisciplines',
        'disciplineStatuses',
        'semesterOutcomes',
        'customCourseWorkload',
        'mySections',
        'selectedPrograms',
        'progressData',
        'isOnboarded',
        'mode',
        'experienceMode',
        'theme',
        'cadee_equivalences',
      ];

      for (const key of recognizedKeys) {
        if (legacyData[key] !== undefined) {
          hasValidKey = true;
          const val = legacyData[key];
          if (typeof val === 'string') {
            localStorage.setItem(key, val);
          } else {
            localStorage.setItem(key, JSON.stringify(val));
          }
        }
      }

      if (legacyData.selectedCourse) {
        hasValidKey = true;
        localStorage.setItem('selectedPrograms', JSON.stringify([legacyData.selectedCourse]));
      }

      if (hasValidKey) {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('progressDataUpdated'));

        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        completedDisciplines,
        toggleCompletedDiscipline,
        disciplineStatuses,
        getDisciplineStatus,
        setDisciplineStatus,
        clearDisciplineStatus,
        semesterOutcomes,
        customCourseWorkload,
        setCustomCourseWorkload,
        theme,
        toggleTheme,
        isOnboarded,
        setIsOnboarded,
        exportSettings,
        importSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
