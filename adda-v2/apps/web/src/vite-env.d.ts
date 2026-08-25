/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEDGER_OPERATOR_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
