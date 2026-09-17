import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, TextInput, View } from 'react-native';
import { ApiClientError } from '../src/api/client';
import { useHouseholdMutations, useUpdateMe } from '../src/api/hooks';
import { Button, Card, Row, Screen, Text } from '../src/components/ui';
import { useSession } from '../src/store/session';
import { type Theme, fonts, useTheme } from '../src/theme';
import { Icon, type IoniconName, TapGlyph } from '../src/theme/icons';

const STEPS = ['welcome', 'sources', 'household'] as const;
type Step = (typeof STEPS)[number];

/**
 * First-run tour: three short steps, every one skippable. Completion is stored
 * on the account (PATCH /users/me), so a second device goes straight to Home.
 */
export default function Onboarding() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const updateMe = useUpdateMe();
  const [index, setIndex] = useState(0);
  const step: Step = STEPS[index];

  const finish = async (then?: () => void) => {
    try {
      await updateMe.mutateAsync({ onboardingCompleted: true });
      await refreshUser();
    } finally {
      router.replace('/(tabs)');
      then?.();
    }
  };

  const next = () => (index < STEPS.length - 1 ? setIndex(index + 1) : void finish());

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <Dots count={STEPS.length} active={index} />
        <Pressable onPress={() => void finish()} hitSlop={10} accessibilityLabel="Skip the tour">
          <Text variant="caption" muted>
            Skip
          </Text>
        </Pressable>
      </Row>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Slide key={step}>
          {step === 'welcome' ? <Welcome name={user?.name?.split(' ')[0]} onNext={next} /> : null}
          {step === 'sources' ? <Sources onNext={next} onConnect={() => void finish(() => router.push('/connections'))} /> : null}
          {step === 'household' ? <HouseholdStep onDone={() => void finish()} /> : null}
        </Slide>
      </ScrollView>
    </Screen>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const t = useTheme();
  return (
    <Row gap={6}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === active ? t.colors.accent : t.colors.surfaceAlt }} />
      ))}
    </Row>
  );
}

/** Fade + rise on step change. */
function Slide({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Welcome({ name, onNext }: { name?: string; onNext: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 18, paddingVertical: 24 }}>
      <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
        <TapGlyph size={46} color={t.colors.accentInk} />
      </View>
      <Text variant="hero">{name ? `Hi ${name}.` : 'Hello.'}{'\n'}Bills that file themselves.</Text>
      <Text muted style={{ fontSize: 16, lineHeight: 24 }}>
        After you pay at a shop, hold your phone near the card machine. The itemised bill lands in TapNTally, already categorised, and your month updates on the spot.
      </Text>
      <View style={{ gap: 10, marginTop: 6 }}>
        <Point icon="wifi" title="Tap to get the bill" body="Works with any terminal on the TapNTally network. No paper, no photos." />
        <Point icon="pie-chart-outline" title="See where the money goes" body="A live breakdown by category, budgets that nudge you at 80%." />
        <Point icon="people-outline" title="Share what's shared" body="Groceries and bills for the household; everything else stays private." />
      </View>
      <Button title="Continue" icon="arrow-forward" onPress={onNext} style={{ marginTop: 10 }} />
    </View>
  );
}

function Sources({ onNext, onConnect }: { onNext: () => void; onConnect: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 16, paddingTop: 28, paddingBottom: 24 }}>
      <Text variant="micro" faint>
        Step 2 of 3
      </Text>
      <Text variant="display">Where should we look?</Text>
      <Text muted>Tapping covers shops. For online orders we can read confirmations, narrowly, and only with your say-so.</Text>
      <Card style={{ gap: 6 }}>
        <Row gap={10}>
          <Icon name="wifi" color={t.colors.accent} />
          <Text variant="heading">Tap at terminals</Text>
          <Text variant="caption" color={t.colors.money} style={{ marginLeft: 'auto' }}>
            Always on
          </Text>
        </Row>
      </Card>
      <Card style={{ gap: 6 }}>
        <Row gap={10}>
          <Icon name="mail-outline" />
          <Text variant="heading">Gmail order confirmations</Text>
        </Row>
        <Text variant="caption" muted>
          Read-only. We look only for order emails from known shops and never store the email itself.
        </Text>
      </Card>
      <Card style={{ gap: 6 }}>
        <Row gap={10}>
          <Icon name="chatbubble-ellipses-outline" />
          <Text variant="heading">Bank SMS alerts</Text>
          <Text variant="caption" faint style={{ marginLeft: 'auto' }}>
            Android
          </Text>
        </Row>
        <Text variant="caption" muted>
          Parsed on your phone. Only the amount and merchant are kept.
        </Text>
      </Card>
      <Button title="Connect Gmail or SMS" icon="link-outline" onPress={onConnect} style={{ marginTop: 6 }} />
      <Button title="Not now" variant="ghost" onPress={onNext} />
    </View>
  );
}

function HouseholdStep({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { create, join } = useHouseholdMutations();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || join.isPending;

  const submit = async () => {
    setError(null);
    try {
      if (mode === 'create') await create.mutateAsync(value.trim());
      else await join.mutateAsync(value.trim().toUpperCase());
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <View style={{ flex: 1, gap: 16, paddingTop: 28, paddingBottom: 24 }}>
      <Text variant="micro" faint>
        Step 3 of 3
      </Text>
      <Text variant="display">Share with your home?</Text>
      <Text muted>Set up a household now, or later from the Family tab. Your own purchases stay private either way.</Text>
      <Row gap={8}>
        <Pressable onPress={() => setMode('create')} style={{ flex: 1 }}>
          <Card tone={mode === 'create' ? 'accent' : 'surface'} style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="home-outline" color={mode === 'create' ? t.colors.accent : t.colors.inkMuted} />
            <Text variant="heading">Start one</Text>
          </Card>
        </Pressable>
        <Pressable onPress={() => setMode('join')} style={{ flex: 1 }}>
          <Card tone={mode === 'join' ? 'accent' : 'surface'} style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="key-outline" color={mode === 'join' ? t.colors.accent : t.colors.inkMuted} />
            <Text variant="heading">Join with code</Text>
          </Card>
        </Pressable>
      </Row>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize={mode === 'join' ? 'characters' : 'words'}
        placeholder={mode === 'create' ? 'Household name, e.g. The Sharmas' : 'Invite code, e.g. TAP-XXXXX'}
        placeholderTextColor={t.colors.inkFaint}
        style={inputStyle(t)}
      />
      {error ? <Text color={t.colors.danger}>{error}</Text> : null}
      <Button title={mode === 'create' ? 'Create household' : 'Join household'} onPress={submit} loading={busy} disabled={value.trim().length < (mode === 'create' ? 2 : 5)} />
      <Button title="Skip for now" variant="ghost" onPress={onDone} />
    </View>
  );
}

function Point({ icon, title, body }: { icon: IoniconName; title: string; body: string }) {
  const t = useTheme();
  return (
    <Row gap={12} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={t.colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="heading">{title}</Text>
        <Text variant="caption" muted>
          {body}
        </Text>
      </View>
    </Row>
  );
}

const inputStyle = (t: Theme) => ({
  borderRadius: t.radius.md,
  padding: 14,
  color: t.colors.ink,
  backgroundColor: t.colors.surfaceAlt,
  fontFamily: fonts.body,
  fontSize: 15,
});
