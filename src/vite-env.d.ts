/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL da {sigaa} api. Vazio = CADEE só com a API estática (sem login, sem dados ao vivo). */
  readonly VITE_SIGAA_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
