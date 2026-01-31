/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly GITHUB_PAGES?: string;
  // 更多環境變量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
