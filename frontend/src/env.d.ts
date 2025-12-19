/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // add more VITE_* vriables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
