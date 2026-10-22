import { useQuery } from '@tanstack/react-query';
import { getTeams } from '../../profile/api/profileApi';
import { useProfile, useUpdateProfile } from '../../profile/hooks/useProfile';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useFavoriteTeamStep() {
  const teams = useQuery({ queryKey: queryKeys.teams, queryFn: getTeams });
  const profile = useProfile();
  const update = useUpdateProfile();

  function save(team: string, onDone: () => void) {
    const me = profile.data;
    if (!me) return;
    update.mutate(
      { username: me.username, display_name: me.display_name, favorite_team: team },
      { onSuccess: onDone }
    );
  }

  return {
    teams: teams.data ?? [],
    ready: !!profile.data,
    saving: update.isPending,
    error: update.error instanceof Error ? update.error.message : '',
    save,
  };
}
