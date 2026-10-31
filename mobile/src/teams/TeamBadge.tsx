import { Text, View } from 'react-native';
import { teamBadge } from './teamBadges';

export function TeamBadge({ team, size }: { team: string; size: number }) {
  const badge = teamBadge(team);
  return (
    <View
      testID={`badge:${team}`}
      accessibilityLabel={team}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: badge.fill,
        borderWidth: Math.max(2, size * 0.08),
        borderColor: badge.ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: badge.text, fontWeight: '900', fontSize: size * (badge.initials.length > 2 ? 0.28 : 0.34) }}>{badge.initials}</Text>
    </View>
  );
}
