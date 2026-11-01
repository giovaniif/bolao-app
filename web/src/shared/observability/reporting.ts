type Build = { dev: boolean; mode: string; environment: string | undefined };

const REPORTING_ENVIRONMENTS = ['dev', 'prod', 'production'];

const currentBuild: Build = {
  dev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
};

export function reportingAllowed(build: Build = currentBuild) {
  if (build.dev || build.mode === 'test' || build.mode === 'vitest') return false;
  return REPORTING_ENVIRONMENTS.includes(build.environment ?? build.mode);
}
