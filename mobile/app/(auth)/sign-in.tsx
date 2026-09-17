import Constants from 'expo-constants';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { Button, Card, Row, Screen, Spacer, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { fonts, useTheme } from '../../src/theme';
import { TapGlyph } from '../../src/theme/icons';

const GOOGLE_WEB_CLIENT_ID = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ?? '';

/**
 * Google is the real sign-in (and doubles as Gmail linking). The demo
 * sign-in is shown whenever the backend has AUTH_DEV_LOGIN on — exactly the
 * pitch-demo configuration.
 */
export default function SignIn() {
  const t = useTheme();
  const signInDev = useSession((s) => s.signInDev);
  const signInGoogle = useSession((s) => s.signInGoogle);
  const [email, setEmail] = useState('demo@tapntally.app');
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'google' | 'dev', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const googleSignIn = () =>
    run('google', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: true });
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      const idToken = res.data?.idToken;
      if (!idToken) throw new Error('No ID token returned');
      await signInGoogle(idToken);
    });

  return (
    <Screen>
      <Row style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <ThemeToggle />
      </Row>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ gap: 10, marginBottom: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
            <TapGlyph size={40} color={t.colors.accentInk} />
          </View>
          <Text variant="hero" style={{ marginTop: 8 }}>
            Tap.{'\n'}Tally.{'\n'}
            <Text variant="hero" color={t.colors.accent}>
              Done.
            </Text>
          </Text>
          <Text muted style={{ fontSize: 16, lineHeight: 24 }}>
            Tap your phone after you pay. The bill files itself — categorised, budgeted, shared with the household if you like.
          </Text>
        </View>

        {GOOGLE_WEB_CLIENT_ID ? (
          <Card style={{ gap: 10 }}>
            <Button title="Continue with Google" icon="logo-google" onPress={googleSignIn} loading={busy === 'google'} />
          </Card>
        ) : null}

        <Card tone={GOOGLE_WEB_CLIENT_ID ? 'alt' : 'surface'} style={{ gap: 10 }}>
          <Text variant="micro" muted>
            {GOOGLE_WEB_CLIENT_ID ? 'Or use a demo account' : 'Demo account'}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.colors.inkFaint}
            style={{ borderRadius: t.radius.md, padding: 14, color: t.colors.ink, backgroundColor: t.colors.surfaceAlt, fontFamily: fonts.body, fontSize: 15 }}
          />
          <Button title="Continue" icon="arrow-forward" onPress={() => run('dev', () => signInDev(email.trim()))} loading={busy === 'dev'} />
          <Text variant="caption" faint>
            Try demo@tapntally.app or priya@tapntally.app — a seeded household with two months of purchases.
          </Text>
        </Card>

        {error ? (
          <Text color={t.colors.danger} style={{ textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
        <Spacer h={30} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
