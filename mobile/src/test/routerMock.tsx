export const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() }
export let params: Record<string, string> = {}

export function setParams(next: Record<string, string>) {
  params = next
}

export function routerModule() {
  const { Text } = jest.requireActual('react-native')
  return {
    useRouter: () => router,
    useLocalSearchParams: () => params,
    Link: ({ children }: { children: string }) => <Text>{children}</Text>,
  }
}
