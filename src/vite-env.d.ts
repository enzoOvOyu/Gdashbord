/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_MOCK: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEFAULT_REGION: string;
  readonly VITE_WS_URL: string;
  readonly VITE_POLL_INTERVAL_MS: string;
  readonly VITE_FEATURE_STATUS_BAR: string;
  readonly VITE_FEATURE_TOPOLOGY: string;
  readonly VITE_THEME_DEFAULT: string;
  readonly VITE_LOW_BALANCE_THRESHOLD_USD: string;
  readonly VITE_MOCK_SEED: string;
  readonly VITE_ENABLE_CONSISTENCY_CHECK: string;
  readonly VITE_MOCK_FAULT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
