import { Stack } from 'expo-router';

export default function PublicFigureLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" options={{ title: 'News Dashboard' }} />
    </Stack>
  );
}
