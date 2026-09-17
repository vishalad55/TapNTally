import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { API_BASE_URL } from '../src/api/client';
import { useUpdateMe } from '../src/api/hooks';
import { Button, Card, Chip, Row, SectionHeader, Text } from '../src/components/ui';
import { useNfcPrefs, type MockScenario } from '../src/nfc';
import { useSession } from '../src/store/session';
import { useTheme } from '../src/theme';

const SCENARIOS: Array<{ key: MockScenario; label: string }> = [
  { key: 'signed', label: '✅ Signed bill' },
  { key: 'unsigned', label: '📝 Unsigned bill' },
  { key: 'no_tag', label: '🙈 Missed tap' },
  { key: 'unsupported', label: '🚫 Unsupported terminal' },
  { key: 'malformed', label: '💥 Malformed bill' },
];

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const signOut = useSession((s) => s.signOut);
  const updateMe = useUpdateMe();
  const nfc = useNfcPrefs();

  const toggleConsent = async (v: boolean) => {
    await updateMe.mutateAsync({ aggregateInsightsConsent: v });
    await refreshUser();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}>
      <Card style={{ gap: 2 }}>
        <Text variant="title">{user?.name}</Text>
        <Text muted>{user?.email}</Text>
      </Card>

      <SectionHeader title="Connections" />
      <Link href="/connections" asChild>
        <Pressable>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">Gmail & SMS</Text>
                <Text variant="caption" muted>
                  Pull in online orders automatically.
                </Text>
              </View>
              <Text muted>›</Text>
            </Row>
          </Card>
        </Pressable>
      </Link>

      <SectionHeader title="Privacy" />
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading">Help improve spending insights</Text>
          </View>
          <Switch value={!!user?.aggregateInsightsConsent} onValueChange={toggleConsent} trackColor={{ true: t.colors.accent }} disabled={updateMe.isPending} />
        </Row>
        <Text variant="caption" muted style={{ lineHeight: 18 }}>
          When on, your purchases contribute to anonymised, aggregated trends (e.g. "grocery spend in Bengaluru rose 4% this week"). Your identity, individual purchases and notes are never included, and any group smaller than 20 people is suppressed entirely. Off by default. Change it any time.
        </Text>
      </Card>

      <SectionHeader title="NFC" />
      <Card style={{ gap: 10 }}>
        <Text variant="caption" muted>
          "Auto" uses the phone's NFC when available and falls back to the demo terminal otherwise.
        </Text>
        <Row gap={8}>
          {(['auto', 'real', 'mock'] as const).map((m) => (
            <Chip key={m} label={m === 'auto' ? 'Auto' : m === 'real' ? 'Real NFC' : 'Demo terminal'} selected={nfc.mode === m} onPress={() => nfc.setMode(m)} />
          ))}
        </Row>
        {nfc.mode !== 'real' ? (
          <>
            <Text variant="caption" muted>
              Demo terminal scenario — for showing off failure handling:
            </Text>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {SCENARIOS.map((s) => (
                <Chip key={s.key} label={s.label} selected={nfc.scenario === s.key} onPress={() => nfc.setScenario(s.key)} />
              ))}
            </Row>
          </>
        ) : null}
      </Card>

      <SectionHeader title="About" />
      <Card style={{ gap: 4 }}>
        <Text variant="caption" muted>
          API
        </Text>
        <Text variant="caption" selectable>
          {API_BASE_URL}
        </Text>
      </Card>

      <Button
        title="Sign out"
        variant="secondary"
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        }}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );
}
