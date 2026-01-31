import { useQuery } from '@tanstack/react-query';
import { getClassification } from '../api/classificationApi';
import { queryKeys } from '../../../shared/query/queryKeys';

export function useClassification(round?: number) {
  return useQuery({
    queryKey: queryKeys.classification(round),
    queryFn: () => getClassification(round),
  });
}
