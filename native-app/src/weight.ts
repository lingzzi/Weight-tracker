import type { Profile, SummaryStats, TrackerData, WeightEntry, WeightUnit } from './types';

export const DEFAULT_GOAL_KG = 55;
export const DEFAULT_CHART_WINDOW = 10;

export function localISODate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultData(): TrackerData {
  const year = new Date().getFullYear();
  const profile: Profile = {
    id: `profile-${Date.now()}`,
    name: 'Profile 1',
    avatarImage: '',
    entries: [
      { iso: `${year}-01-01`, weight: 65 },
      { iso: `${year}-01-02`, weight: 64.5 },
      { iso: `${year}-01-03`, weight: 64.2 },
    ],
    goal: DEFAULT_GOAL_KG,
    unit: 'kg',
  };
  return { activeProfileId: profile.id, profiles: [profile] };
}

export function getActiveProfile(data: TrackerData): Profile {
  return data.profiles.find((profile) => profile.id === data.activeProfileId) ?? data.profiles[0];
}

export function convertToDisplay(weightKg: number, unit: WeightUnit): number {
  return unit === 'g' ? weightKg * 1000 : weightKg;
}

export function convertFromInput(value: number, unit: WeightUnit): number {
  return unit === 'g' ? value / 1000 : value;
}

export function formatWeight(value: number, unit: WeightUnit): string {
  return unit === 'g' ? `${Math.round(value)}g` : `${value.toFixed(1)}kg`;
}

export function formatDelta(deltaKg: number, unit: WeightUnit): string {
  const value = convertToDisplay(deltaKg, unit);
  if (unit === 'g') {
    const rounded = Math.round(Math.abs(value));
    if (deltaKg > 0) return `+${rounded}g`;
    if (deltaKg === 0) return '0g';
    return `-${rounded}g`;
  }

  const rounded = Math.abs(value).toFixed(1);
  if (deltaKg > 0) return `+${rounded}kg`;
  return deltaKg === 0 ? '0.0kg' : `-${rounded}kg`;
}

export function formatDateLabel(isoDate: string): string {
  const [yearText, monthText, dayText] = isoDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  const options: Intl.DateTimeFormatOptions = year === new Date().getFullYear()
    ? { month: '2-digit', day: '2-digit' }
    : { month: '2-digit', day: '2-digit', year: '2-digit' };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatSelectedDate(isoDate: string): string {
  if (isoDate === localISODate()) return 'Today';
  return formatDateLabel(isoDate);
}

export function summarize(entries: WeightEntry[], unit: WeightUnit): SummaryStats {
  if (entries.length === 0) {
    const zero = formatWeight(0, unit);
    return {
      currentWeight: zero,
      totalChange: zero,
      todayChange: zero,
      weekChange: zero,
      monthChange: zero,
    };
  }

  const sorted = [...entries].sort((a, b) => a.iso.localeCompare(b.iso));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const todayISO = localISODate();
  const todayEntry = sorted.find((entry) => entry.iso === todayISO) ?? latest;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = localISODate(yesterday);
  const previousDay = sorted.find((entry) => entry.iso === yesterdayISO);
  const todayIndex = sorted.findIndex((entry) => entry.iso === todayEntry.iso);
  const todayReference = previousDay ?? (todayIndex > 0 ? sorted[todayIndex - 1] : todayEntry);

  const today = new Date();
  const daysSinceMonday = (today.getDay() + 6) % 7;
  today.setDate(today.getDate() - daysSinceMonday);
  const mondayISO = localISODate(today);
  const weekReference = sorted.find((entry) => entry.iso >= mondayISO)
    ?? sorted.find((entry) => entry.iso <= mondayISO)
    ?? todayEntry;

  const firstOfMonth = new Date();
  const firstOfMonthISO = localISODate(new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1));
  const monthReference = sorted.find((entry) => entry.iso >= firstOfMonthISO)
    ?? sorted.find((entry) => entry.iso <= firstOfMonthISO)
    ?? todayEntry;

  return {
    currentWeight: formatWeight(convertToDisplay(todayEntry.weight, unit), unit),
    totalChange: formatWeight(convertToDisplay(latest.weight - first.weight, unit), unit),
    todayChange: formatDelta(todayEntry.weight - todayReference.weight, unit),
    weekChange: formatDelta(todayEntry.weight - weekReference.weight, unit),
    monthChange: formatDelta(todayEntry.weight - monthReference.weight, unit),
  };
}

export function getYAxisRange(
  entries: WeightEntry[],
  goalKg: number,
  unit: WeightUnit,
): { min: number; max: number } {
  const multiplier = unit === 'g' ? 1000 : 1;
  if (entries.length === 0) {
    const goal = goalKg * multiplier;
    return {
      min: Math.max(goal - (unit === 'g' ? 50000 : 5), 0),
      max: goal + (unit === 'g' ? 110000 : 11),
    };
  }

  const { minValue, maxValue } = entries.reduce(
    (range, entry) => {
      const value = entry.weight * multiplier;
      return {
        minValue: Math.min(range.minValue, value),
        maxValue: Math.max(range.maxValue, value),
      };
    },
    { minValue: Number.POSITIVE_INFINITY, maxValue: Number.NEGATIVE_INFINITY },
  );
  const span = maxValue - minValue;
  const basePadding = unit === 'g'
    ? Math.max(50, Math.round(minValue * 0.05))
    : Math.max(0.5, minValue * 0.05);
  const padding = span > 0 ? Math.max(span * 0.15, basePadding) : basePadding;
  const min = minValue - padding;
  const max = maxValue + padding;

  if (unit === 'g') {
    return { min: Math.max(0, Math.floor(min)), max: Math.ceil(max) };
  }
  return {
    min: Math.max(0, Math.floor(min * 10) / 10),
    max: Math.ceil(max * 10) / 10,
  };
}

export function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.iso.localeCompare(b.iso));
}
