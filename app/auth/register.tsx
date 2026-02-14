import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { registerUser } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Spacing from '@/constants/Spacing';
import Typography from '@/constants/Typography';
import BorderRadius from '@/constants/BorderRadius';
import Shadows from '@/constants/Shadows';

export default function RegisterScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(params.mobile || '');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async () => {
    // Validate
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!/^\d{10}$/.test(mobile)) newErrors.mobile = 'Enter valid 10-digit mobile number';
    if (!state.trim()) newErrors.state = 'State is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setSaving(true);
    try {
      const res = await registerUser({ name, mobile, state, district, mandal, village });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Registered', 'Now login with MPIN');
      router.replace({ pathname: '/auth/login', params: { mobile } });
    } catch (e: any) {
      Alert.alert('Registration failed', e.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Register</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.muted }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={(text) => { setName(text); setErrors(prev => ({ ...prev, name: '' })); }}
            placeholder="Full Name"
            placeholderTextColor={theme.muted}
            style={[styles.input, errors.name && styles.inputError, { backgroundColor: theme.card, color: theme.text, borderColor: errors.name ? '#EF4444' : theme.border }]}
            accessible={true}
            accessibilityLabel="Name input"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.muted }]}>Mobile Number *</Text>
          <TextInput
            value={mobile}
            onChangeText={(text) => { setMobile(text); setErrors(prev => ({ ...prev, mobile: '' })); }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit number"
            placeholderTextColor={theme.muted}
            style={[styles.input, errors.mobile && styles.inputError, { backgroundColor: theme.card, color: theme.text, borderColor: errors.mobile ? '#EF4444' : theme.border }]}
            accessible={true}
            accessibilityLabel="Mobile number input"
          />
          {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.muted }]}>State *</Text>
          <TextInput
            value={state}
            onChangeText={(text) => { setState(text); setErrors(prev => ({ ...prev, state: '' })); }}
            placeholder="State"
            placeholderTextColor={theme.muted}
            style={[styles.input, errors.state && styles.inputError, { backgroundColor: theme.card, color: theme.text, borderColor: errors.state ? '#EF4444' : theme.border }]}
            accessible={true}
            accessibilityLabel="State input"
          />
          {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
        </View>
        <Text style={[styles.label, { color: theme.muted }]}>District (optional)</Text>
        <TextInput
          value={district}
          onChangeText={setDistrict}
          placeholder="District"
          placeholderTextColor={theme.muted}
          style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
        />
        <Text style={[styles.label, { color: theme.muted }]}>Mandal (optional)</Text>
        <TextInput
          value={mandal}
          onChangeText={setMandal}
          placeholder="Mandal"
          placeholderTextColor={theme.muted}
          style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
        />
        <Text style={[styles.label, { color: theme.muted }]}>Village (optional)</Text>
        <TextInput
          value={village}
          onChangeText={setVillage}
          placeholder="Village"
          placeholderTextColor={theme.muted}
          style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
        />
        <Pressable 
          style={[styles.button, { backgroundColor: theme.secondary, marginTop: Spacing.md + 2 }, saving && styles.buttonDisabled]} 
          onPress={onSubmit} 
          disabled={saving}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessible={true}
          accessibilityLabel="Register button"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: '#fff' }]}>Register</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { 
    padding: Spacing.lg, 
    gap: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  title: { 
    fontSize: Typography.h2, 
    fontWeight: '800', 
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  label: { 
    fontSize: Typography.bodySmall, 
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  input: { 
    borderWidth: 1, 
    borderRadius: BorderRadius.md, 
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.md, 
    fontSize: Typography.body,
    minHeight: 44,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: Typography.caption,
    marginTop: Spacing.xs,
  },
  button: { 
    paddingVertical: Spacing.md, 
    borderRadius: BorderRadius.md, 
    alignItems: 'center', 
    justifyContent: 'center',
    minHeight: 48,
    ...Shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: { 
    fontSize: Typography.body, 
    fontWeight: '600',
  },
});
