import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '../api/profileApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useProfile() {
  return useQuery({
    queryKey: [...queryKeys.users, 'me'],
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.users, 'me'] });
    },
  });
}
