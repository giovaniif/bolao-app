import { Pressable, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Match } from '../api/play';
import { colors } from '../theme';

const SWIPE_THRESHOLD = 60;

function Stepper({ team, value, disabled, onChange }: { team: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  const button = { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };
  const minusDisabled = disabled || value <= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Menos um gol de ${team}`}
        accessibilityState={{ disabled: minusDisabled }}
        disabled={minusDisabled}
        onPress={() => onChange(value - 1)}
        style={[button, { opacity: minusDisabled ? 0.4 : 1 }]}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Gols de ${team}`} style={{ color: colors.text, fontSize: 32, fontWeight: '900', width: 56, textAlign: 'center' }}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mais um gol de ${team}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(Math.min(99, value + 1))}
        style={[button, { opacity: disabled ? 0.4 : 1 }]}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>+</Text>
      </Pressable>
    </View>
  );
}

function Side({ label, team, value, disabled, onChange }: { label: string; team: string; value: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 6 }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {team}
      </Text>
      <Stepper team={team} value={value} disabled={disabled} onChange={onChange} />
    </View>
  );
}

function NavButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.border, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: colors.text, fontSize: 14 }}>{label === 'Anterior' ? '← Anterior' : 'Próximo →'}</Text>
    </Pressable>
  );
}

export function PredictCard({
  match,
  home,
  away,
  onChange,
  onNext,
  onPrev,
  index,
  total,
  disabled,
}: {
  match: Match;
  home: number;
  away: number;
  onChange: (home: number, away: number) => void;
  onNext: () => void;
  onPrev: () => void;
  index: number;
  total: number;
  disabled: boolean;
}) {
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  const dragX = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-15, 15],
    failOffsetY: [-10, 10],
    runOnJS: true,
    onUpdate: (e) => {
      dragX.value = e.translationX;
    },
    onDeactivate: (e) => {
      if (e.translationX > SWIPE_THRESHOLD && hasPrev) {
        onPrev();
      } else if (e.translationX < -SWIPE_THRESHOLD && hasNext) {
        onNext();
      }
      dragX.value = withTiming(0, { duration: 150 });
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
    opacity: Math.max(0.3, 1 - Math.abs(dragX.value) / 200),
  }));

  const hasResult = match.home_goals != null && match.away_goals != null;

  return (
    <View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            { backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#475569', padding: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
            cardStyle,
          ]}
        >
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Jogo {index + 1} de {total}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Arraste para o próximo ou anterior</Text>
          </View>
          <View style={{ gap: 32 }}>
            <Side label="Mandante" team={match.home_team} value={home} disabled={disabled} onChange={(v) => onChange(v, away)} />
            <Text style={{ color: colors.muted, fontSize: 20, textAlign: 'center' }}>×</Text>
            <Side label="Visitante" team={match.away_team} value={away} disabled={disabled} onChange={(v) => onChange(home, v)} />
          </View>
          {hasResult && (
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
              Resultado: {match.home_goals} × {match.away_goals}
            </Text>
          )}
        </Animated.View>
      </GestureDetector>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 8 }}>
        <NavButton label="Anterior" disabled={!hasPrev} onPress={onPrev} />
        <View style={{ flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={{ width: i === index ? 10 : 8, height: i === index ? 10 : 8, borderRadius: 5, backgroundColor: i === index ? colors.primary : '#475569' }}
            />
          ))}
        </View>
        <NavButton label="Próximo" disabled={!hasNext} onPress={onNext} />
      </View>
    </View>
  );
}
