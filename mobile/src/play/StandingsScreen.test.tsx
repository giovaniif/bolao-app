import { screen } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import { renderWithProviders } from '../test/render'
import { fakeApi } from '../test/fakeApi'
import { StandingsScreen } from './StandingsScreen'

beforeEach(async () => {
  await SecureStore.setItemAsync('token', 'jwt')
})

describe('StandingsScreen', () => {
  it('lists the standings of the current bolão in order', async () => {
    fakeApi([
      { path: /^\/me\/boloes$/, body: [{ id: 'b-1', name: 'Firma', status: 'active', role: 'owner', member_status: 'active', member_count: 3 }] },
      {
        path: /^\/boloes\/b-1\/classification/,
        body: [
          { id: 'u-1', username: 'ana', display_name: 'Ana', total_points: 120, exact_scores: 6, correct_results: 14 },
          { id: 'u-2', username: 'bia', display_name: 'Bia', total_points: 98, exact_scores: 4, correct_results: 12 },
        ],
      },
    ])
    await renderWithProviders(<StandingsScreen />)
    expect(await screen.findByText('Ana')).toBeTruthy()
    expect(screen.getByText('1º')).toBeTruthy()
    expect(screen.getByText('2º')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
  })
})
