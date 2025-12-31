import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface ProfileForm {
  firstName: string;
  surname: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  mother: { name: string; surnameBeforeMarriage?: string; surnameAfterMarriage?: string; dob?: string };
  father: { name: string; surname?: string; dob?: string };
  spouse?: { name?: string; dob?: string; surnameBeforeMarriage?: string; surnameAfterMarriage?: string };
}

const DEFAULT: ProfileForm = {
  firstName: '',
  surname: '',
  dateOfBirth: '',
  gender: 'other',
  maritalStatus: 'single',
  mother: { name: '' },
  father: { name: '' },
  spouse: {}
};

export default function JoinKaChat() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileForm>(DEFAULT);
  const [step, setStep] = useState(0);

  const save = async () => {
    await AsyncStorage.setItem('kachat:profile', JSON.stringify(profile));
    router.replace('/kachat' as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Join Ka Chat</Text>
        <Text style={styles.step}>Step {step + 1} of 3</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {step === 0 && (
          <View>
            <Text style={styles.groupTitle}>Basic details</Text>
            <View style={styles.row2}>
              <TextInput placeholder="First name" value={profile.firstName} onChangeText={(t) => setProfile({ ...profile, firstName: t })} style={styles.input2} />
              <TextInput placeholder="Surname" value={profile.surname} onChangeText={(t) => setProfile({ ...profile, surname: t })} style={styles.input2} />
            </View>
            <View style={styles.row2}>
              <TextInput placeholder="DOB (YYYY-MM-DD)" value={profile.dateOfBirth} onChangeText={(t) => setProfile({ ...profile, dateOfBirth: t })} style={styles.input2} />
              <TextInput placeholder="Gender (male/female/other)" value={profile.gender} onChangeText={(t) => setProfile({ ...profile, gender: t as any })} style={styles.input2} />
            </View>
            <View style={styles.row2}>
              <TextInput placeholder="Marital (single/married/divorced/widowed)" value={profile.maritalStatus} onChangeText={(t) => setProfile({ ...profile, maritalStatus: t as any })} style={styles.input2} />
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.groupTitle}>Parents</Text>
            <View style={styles.row2}>
              <TextInput placeholder="Mother name" value={profile.mother.name} onChangeText={(t) => setProfile({ ...profile, mother: { ...profile.mother, name: t } })} style={styles.input2} />
              <TextInput placeholder="Mother DOB" value={profile.mother.dob} onChangeText={(t) => setProfile({ ...profile, mother: { ...profile.mother, dob: t } })} style={styles.input2} />
            </View>
            <View style={styles.row2}>
              <TextInput placeholder="Father name" value={profile.father.name} onChangeText={(t) => setProfile({ ...profile, father: { ...profile.father, name: t } })} style={styles.input2} />
              <TextInput placeholder="Father DOB" value={profile.father.dob} onChangeText={(t) => setProfile({ ...profile, father: { ...profile.father, dob: t } })} style={styles.input2} />
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.groupTitle}>Spouse (optional)</Text>
            <View style={styles.row2}>
              <TextInput placeholder="Name" value={profile.spouse?.name} onChangeText={(t) => setProfile({ ...profile, spouse: { ...(profile.spouse||{}), name: t } })} style={styles.input2} />
              <TextInput placeholder="DOB" value={profile.spouse?.dob} onChangeText={(t) => setProfile({ ...profile, spouse: { ...(profile.spouse||{}), dob: t } })} style={styles.input2} />
            </View>
            <View style={styles.row2}>
              <TextInput placeholder="Surname before marriage" value={profile.spouse?.surnameBeforeMarriage} onChangeText={(t) => setProfile({ ...profile, spouse: { ...(profile.spouse||{}), surnameBeforeMarriage: t } })} style={styles.input2} />
              <TextInput placeholder="Surname after marriage" value={profile.spouse?.surnameAfterMarriage} onChangeText={(t) => setProfile({ ...profile, spouse: { ...(profile.spouse||{}), surnameAfterMarriage: t } })} style={styles.input2} />
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16 }}>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => step === 0 ? router.back() : setStep((s) => s - 1)}>
          <Text style={[styles.btnText, { color: '#111' }]}>{step === 0 ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => step < 2 ? setStep((s) => s + 1) : save()}>
          <Text style={styles.btnText}>{step < 2 ? 'Next' : 'Save & Join'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  step: { color: '#6b7280' },
  groupTitle: { fontWeight: '800', marginTop: 10, marginBottom: 6 },
  row2: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input2: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  btnPrimary: { backgroundColor: '#032557' },
  btnGhost: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db' },
  btnText: { color: '#fff', fontWeight: '700' },
});
