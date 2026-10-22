import { useState } from 'react';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { UsernameStep } from './UsernameStep';

interface UsernameOnboardingProps {
  suggested: string;
  loading: boolean;
  error: string;
  onSubmit: (username: string) => void;
}

export function UsernameOnboarding({ suggested, loading, error, onSubmit }: UsernameOnboardingProps) {
  const [username, setUsername] = useState(suggested);
  const status = useUsernameAvailability(username);
  return (
    <UsernameStep
      username={username}
      status={status}
      loading={loading}
      error={error}
      onChange={setUsername}
      onSubmit={() => onSubmit(username.trim())}
    />
  );
}
