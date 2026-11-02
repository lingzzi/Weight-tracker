import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDefaultData } from './weight';
import type { Profile, TrackerData, WeightEntry, WeightUnit } from './types';

const STORAGE_KEY = 'weight-tracker-native-v1';

export async function loadTrackerData(): Promise<TrackerData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultData();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('Saved tracker data is not valid JSON.', { cause: error });
  }
  return normalizeTrackerData(parsed);
}

export async function saveTrackerData(data: TrackerData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function normalizeTrackerData(value: unknown): TrackerData {
  const source = Array.isArray(value) ? { profiles: value } : asRecord(value);
  if (!source || !Array.isArray(source.profiles) || source.profiles.length === 0) {
    throw new Error('The file does not contain any weight tracker profiles.');
  }

  const profiles = source.profiles.map(normalizeProfile);
  const requestedActiveId = typeof source.activeProfileId === 'string' ? source.activeProfileId : '';
  const activeProfileId = profiles.some((profile) => profile.id === requestedActiveId)
    ? requestedActiveId
    : profiles[0].id;

  return { activeProfileId, profiles };
}

function normalizeProfile(value: unknown, index: number): Profile {
  const source = asRecord(value);
  if (!source) throw new Error(`Profile ${index + 1} is not a valid object.`);

  const entries: WeightEntry[] = Array.isArray(source.entries)
    ? source.entries.map((entry, entryIndex) => normalizeEntry(entry, index, entryIndex))
    : [];
  const unit: WeightUnit = source.unit === 'g' ? 'g' : 'kg';
  const goal = typeof source.goal === 'number' && Number.isFinite(source.goal) ? source.goal : 55;
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id
    : `imported-profile-${index + 1}`;

  return {
    id,
    name: typeof source.name === 'string' && source.name.trim()
      ? source.name.trim().slice(0, 20)
      : `Profile ${index + 1}`,
    avatarImage: typeof source.avatarImage === 'string' ? source.avatarImage : '',
    entries,
    goal,
    unit,
  };
}

function normalizeEntry(value: unknown, profileIndex: number, entryIndex: number): WeightEntry {
  const source = asRecord(value);
  if (
    !source
    || typeof source.iso !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(source.iso)
    || typeof source.weight !== 'number'
    || !Number.isFinite(source.weight)
  ) {
    throw new Error(`Profile ${profileIndex + 1}, record ${entryIndex + 1} is invalid.`);
  }
  return { iso: source.iso, weight: source.weight };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
