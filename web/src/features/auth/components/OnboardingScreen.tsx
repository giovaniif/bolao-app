import type { ReactNode } from 'react';

interface OnboardingScreenProps {
  step: 1 | 2;
  title: string;
  children: ReactNode;
}

export function OnboardingScreen({ step, title, children }: OnboardingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] safe-area-pt">
      <div className="mx-auto w-full max-w-md min-h-full flex flex-col gap-4 px-5 pt-6 pb-8">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-1 flex-1 rounded bg-[var(--color-primary)]" />
          <span className={`h-1 flex-1 rounded ${step === 2 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-card)]'}`} />
        </div>
        <p className="sr-only">{`Passo ${step} de 2`}</p>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}
