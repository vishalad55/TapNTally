import { Redirect, Stack } from 'expo-router';
import { useSession } from '../../src/store/session';

export default function AuthLayout() {
  const status = useSession((s) => s.status);
  if (status === 'signed_in') return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
