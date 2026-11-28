/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Ver constants.ts
  readonly VITE_DEFAULT_BUSINESS?: string;
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
