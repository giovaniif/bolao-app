import { useQuery } from '@tanstack/react-query';
import { getClassification } from '../api/classificationApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import { useCurrentBolao } from '../../../shared/hooks/useCurrentBolao';

export function useClassification(round?: number, bolaoId?: string, enabled = true) {
  const { bolaoId: current, isLoading } = useCurrentBolao();
  const scope = bolaoId ? undefined : current;
  return useQuery({
    queryKey: queryKeys.classification(bolaoId, round, scope),
    queryFn: () => getClassification(round, bolaoId, scope),
    enabled: enabled && !isLoading,
  });
}
