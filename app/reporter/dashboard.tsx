import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReporterDashboard() {
	const scheme = useColorScheme() ?? 'light';
	const c = Colors[scheme];
	const router = useRouter();

	return (
		<SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
			<View style={[styles.header, { borderBottomColor: c.border }]}> 
				<ThemedText type="defaultSemiBold" style={[styles.headerTitle, { color: c.text }]}>
					Reporter Dashboard
				</ThemedText>
			</View>

			<View style={styles.body}>
				<Pressable
					onPress={() => router.push('/post-news' as any)}
					style={({ pressed }) => [
						styles.card,
						{ borderColor: c.tint, backgroundColor: Colors.light.background },
						pressed && styles.pressed,
					]}
					android_ripple={{ color: c.border }}
					accessibilityLabel="Post News"
				>
					<View style={styles.row}>
						<View style={styles.iconPill}>
							<MaterialIcons name="newspaper" size={20} color={c.tint} />
						</View>
						<ThemedText type="defaultSemiBold" style={[styles.label, { color: c.tint }]}>
							Post News
						</ThemedText>
						<MaterialIcons name="chevron-right" size={22} color={c.tint} />
					</View>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	header: {
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	headerTitle: { fontSize: 18 },
	body: { flex: 1, padding: 14, justifyContent: 'flex-start' },
	card: {
		borderWidth: 1,
		borderRadius: 18,
		overflow: 'hidden',
		paddingHorizontal: 14,
		paddingVertical: 14,
		minHeight: 74,
	},
	row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
	iconPill: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
	label: { flex: 1, fontSize: 16 },
	pressed: { opacity: 0.95 },
});

