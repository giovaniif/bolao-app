import { useQuery } from '@tanstack/react-query';
import { checkUsername } from '../api/authApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,30}$/;
const CHECK_DELAY_MS = 400;

export type UsernameStatus = 'checking' | 'available' | 'taken' | 'invalid';

export function useUsernameAvailability(username: string): UsernameStatus {
  const trimmed = username.trim();
  const debounced = useDebouncedValue(trimmed, CHECK_DELAY_MS);
  const wellFormed = USERNAME_PATTERN.test(debounced);
  const { data } = useQuery({
    queryKey: queryKeys.usernameAvailable(debounced),
    queryFn: () => checkUsername(debounced),
    enabled: wellFormed,
    staleTime: 30_000,
  });

  if (debounced !== trimmed) return 'checking';
  if (!wellFormed || data?.valid === false) return 'invalid';
  if (!data) return 'checking';
  return data.available ? 'available' : 'taken';
}
