import { useCallback, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

export function usePullToRefresh(queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const keys = JSON.stringify(queryKeys);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all((JSON.parse(keys) as QueryKey[]).map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' })));
    } finally {
      setRefreshing(false);
    }
  }, [keys, queryClient]);
  return { refreshing, onRefresh };
}
