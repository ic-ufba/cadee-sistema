/**
 * Sessão do aluno na {sigaa} api (login opcional).
 *
 * Guarda só o token opaco devolvido por POST /v1/auth/login — a senha nunca passa por aqui depois do login.
 * Com "manter conectado" o token fica no localStorage; sem isso, no sessionStorage (some ao fechar a aba).
 */
import { useSyncExternalStore } from 'react';

export interface SigaaSession {
  token: string;
  usuario: string;
  lembrar: boolean;
  criadaEm: string;
  expiraEm: string;
  /** Nome do aluno, preenchido depois da primeira sincronização do histórico. */
  nome?: string;
  curso?: string;
  /** Última vez que o histórico do SIGAA foi aplicado no CADEE (ISO). */
  sincronizadoEm?: string;
}

const KEY = 'sigaaSession';
const listeners = new Set<() => void>();

function safeGet(storage: Storage): string | null {
  try {
    return storage.getItem(KEY);
  } catch {
    return null;
  }
}

function read(): SigaaSession | null {
  const raw = safeGet(sessionStorage) ?? safeGet(localStorage);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SigaaSession;
    if (!parsed?.token) return null;
    if (parsed.expiraEm && Date.parse(parsed.expiraEm) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

let current: SigaaSession | null = read();

function emit() {
  listeners.forEach((l) => l());
}

export function getSigaaSession(): SigaaSession | null {
  return current;
}

export function setSigaaSession(session: SigaaSession | null) {
  current = session;
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    if (session) {
      (session.lembrar ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
    }
  } catch {
    // armazenamento indisponível (aba anônima, etc.): a sessão continua só em memória
  }
  emit();
}

export function updateSigaaSession(patch: Partial<SigaaSession>) {
  if (!current) return;
  setSigaaSession({ ...current, ...patch });
}

export function subscribeSigaaSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSigaaSession(): SigaaSession | null {
  return useSyncExternalStore(subscribeSigaaSession, getSigaaSession, getSigaaSession);
}
