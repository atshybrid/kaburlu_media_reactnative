/**
 * Reporter Wanted Poster Generator
 * Creates shareable poster image for recruiting reporters
 * ALL TELUGU TEXT EDITABLE
 */
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTER_WIDTH = SCREEN_WIDTH - 32;

type ReporterWantedPosterProps = {
  visible: boolean;
  onClose: () => void;
  tenantName: string;
  tenantLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export default function ReporterWantedPoster({
  visible,
  onClose,
  tenantName,
  tenantLogo,
  primaryColor = '#4338ca',
  secondaryColor = '#dc2626',
}: ReporterWantedPosterProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const viewShotRef = useRef<ViewShot>(null);

  // Contact Info
  const [contact1, setContact1] = useState('');
  const [contact2, setContact2] = useState('');
  
  // Editable Telugu Text
  const [tagline, setTagline] = useState('ప్రజా సమస్యల మా ఆయుధం');
  const [mainHeading1, setMainHeading1] = useState('రిపోర్టర్లు');
  const [mainHeading2, setMainHeading2] = useState('కావాలి');
  const [requirement1, setRequirement1] = useState('తెలుగులో రాయగల సమర్థత,');
  const [requirement2, setRequirement2] = useState('సమాజం పట్ల అవగాహాన ఉంటే చాలు.');
  const [desc1, setDesc1] = useState('తెలుగు రాష్ట్రాల్లో సంచలనాలు సృష్టిస్తున్న');
  const [desc2, setDesc2] = useState('వీకు సరైన వేదిక... అన్ని, జిల్లాలు, మండలాలు');
  const [desc3, setDesc3] = useState('మరియు నియోజకవర్గాల పరిధిలో');
  const [desc4, setDesc4] = useState('పనిచేసేందుకు అవకాశం కల్పిస్తోంది.');
  const [contactHeading, setContactHeading] = useState('ఇంకెందుకు ఆలస్యం');
  const [whatsappText, setWhatsappText] = useState('వాట్సాప్‌పై మీ బయోడేటాను పంపండి.');
  
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!contact1) {
      Alert.alert('అవసరం', 'కనీసం ఒక కాంటాక్ట్ నంబర్ అవసరం');
      return;
    }

    setGenerating(true);
    try {
      // Capture the poster as image
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('Failed to generate image');

      // Share the image
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'రిపోర్టర్లు కావాలి - పోస్టర్',
        });
      } else {
        Alert.alert('✅', 'పోస్టర్ జెనరేట్ అయింది!');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'పోస్టర్ జెనరేట్ చేయలేకపోయాము');
    } finally {
      setGenerating(false);
    }
  }, [contact1]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: c.background }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: c.text }]}>📢 రిపోర్టర్లు కావాలి పోస్టర్</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Input Form - All Editable Fields */}
            <View style={styles.form}>
              <Text style={[styles.formSectionTitle, { color: c.text }]}>📱 Contact Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Contact Number 1 *</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={contact1}
                  onChangeText={setContact1}
                  placeholder="9441260616"
                  placeholderTextColor={c.muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Contact Number 2 (Optional)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={contact2}
                  onChangeText={setContact2}
                  placeholder="9849970664"
                  placeholderTextColor={c.muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <Text style={[styles.formSectionTitle, { color: c.text, marginTop: 20 }]}>✍️ Telugu Text (All Editable)</Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Tagline</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={tagline}
                  onChangeText={setTagline}
                  placeholder="ప్రజా సమస్యల మా ఆయుధం"
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, { color: c.text }]}>Main Heading (Line 1)</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                    value={mainHeading1}
                    onChangeText={setMainHeading1}
                    placeholder="రిపోర్టర్లు"
                    placeholderTextColor={c.muted}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: c.text }]}>Main Heading (Line 2)</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                    value={mainHeading2}
                    onChangeText={setMainHeading2}
                    placeholder="కావాలి"
                    placeholderTextColor={c.muted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Requirement (Line 1)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={requirement1}
                  onChangeText={setRequirement1}
                  placeholder="తెలుగులో రాయగల సమర్థత,"
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Requirement (Line 2)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={requirement2}
                  onChangeText={setRequirement2}
                  placeholder="సమాజం పట్ల అవగాహాన ఉంటే చాలు."
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Description (Line 1)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={desc1}
                  onChangeText={setDesc1}
                  placeholder="తెలుగు రాష్ట్రాల్లో సంచలనాలు సృష్టిస్తున్న"
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Description (Line 2)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={desc2}
                  onChangeText={setDesc2}
                  placeholder="వీకు సరైన వేదిక..."
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Description (Line 3)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={desc3}
                  onChangeText={setDesc3}
                  placeholder="మరియు నియోజకవర్గాల పరిధిలో"
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Description (Line 4)</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={desc4}
                  onChangeText={setDesc4}
                  placeholder="పనిచేసేందుకు అవకాశం కల్పిస్తోంది."
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>Contact Heading</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={contactHeading}
                  onChangeText={setContactHeading}
                  placeholder="ఇంకెందుకు ఆలస్యం"
                  placeholderTextColor={c.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: c.text }]}>WhatsApp Text</Text>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
                  value={whatsappText}
                  onChangeText={setWhatsappText}
                  placeholder="వాట్సాప్‌పై మీ బయోడేటాను పంపండి."
                  placeholderTextColor={c.muted}
                />
              </View>
            </View>

            {/* Poster Preview - Matches Reference Design */}
            <View style={styles.previewContainer}>
              <Text style={[styles.previewLabel, { color: c.muted }]}>📱 Preview:</Text>
              
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                <View style={styles.poster}>
                  {/* Top Section - Only Brand Logo */}
                  <View style={styles.topSection}>
                    {tenantLogo ? (
                      <Image source={{ uri: tenantLogo }} style={styles.tenantLogo} contentFit="contain" />
                    ) : (
                      <View style={[styles.logoPlaceholder, { backgroundColor: '#4338ca20' }]}>
                        <MaterialIcons name="newspaper" size={60} color="#4338ca" />
                      </View>
                    )}
                    {tagline && (
                      <Text style={styles.taglineText}>
                        ○ {tagline}
                      </Text>
                    )}
                  </View>

                  {/* Main Heading Section - Brown Background */}
                  <View style={styles.headingSection}>
                    {/* Decorative dots */}
                    <View style={styles.decorativeDotsTop}>
                      {[...Array(8)].map((_, i) => (
                        <View key={i} style={styles.dot} />
                      ))}
                    </View>
                    
                    <View style={styles.headingContent}>
                      {/* Avatar */}
                      <View style={styles.avatarFrame}>
                        <View style={styles.purpleBox} />
                        <Image
                          source={require('@/assets/images/Reporter_avatar.png')}
                          style={styles.reporterAvatar}
                          contentFit="contain"
                        />
                      </View>

                      {/* Heading in Brown Box */}
                      <View style={styles.headingTextBox}>
                        <Text style={styles.mainHeadingText}>{mainHeading1}</Text>
                        <Text style={styles.mainHeadingText}>{mainHeading2}</Text>
                      </View>
                    </View>

                    {/* Decorative elements */}
                    <View style={styles.decorativeCross1}>
                      <Text style={styles.crossMark}>✕</Text>
                    </View>
                    <View style={styles.decorativeCross2}>
                      <Text style={styles.crossMark}>✕</Text>
                    </View>
                    <View style={styles.decorativeDots}>
                      {[...Array(6)].map((_, i) => (
                        <View key={i} style={styles.smallDot} />
                      ))}
                    </View>
                  </View>

                  {/* Requirements - Red Banner */}
                  <View style={styles.requirementBanner}>
                    <Text style={styles.requirementLine}>{requirement1}, {requirement2}</Text>
                  </View>

                  {/* Description - White Section */}
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descLine1}>{desc1}</Text>
                    
                    {/* Tenant Name Highlight */}
                    <View style={styles.brandBox}>
                      <Text style={styles.brandNameInDesc}>{tenantName}</Text>
                      <Text style={styles.brandSubtext}>తెలుగు దిన పత్రిక</Text>
                      <Text style={styles.brandTagline}>ప్రజా సమస్యల మా ఆయుధం</Text>
                    </View>

                    <Text style={styles.descLine2}>{desc2}</Text>
                    <Text style={styles.descHighlight}>{desc3}</Text>
                    <Text style={styles.descLine4}>{desc4}</Text>
                  </View>

                  {/* Contact Section - Blue */}
                  <View style={styles.contactBox}>
                    <Text style={styles.contactTitle}>{contactHeading}</Text>
                    
                    <View style={styles.contactNumbers}>
                      {contact1 && (
                        <Text style={styles.phoneNumber}>{contact1}</Text>
                      )}
                      {contact2 && (
                        <Text style={styles.phoneNumber}>{contact2}</Text>
                      )}
                    </View>

                    {/* WhatsApp */}
                    <View style={styles.whatsappBadge}>
                      <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
                      <Text style={styles.whatsappMessage}>{whatsappText}</Text>
                    </View>
                  </View>
                </View>
              </ViewShot>
            </View>

            {/* Generate Button */}
            <Pressable
              style={[
                styles.generateBtn,
                { backgroundColor: primaryColor, opacity: !contact1 || generating ? 0.5 : 1 },
              ]}
              onPress={handleGenerate}
              disabled={!contact1 || generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="share" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>పోస్టర్ షేర్ చేయండి</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    padding: 16,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  previewContainer: {
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  previewLabel: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '700',
  },
  poster: {
    width: POSTER_WIDTH,
    height: 950,
    backgroundColor: '#fff',
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  
  // Top Section
  topSection: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tenantLogo: {
    width: 80,
    height: 80,
    marginBottom: 4,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    marginBottom: 4,
  },
  taglineText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Heading Section
  headingSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#8B5A2B',
    position: 'relative',
    minHeight: 110,
  },
  decorativeDotsTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF3',
  },
  headingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarFrame: {
    position: 'relative',
  },
  purpleBox: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 60,
    height: 40,
    backgroundColor: '#9333EA',
    borderRadius: 3,
    zIndex: -1,
  },
  reporterAvatar: {
    width: 75,
    height: 75,
  },
  headingTextBox: {
    backgroundColor: '#A0522D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFF',
    transform: [{ rotate: '2deg' }],
  },
  mainHeadingText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFEB3B',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  decorativeCross1: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  decorativeCross2: {
    position: 'absolute',
    bottom: 8,
    right: 16,
  },
  crossMark: {
    fontSize: 20,
    color: '#FFFFFF30',
    fontWeight: '700',
  },
  decorativeDots: {
    position: 'absolute',
    bottom: 12,
    right: 40,
    flexDirection: 'row',
    gap: 3,
  },
  smallDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFEB3B40',
  },
  
  // Requirements Banner
  requirementBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#991B1B',
  },
  requirementLine: {
    fontSize: 15,
    color: '#FFEB3B',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
  },
  
  // Description
  descriptionBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F4F8',
  },
  descLine1: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    color: '#1E3A8A',
  },
  brandBox: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4338ca',
  },
  brandNameInDesc: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4338ca',
    textAlign: 'center',
    marginBottom: 2,
  },
  brandSubtext: {
    fontSize: 12,
    color: '#666',
    marginBottom: 1,
  },
  brandTagline: {
    fontSize: 10,
    color: '#DC2626',
  },
  descLine2: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
    color: '#1E3A8A',
  },
  descHighlight: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 4,
    color: '#DC2626',
  },
  descLine4: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    color: '#1E3A8A',
  },
  
  // Contact
  contactBox: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  contactNumbers: {
    alignItems: 'center',
    marginBottom: 10,
  },
  phoneNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFEB3B',
    marginVertical: 2,
    letterSpacing: 1,
  },
  whatsappBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  whatsappMessage: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
  },
  
  // Generate Button
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
