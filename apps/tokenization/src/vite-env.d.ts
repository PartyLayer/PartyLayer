/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** demo (default) or live: which backend the app uses. */
  readonly VITE_BACKEND?: string;
  /** Base URL of the DevNet gateway, used when VITE_BACKEND is live. */
  readonly VITE_GATEWAY_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
