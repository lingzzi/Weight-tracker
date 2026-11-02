import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import WeightChart from './components/WeightChart';
import { parseWebExport } from './src/migration';
import { loadTrackerData, saveTrackerData } from './src/storage';
import type { Profile, TrackerData, WeightEntry, WeightUnit } from './src/types';
import {
  convertFromInput,
  convertToDisplay,
  formatSelectedDate,
  formatWeight,
  getActiveProfile,
  localISODate,
  sortEntries,
  summarize,
} from './src/weight';

type SheetMode = 'add' | 'edit' | 'edit-goal';

const EMPTY_PROFILE_NAME = (count: number) => `Profile ${count + 1}`;

function createProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Avatar({ uri, size }: { uri: string; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImage} />
      ) : (
        <MaterialIcons name="person" size={size * 0.62} color="#E5E7EB" />
      )}
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[styles.actionButtonText, primary && styles.actionButtonPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    FjallaOne_400Regular: require('@expo-google-fonts/fjalla-one/400Regular/FjallaOne_400Regular.ttf'),
    Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
    Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  });
  const [data, setData] = useState<TrackerData | null>(null);
  const dataRef = useRef<TrackerData | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [loadError, setLoadError] = useState('');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileUnit, setProfileUnit] = useState<WeightUnit>('kg');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('add');
  const [weightInput, setWeightInput] = useState('');
  const [entryDate, setEntryDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const reloadData = async () => {
    setLoadError('');
    try {
      const loaded = await loadTrackerData();
      dataRef.current = loaded;
      setData(loaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(message);
      Alert.alert('Unable to load tracker data', message);
    }
  };

  useEffect(() => {
    let active = true;
    loadTrackerData()
      .then((loaded) => {
        if (!active) return;
        dataRef.current = loaded;
        setData(loaded);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message);
        Alert.alert('Unable to load tracker data', message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (fontError) {
      Alert.alert('Font loading failed', fontError.message);
    }
  }, [fontError]);

  const commitData = (update: (current: TrackerData) => TrackerData): TrackerData | null => {
    const current = dataRef.current;
    if (!current) return null;
    const next = update(current);
    dataRef.current = next;
    setData(next);
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => saveTrackerData(next))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert('Unable to save tracker data', message);
      });
    return next;
  };

  const activeProfile = data ? getActiveProfile(data) : null;
  const entries = useMemo(
    () => activeProfile ? sortEntries(activeProfile.entries) : [],
    [activeProfile],
  );
  const summary = useMemo(
    () => activeProfile ? summarize(entries, activeProfile.unit) : null,
    [activeProfile, entries],
  );
  const updateActiveProfile = (update: (profile: Profile) => Profile) => {
    if (!activeProfile) return null;
    return commitData((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (
        profile.id === activeProfile.id ? update(profile) : profile
      )),
    }));
  };

  const openSheet = (mode: SheetMode, index: number | null = null) => {
    if (!activeProfile) return;
    setSheetMode(mode);
    setSelectedIndex(mode === 'edit' ? index : null);
    if (mode === 'edit-goal') {
      setWeightInput(String(convertToDisplay(activeProfile.goal, activeProfile.unit)));
    } else if (mode === 'edit' && index !== null && entries[index]) {
      setWeightInput(String(convertToDisplay(entries[index].weight, activeProfile.unit)));
      setEntryDate(new Date(`${entries[index].iso}T12:00:00`));
    } else {
      setWeightInput('');
      setEntryDate(new Date());
    }
    setSheetVisible(true);
  };

  const saveEntry = () => {
    if (!activeProfile) return;
    const trimmed = weightInput.trim();
    const inputValue = Number(trimmed);
    if (!trimmed || !Number.isFinite(inputValue)) {
      Alert.alert('Invalid weight', 'Please enter a valid number.');
      return;
    }

    const weightKg = convertFromInput(inputValue, activeProfile.unit);
    if (sheetMode === 'edit-goal') {
      updateActiveProfile((profile) => ({ ...profile, goal: weightKg }));
      setSheetVisible(false);
      return;
    }

    const iso = localISODate(entryDate);
    let updatedEntries: WeightEntry[];
    if (sheetMode === 'edit' && selectedIndex !== null && entries[selectedIndex]) {
      updatedEntries = sortEntries(entries.map((entry, index) => (
        index === selectedIndex ? { iso, weight: weightKg } : entry
      )));
      const newIndex = updatedEntries.findIndex((entry) => entry.iso === iso && entry.weight === weightKg);
      setSelectedIndex(newIndex >= 0 ? newIndex : null);
    } else {
      const existingIndex = entries.findIndex((entry) => entry.iso === iso);
      updatedEntries = existingIndex >= 0
        ? entries.map((entry, index) => index === existingIndex ? { ...entry, weight: weightKg } : entry)
        : sortEntries([...entries, { iso, weight: weightKg }]);
      setSelectedIndex(null);
    }
    updateActiveProfile((profile) => ({ ...profile, entries: updatedEntries }));
    setWeightInput('');
    setSheetVisible(false);
  };

  const deleteSelectedEntry = () => {
    if (selectedIndex === null || !entries[selectedIndex]) return;
    const updatedEntries = entries.filter((_, index) => index !== selectedIndex);
    updateActiveProfile((profile) => ({ ...profile, entries: updatedEntries }));
    setSelectedIndex(null);
  };

  const clearEntries = () => {
    Alert.alert(
      'Clear all records?',
      'This will permanently remove all recorded entries for this profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            updateActiveProfile((profile) => ({ ...profile, entries: [] }));
            setSelectedIndex(null);
          },
        },
      ],
    );
  };

  const selectProfile = (profile: Profile) => {
    commitData((current) => ({ ...current, activeProfileId: profile.id }));
    setSelectedIndex(null);
    setSheetVisible(false);
    setProfileMenuVisible(false);
  };

  const openProfileEditor = (profile?: Profile) => {
    setEditingProfileId(profile?.id ?? null);
    setProfileName(profile?.name ?? '');
    setProfileUnit(profile?.unit ?? 'kg');
    setProfileAvatar(profile?.avatarImage ?? '');
    setProfileMenuVisible(false);
    setProfileDialogVisible(true);
  };

  const chooseAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.72,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize({ width: 160, height: 160 });
      const renderedAvatar = await context.renderAsync();
      const avatar = await renderedAvatar.saveAsync({
        base64: true,
        compress: 0.72,
        format: SaveFormat.JPEG,
      });
      if (!avatar.base64) {
        Alert.alert('Unable to use this image', 'The selected image could not be prepared as an avatar.');
        return;
      }
      setProfileAvatar(`data:image/jpeg;base64,${avatar.base64}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Unable to choose an avatar', message);
    }
  };

  const saveProfile = () => {
    if (!data) return;
    const name = profileName.trim().slice(0, 20) || EMPTY_PROFILE_NAME(data.profiles.length);
    setSelectedIndex(null);
    setSheetVisible(false);
    if (editingProfileId) {
      commitData((current) => ({
        ...current,
        profiles: current.profiles.map((profile) => (
          profile.id === editingProfileId
            ? { ...profile, name, unit: profileUnit, avatarImage: profileAvatar }
            : profile
        )),
        activeProfileId: editingProfileId,
      }));
    } else {
      const profile: Profile = {
        id: createProfileId(),
        name,
        avatarImage: profileAvatar,
        entries: [],
        goal: 55,
        unit: profileUnit,
      };
      commitData((current) => ({
        activeProfileId: profile.id,
        profiles: [...current.profiles, profile],
      }));
    }
    setProfileDialogVisible(false);
  };

  const importWebData = async () => {
    setProfileMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const contents = await new File(result.assets[0].uri).text();
      const imported = parseWebExport(contents);
      Alert.alert(
        'Replace native app data?',
        `This will replace the current profiles with ${imported.profiles.length} imported profile${imported.profiles.length === 1 ? '' : 's'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              commitData(() => imported);
              setSelectedIndex(null);
              setSheetVisible(false);
            },
          },
        ],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Unable to import data', message);
    }
  };

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar style="dark" />
        <Text style={styles.bodyText}>Loading Weight Tracker...</Text>
      </SafeAreaView>
    );
  }

  if (loadError && !data) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar style="dark" />
        <Text style={styles.titleLarge}>Could not open your tracker</Text>
        <Text style={[styles.bodyText, styles.errorText]}>{loadError}</Text>
        <ActionButton label="Try again" primary onPress={() => void reloadData()} />
      </SafeAreaView>
    );
  }

  if (!data || !activeProfile || !summary) return null;

  return (
    <LinearGradient
      colors={['#FFFFFF', '#FFFFFF', '#CBD4FD']}
      locations={[0, 0.4, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profiles"
              onPress={() => setProfileMenuVisible(true)}
              style={styles.profileHeader}
            >
              <Avatar uri={activeProfile.avatarImage} size={44} />
              <View style={styles.greetingStack}>
                <Text style={styles.headline}>Good morning!</Text>
                <Text style={styles.profileName} numberOfLines={1}>{activeProfile.name}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all records"
              onPress={clearEntries}
              style={styles.iconButton}
            >
              <MaterialIcons name="cleaning-services" size={22} color={COLORS.onSurface} />
            </Pressable>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.smallLabel}>Today&apos;s weight</Text>
              <Text style={styles.displayValue}>{summary.currentWeight}</Text>
            </View>
            <View style={[styles.metricCard, styles.goalCard]}>
              <View style={styles.goalText}>
                <Text style={styles.smallLabel}>Goal weight</Text>
                <Text style={styles.displayValue}>
                  {formatWeight(convertToDisplay(activeProfile.goal, activeProfile.unit), activeProfile.unit)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit goal weight"
                style={styles.goalEdit}
                onPress={() => openSheet('edit-goal')}
              >
                <MaterialIcons name="edit" size={18} color={COLORS.onSurface} />
              </Pressable>
            </View>
          </View>

          <View style={styles.statsCard}>
            <Stat label="Total" value={summary.totalChange} />
            <Stat label="Today" value={summary.todayChange} />
            <Stat label="This week" value={summary.weekChange} />
            <Stat label="This month" value={summary.monthChange} />
          </View>

          <View style={styles.chartHeader}>
            <Text style={styles.titleLarge}>Weight history</Text>
            <Text style={styles.chartHint}>Drag to move | pinch to zoom</Text>
          </View>
          <WeightChart
            key={activeProfile.id}
            entries={entries}
            goalKg={activeProfile.goal}
            unit={activeProfile.unit}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
          <View style={styles.bottomSpace} />
        </ScrollView>

        <View pointerEvents="box-none" style={styles.fabGroup}>
          {selectedIndex !== null ? (
            <View style={styles.fabRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete selected record"
                style={[styles.fab, styles.deleteFab]}
                onPress={deleteSelectedEntry}
              >
                <MaterialIcons name="delete" size={24} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit selected record"
                style={styles.fab}
                onPress={() => openSheet('edit', selectedIndex)}
              >
                <MaterialIcons name="edit" size={24} color="#F5F5F5" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a weight record"
              style={styles.fab}
              onPress={() => openSheet('add')}
            >
              <MaterialIcons name="add" size={28} color="#F5F5F5" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileMenuVisible(false)}>
          <Pressable style={styles.profileMenu} onPress={() => undefined}>
            <Text style={styles.titleLarge}>Profiles</Text>
            <ScrollView style={styles.profileList} showsVerticalScrollIndicator={false}>
              <View style={styles.profileListContent}>
                {data.profiles.map((profile) => (
                  <View key={profile.id} style={styles.profileMenuRow}>
                    <Pressable style={styles.profileChoice} onPress={() => selectProfile(profile)}>
                      <Avatar uri={profile.avatarImage} size={36} />
                      <Text style={styles.menuItemText} numberOfLines={1}>{profile.name}</Text>
                      {profile.id === activeProfile.id && (
                        <MaterialIcons name="check" size={20} color={COLORS.primary} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${profile.name}`}
                      style={styles.menuEditButton}
                      onPress={() => openProfileEditor(profile)}
                    >
                      <MaterialIcons name="edit" size={18} color={COLORS.onSurfaceVariant} />
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.menuAction} onPress={() => openProfileEditor()}>
                  <MaterialIcons name="person-add" size={20} color={COLORS.primary} />
                  <Text style={styles.menuActionText}>Add profile</Text>
                </Pressable>
                <Pressable style={styles.menuAction} onPress={() => void importWebData()}>
                  <MaterialIcons name="file-upload" size={20} color={COLORS.primary} />
                  <Text style={styles.menuActionText}>Import web app data</Text>
                </Pressable>
                <Text style={styles.importHint}>Choose the JSON file exported from the web app.</Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={profileDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileDialogVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileDialogVisible(false)}>
          <Pressable style={styles.profileDialog} onPress={() => undefined}>
            <Text style={styles.titleLarge}>
              {editingProfileId ? 'Edit profile' : 'Add profile'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose avatar image"
              onPress={() => void chooseAvatar()}
              style={styles.avatarPicker}
            >
              <Avatar uri={profileAvatar} size={76} />
              <View style={styles.cameraBadge}>
                <MaterialIcons name="add-a-photo" size={17} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Name"
              maxLength={20}
              style={styles.textInput}
              placeholderTextColor="#777B84"
              returnKeyType="done"
            />
            <Text style={styles.formLabel}>Unit</Text>
            <View style={styles.unitToggle}>
              {(['kg', 'g'] as const).map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setProfileUnit(unit)}
                  style={[styles.unitButton, profileUnit === unit && styles.unitButtonSelected]}
                >
                  <Text style={[styles.unitButtonText, profileUnit === unit && styles.unitTextSelected]}>
                    {unit.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.dialogActions}>
              <ActionButton label="Cancel" onPress={() => setProfileDialogVisible(false)} />
              <ActionButton label="Save" primary onPress={saveProfile} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.sheetDismissArea} onPress={() => setSheetVisible(false)} />
          <View style={styles.bottomSheet}>
            <Text style={styles.titleLarge}>
              {sheetMode === 'edit-goal' ? 'Goal weight' : sheetMode === 'edit' ? 'Edit record' : 'Add a record'}
            </Text>
            <TextInput
              autoFocus
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="Weight"
              placeholderTextColor="#777B84"
              style={styles.textInput}
              returnKeyType="done"
            />
            <View style={styles.sheetActions}>
              {sheetMode !== 'edit-goal' && (
                <Pressable style={styles.dateButton} onPress={() => setDatePickerVisible(true)}>
                  <MaterialIcons name="calendar-today" size={18} color={COLORS.onSurface} />
                  <Text style={styles.dateButtonText}>{formatSelectedDate(localISODate(entryDate))}</Text>
                </Pressable>
              )}
              <ActionButton label="Save" primary onPress={saveEntry} />
            </View>
            {datePickerVisible && sheetMode !== 'edit-goal' && (
              <DateTimePicker
                value={entryDate}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, selected) => {
                  setDatePickerVisible(false);
                  if (selected) setEntryDate(selected);
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const COLORS = {
  surface: '#FFFFFF',
  surfaceContainer: '#F3F4F6',
  surfaceContainerHigh: '#DDE0E5',
  onSurface: '#1C1E21',
  onSurfaceVariant: '#404040',
  primary: '#4D47E9',
  error: '#DB383B',
  inverseSurface: '#404040',
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loading: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: COLORS.surface,
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileHeader: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    backgroundColor: '#D7DDE9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  greetingStack: {
    minWidth: 0,
    gap: 2,
  },
  headline: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0.2,
    color: COLORS.onSurface,
  },
  profileName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 17,
    color: COLORS.onSurface,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    marginHorizontal: 12,
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    padding: 12,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceContainer,
    justifyContent: 'center',
    gap: 4,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    padding: 0,
  },
  goalText: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  goalEdit: {
    width: 36,
    margin: 12,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: COLORS.onSurface,
  },
  displayValue: {
    fontFamily: 'FjallaOne_400Regular',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.3,
    color: COLORS.onSurface,
  },
  statsCard: {
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceContainer,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 7,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  statValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: COLORS.onSurface,
  },
  chartHeader: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  titleLarge: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: COLORS.onSurface,
  },
  chartHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: '#666A73',
  },
  bottomSpace: {
    height: 84,
  },
  fabGroup: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
  },
  fabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.inverseSurface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  deleteFab: {
    backgroundColor: COLORS.error,
  },
  modalBackdrop: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  profileMenu: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    padding: 20,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  profileList: {
    flexShrink: 1,
  },
  profileListContent: {
    gap: 8,
  },
  profileMenuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },
  profileChoice: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: COLORS.onSurface,
  },
  menuEditButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  menuActionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: COLORS.primary,
  },
  importHint: {
    paddingHorizontal: 10,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#676B73',
  },
  profileDialog: {
    width: '100%',
    maxWidth: 360,
    padding: 22,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    gap: 12,
  },
  avatarPicker: {
    alignSelf: 'center',
    marginVertical: 4,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.inverseSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: COLORS.onSurface,
  },
  textInput: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainer,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: COLORS.onSurface,
  },
  unitToggle: {
    minHeight: 56,
    padding: 4,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceContainer,
    flexDirection: 'row',
  },
  unitButton: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonSelected: {
    backgroundColor: COLORS.surface,
    elevation: 1,
  },
  unitButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
  },
  unitTextSelected: {
    color: COLORS.onSurface,
  },
  dialogActions: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.inverseSurface,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
  },
  actionButtonPrimaryText: {
    color: '#F5F5F5',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetDismissArea: {
    flex: 1,
  },
  bottomSheet: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.surface,
    gap: 22,
  },
  sheetActions: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: COLORS.onSurface,
  },
  bodyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.error,
  },
});
