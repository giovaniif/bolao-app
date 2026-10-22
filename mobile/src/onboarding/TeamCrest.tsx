import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { colors } from '../theme';
import { crestUrl, teamInitials } from './crests';

export function TeamCrest({ team, size }: { team: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const url = crestUrl(team);
  if (url && !failed) {
    return <Image testID={`crest:${team}`} source={{ uri: url }} onError={() => setFailed(true)} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: size * 0.35 }}>{teamInitials(team)}</Text>
    </View>
  );
}
