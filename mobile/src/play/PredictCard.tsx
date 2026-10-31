import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Match } from '../api/play';
import { colors } from '../theme';

const GAP = 16;
const DISTANCE_RATIO = 0.25;
const FLING_VELOCITY = 500;
const SPRING = { damping: 22, stiffness: 220, mass: 0.9, overshootClamping: false };

export type CardMatch = Pick<Match, 'home_team' | 'away_team' | 'home_goals' | 'away_goals'>;

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

export type CardItem = { id: string; match: CardMatch; home: number; away: number; disabled: boolean };

function CardFace({ item, index, total, onChange }: { item: CardItem; index: number; total: number; onChange: (home: number, away: number) => void }) {
  const { match, home, away, disabled } = item;
  const hasResult = match.home_goals != null && match.away_goals != null;
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#475569', padding: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
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
    </View>
  );
}

function Slot({ position, offset, slot, children }: { position: number; offset: SharedValue<number>; slot: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const x = position * slot - offset.get();
    const distance = Math.min(1, Math.abs(x) / slot);
    return { transform: [{ translateX: x }, { scale: 1 - distance * 0.06 }], opacity: 1 - distance * 0.35 };
  });
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, style]}>{children}</Animated.View>;
}

export function PredictCard({
  items,
  index,
  onIndexChange,
  onChange,
}: {
  items: CardItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onChange: (id: string, home: number, away: number) => void;
}) {
  const total = items.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const slot = width + GAP;
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const target = useSharedValue(0);

  useEffect(() => {
    if (slot <= GAP) return;
    if (target.get() !== index) {
      target.set(index);
      offset.set(withSpring(index * slot, SPRING));
    }
  }, [index, slot, offset, target]);

  useEffect(() => {
    if (slot > GAP) {
      offset.set(target.get() * slot);
    }
  }, [slot, offset, target]);

  const pan = usePanGesture({
    activeOffsetX: [-15, 15],
    failOffsetY: [-10, 10],
    onBegin: () => {
      start.set(offset.get());
    },
    onUpdate: (e) => {
      const raw = start.get() - e.translationX;
      const min = 0;
      const max = (total - 1) * slot;
      offset.set(raw < min ? min + (raw - min) * 0.3 : raw > max ? max + (raw - max) * 0.3 : raw);
    },
    onDeactivate: (e) => {
      const current = target.get();
      const moved = start.get() - offset.get();
      let next = current;
      if ((moved > slot * DISTANCE_RATIO || e.velocityX > FLING_VELOCITY) && current > 0) next = current - 1;
      else if ((moved < -slot * DISTANCE_RATIO || e.velocityX < -FLING_VELOCITY) && current < total - 1) next = current + 1;
      target.set(next);
      offset.set(withSpring(next * slot, { ...SPRING, velocity: -e.velocityX }));
      if (next !== current) scheduleOnRN(onIndexChange, next);
    },
  });

  const measured = width > 0;
  const current = items[index];
  const visible = measured ? items.map((item, i) => ({ item, i })).filter(({ i }) => Math.abs(i - index) <= 1) : [];

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={{ minHeight: measured ? height : undefined }}
        >
          {measured ? (
            visible.map(({ item, i }) => (
              <Slot key={item.id} position={i} offset={offset} slot={slot}>
                <View onLayout={i === index ? (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height) : undefined}>
                  <CardFace item={item} index={i} total={total} onChange={(h, a) => onChange(item.id, h, a)} />
                </View>
              </Slot>
            ))
          ) : (
            <CardFace item={current} index={index} total={total} onChange={(h, a) => onChange(current.id, h, a)} />
          )}
        </View>
      </GestureDetector>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 8 }}>
        <NavButton label="Anterior" disabled={!hasPrev} onPress={() => onIndexChange(index - 1)} />
        <View style={{ flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={{ width: i === index ? 10 : 8, height: i === index ? 10 : 8, borderRadius: 5, backgroundColor: i === index ? colors.primary : '#475569' }}
            />
          ))}
        </View>
        <NavButton label="Próximo" disabled={!hasNext} onPress={() => onIndexChange(index + 1)} />
      </View>
    </View>
  );
}
