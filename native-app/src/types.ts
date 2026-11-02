export type WeightUnit = 'kg' | 'g';

export interface WeightEntry {
  iso: string;
  weight: number;
}

export interface Profile {
  id: string;
  name: string;
  avatarImage: string;
  entries: WeightEntry[];
  goal: number;
  unit: WeightUnit;
}

export interface TrackerData {
  activeProfileId: string;
  profiles: Profile[];
}

export interface SummaryStats {
  currentWeight: string;
  totalChange: string;
  todayChange: string;
  weekChange: string;
  monthChange: string;
}
