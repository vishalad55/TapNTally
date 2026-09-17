import Constants from 'expo-constants';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { Button, Card, Screen, Spacer, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

const GOOGLE_WEB_CLIENT_ID = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ?? '';

/**
 * Google is the real sign-in (and doubles as Gmail linking). The dev/demo
 * sign-in is shown whenever the backend has AUTH_DEV_LOGIN on — which is
 * exactly the pitch-demo configuration.
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
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Is the API running?');
    } finally {
      setBusy(null);
    }
  };

  const googleSignIn = () =>
    run('google', async () => {
      // Lazy: the native module only exists in a dev build.
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Text style={{ fontSize: 56 }}>📡</Text>
          <Text variant="display">TapNTally</Text>
          <Text muted style={{ textAlign: 'center' }}>
            Tap your phone after you pay. The bill files itself.
          </Text>
        </View>

        <Card style={{ gap: 12 }}>
          <Button title="Continue with Google" icon="🔐" onPress={googleSignIn} loading={busy === 'google'} disabled={!GOOGLE_WEB_CLIENT_ID} />
          {!GOOGLE_WEB_CLIENT_ID ? (
            <Text variant="caption" faint style={{ textAlign: 'center' }}>
              Google sign-in needs a client ID in app.json → extra.googleWebClientId
            </Text>
          ) : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text variant="heading">Demo sign-in</Text>
          <Text variant="caption" muted>
            Works when the API has AUTH_DEV_LOGIN=true. Try demo@tapntally.app or priya@tapntally.app.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.colors.textFaint}
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.colors.border,
              borderRadius: t.radius.md,
              padding: 12,
              color: t.colors.text,
              backgroundColor: t.colors.background,
            }}
          />
          <Button title="Sign in" variant="secondary" onPress={() => run('dev', () => signInDev(email.trim()))} loading={busy === 'dev'} />
        </Card>

        {error ? (
          <Text color={t.colors.danger} style={{ textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
        <Spacer h={40} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
