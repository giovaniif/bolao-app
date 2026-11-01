type Runtime = { dev: boolean; jest: boolean };

export function reportingAllowed(runtime: Runtime = { dev: __DEV__, jest: !!process.env.JEST_WORKER_ID }) {
  return !runtime.dev && !runtime.jest;
}
