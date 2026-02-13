/**
 * ShortNewsOptions Component
 * 
 * Displays and manages user options/reactions for short news articles:
 * - Shows option counts (positive/negative)
 * - Allows users to add/edit their option (max 50 chars)
 * - Displays top options from other users
 * - Full bottom sheet to view all options
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  createShortNewsOption,
  getShortNewsOptionCounts,
  getShortNewsOptions,
  getMyShortNewsOption,
  updateShortNewsOption,
  deleteShortNewsOption,
  type ShortNewsOption,
  type ShortNewsOptionCounts,
  type ShortNewsOptionType,
} from '@/services/api';

interface ShortNewsOptionsProps {
  shortNewsId: string;
  onCountsChange?: (counts: ShortNewsOptionCounts) => void;
}

const ShortNewsOptions: React.FC<ShortNewsOptionsProps> = ({ shortNewsId, onCountsChange }) => {
  const [counts, setCounts] = useState<ShortNewsOptionCounts | null>(null);
  const [myOption, setMyOption] = useState<ShortNewsOption | null>(null);
  const [topOptions, setTopOptions] = useState<ShortNewsOption[]>([]);
  const [allOptions, setAllOptions] = useState<ShortNewsOption[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [optionText, setOptionText] = useState('');
  const [optionType, setOptionType] = useState<ShortNewsOptionType>('POSITIVE');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load counts and my option
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [countsData, myOptionData] = await Promise.all([
        getShortNewsOptionCounts(shortNewsId),
        getMyShortNewsOption(shortNewsId),
      ]);
      
      setCounts(countsData);
      setMyOption(myOptionData);
      onCountsChange?.(countsData);
    } catch (error) {
      console.error('[ShortNewsOptions] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [shortNewsId, onCountsChange]);

  // Load top options (first 3)
  const loadTopOptions = useCallback(async () => {
    try {
      const options = await getShortNewsOptions(shortNewsId);
      setTopOptions(options.slice(0, 3));
    } catch (error) {
      console.error('[ShortNewsOptions] Failed to load top options:', error);
    }
  }, [shortNewsId]);

  // Load all options for bottom sheet
  const loadAllOptions = useCallback(async () => {
    try {
      const options = await getShortNewsOptions(shortNewsId);
      setAllOptions(options);
    } catch (error) {
      console.error('[ShortNewsOptions] Failed to load all options:', error);
    }
  }, [shortNewsId]);

  useEffect(() => {
    loadData();
    loadTopOptions();
  }, [loadData, loadTopOptions]);

  // Open add/edit modal
  const handleAddOption = () => {
    if (myOption) {
      setOptionText(myOption.content);
      setOptionType(myOption.type);
    } else {
      setOptionText('');
      setOptionType('POSITIVE');
    }
    setShowAddModal(true);
  };

  // Submit option
  const handleSubmitOption = async () => {
    if (!optionText.trim()) {
      Alert.alert('Required', 'Please enter your opinion');
      return;
    }

    if (optionText.length > 50) {
      Alert.alert('Too long', 'Opinion must be 50 characters or less');
      return;
    }

    try {
      setSubmitting(true);
      
      if (myOption) {
        // Update existing
        const updated = await updateShortNewsOption(myOption.id, { content: optionText });
        setMyOption(updated);
      } else {
        // Create new
        const created = await createShortNewsOption({
          shortNewsId,
          content: optionText,
          type: optionType,
        });
        setMyOption(created);
      }

      setShowAddModal(false);
      // Reload data
      loadData();
      loadTopOptions();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit option');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete my option
  const handleDeleteOption = async () => {
    if (!myOption) return;

    Alert.alert(
      'Delete Opinion',
      'Are you sure you want to delete your opinion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShortNewsOption(myOption.id);
              setMyOption(null);
              setShowAddModal(false);
              loadData();
              loadTopOptions();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete option');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#e42223" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Counts Display */}
      <View style={styles.countsRow}>
        <View style={styles.countItem}>
          <Feather name="thumbs-up" size={16} color="#22c55e" />
          <Text style={styles.countText}>{counts?.positive || 0}</Text>
          <Text style={styles.countLabel}>Agree</Text>
        </View>
        
        <View style={styles.countDivider} />
        
        <View style={styles.countItem}>
          <Feather name="thumbs-down" size={16} color="#ef4444" />
          <Text style={styles.countText}>{counts?.negative || 0}</Text>
          <Text style={styles.countLabel}>Disagree</Text>
        </View>
        
        <View style={styles.countDivider} />
        
        <View style={styles.countItem}>
          <Feather name="message-circle" size={16} color="#6b7280" />
          <Text style={styles.countText}>{counts?.total || 0}</Text>
          <Text style={styles.countLabel}>Opinions</Text>
        </View>
      </View>

      {/* My Option or Add Button */}
      {myOption ? (
        <TouchableOpacity style={styles.myOptionCard} onPress={handleAddOption}>
          <View style={styles.myOptionHeader}>
            <Feather 
              name={myOption.type === 'POSITIVE' ? 'thumbs-up' : 'thumbs-down'} 
              size={14} 
              color={myOption.type === 'POSITIVE' ? '#22c55e' : '#ef4444'} 
            />
            <Text style={styles.myOptionLabel}>Your Opinion</Text>
            <Feather name="edit-2" size={14} color="#6b7280" />
          </View>
          <Text style={styles.myOptionText}>{myOption.content}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={handleAddOption}>
          <Feather name="plus-circle" size={18} color="#e42223" />
          <Text style={styles.addButtonText}>Share your opinion (50 chars max)</Text>
        </TouchableOpacity>
      )}

      {/* Top Options */}
      {topOptions.length > 0 && (
        <View style={styles.topOptionsSection}>
          <Text style={styles.sectionTitle}>Top Opinions</Text>
          {topOptions.map((option, index) => (
            <View key={option.id} style={styles.optionCard}>
              <View style={styles.optionHeader}>
                {option.user?.profilePhotoUrl ? (
                  <Image 
                    source={{ uri: option.user.profilePhotoUrl }} 
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                      {option.user?.name?.charAt(0) || 'U'}
                    </Text>
                  </View>
                )}
                <View style={styles.optionInfo}>
                  <Text style={styles.userName}>{option.user?.name || 'User'}</Text>
                  <View style={styles.optionMeta}>
                    <Feather 
                      name={option.type === 'POSITIVE' ? 'thumbs-up' : 'thumbs-down'} 
                      size={10} 
                      color={option.type === 'POSITIVE' ? '#22c55e' : '#ef4444'} 
                    />
                    <Text style={styles.optionType}>
                      {option.type === 'POSITIVE' ? 'Agrees' : 'Disagrees'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.optionContent}>{option.content}</Text>
            </View>
          ))}
          
          {(counts?.total || 0) > 3 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => {
                loadAllOptions();
                setShowAllModal(true);
              }}
            >
              <Text style={styles.viewAllText}>
                View all {counts?.total} opinions
              </Text>
              <Feather name="chevron-right" size={16} color="#e42223" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable 
          style={styles.modalBackdrop}
          onPress={() => setShowAddModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {myOption ? 'Edit Opinion' : 'Share Your Opinion'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Your opinion (max 50 characters)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What do you think about this news?"
              value={optionText}
              onChangeText={setOptionText}
              maxLength={50}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.charCount}>{optionText.length}/50</Text>

            {!myOption && (
              <>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[styles.typeButton, optionType === 'POSITIVE' && styles.typeButtonActive]}
                    onPress={() => setOptionType('POSITIVE')}
                  >
                    <Feather name="thumbs-up" size={18} color={optionType === 'POSITIVE' ? '#fff' : '#22c55e'} />
                    <Text style={[styles.typeButtonText, optionType === 'POSITIVE' && styles.typeButtonTextActive]}>
                      Agree
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.typeButton, optionType === 'NEGATIVE' && styles.typeButtonActive]}
                    onPress={() => setOptionType('NEGATIVE')}
                  >
                    <Feather name="thumbs-down" size={18} color={optionType === 'NEGATIVE' ? '#fff' : '#ef4444'} />
                    <Text style={[styles.typeButtonText, optionType === 'NEGATIVE' && styles.typeButtonTextActive]}>
                      Disagree
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              {myOption && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteOption}
                >
                  <Feather name="trash-2" size={18} color="#ef4444" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitOption}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {myOption ? 'Update' : 'Submit'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* View All Modal */}
      <Modal
        visible={showAllModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllModal(false)}
      >
        <Pressable 
          style={styles.modalBackdrop}
          onPress={() => setShowAllModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Opinions ({allOptions.length})</Text>
              <TouchableOpacity onPress={() => setShowAllModal(false)}>
                <Feather name="x" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.allOptionsList}>
              {allOptions.map((option) => (
                <View key={option.id} style={styles.optionCard}>
                  <View style={styles.optionHeader}>
                    {option.user?.profilePhotoUrl ? (
                      <Image 
                        source={{ uri: option.user.profilePhotoUrl }} 
                        style={styles.avatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>
                          {option.user?.name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.optionInfo}>
                      <Text style={styles.userName}>{option.user?.name || 'User'}</Text>
                      <View style={styles.optionMeta}>
                        <Feather 
                          name={option.type === 'POSITIVE' ? 'thumbs-up' : 'thumbs-down'} 
                          size={10} 
                          color={option.type === 'POSITIVE' ? '#22c55e' : '#ef4444'} 
                        />
                        <Text style={styles.optionType}>
                          {option.type === 'POSITIVE' ? 'Agrees' : 'Disagrees'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.optionContent}>{option.content}</Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
  },
  countItem: {
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  countLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  countDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  myOptionCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  myOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  myOptionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  myOptionText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e42223',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e42223',
  },
  topOptionsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  optionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#e42223',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  optionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  optionType: {
    fontSize: 11,
    color: '#6b7280',
  },
  optionContent: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    marginLeft: 42,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e42223',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  charCount: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#e42223',
    borderColor: '#e42223',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#e42223',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  allOptionsList: {
    gap: 12,
  },
});

export default ShortNewsOptions;
