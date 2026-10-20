import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInvitePreview, joinInvite } from '../api/invitesApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { track } from '../../../shared/analytics/analytics';

export function useInvitePreview(code: string) {
  return useQuery({ queryKey: queryKeys.invitePreview(code), queryFn: () => getInvitePreview(code), retry: false });
}

export function useJoinInvite(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinInvite(code),
    onSuccess: (result) => {
      track(result.status === 'active' ? 'bolao_joined' : 'join_requested');
      queryClient.invalidateQueries({ queryKey: queryKeys.myBoloes });
    },
  });
}
