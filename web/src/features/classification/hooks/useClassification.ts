import { useQuery } from '@tanstack/react-query';
import { getClassification } from '../api/classificationApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useClassification(round?: number, bolaoId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.classification(bolaoId, round),
    queryFn: () => getClassification(round, bolaoId),
    enabled,
  });
}
