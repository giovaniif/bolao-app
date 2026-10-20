import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInviteLink,
  getInviteCode,
  getMembers,
  removeMember,
  reviewRequest,
  setMemberRole,
  type MemberRole,
} from '../api/membersApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useMembers(bolaoId?: string) {
  return useQuery({
    queryKey: queryKeys.members(bolaoId ?? ''),
    queryFn: () => getMembers(bolaoId!),
    enabled: !!bolaoId,
  });
}

export function useInviteCode(bolaoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inviteCode(bolaoId ?? ''),
    queryFn: () => getInviteCode(bolaoId!),
    enabled: !!bolaoId && enabled,
  });
}

export function useCreateInviteLink(bolaoId?: string) {
  return useMutation({ mutationFn: () => createInviteLink(bolaoId!) });
}

export function useMemberActions(bolaoId?: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.members(bolaoId ?? '') });
    queryClient.invalidateQueries({ queryKey: queryKeys.myBoloes });
  };
  return {
    review: useMutation({
      mutationFn: ({ userId, decision }: { userId: string; decision: 'approve' | 'reject' }) => reviewRequest(bolaoId!, userId, decision),
      onSuccess: refresh,
    }),
    setRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) => setMemberRole(bolaoId!, userId, role),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => removeMember(bolaoId!, userId),
      onSuccess: refresh,
    }),
  };
}
