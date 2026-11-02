import { normalizeTrackerData } from './storage';
import type { TrackerData } from './types';

export function parseWebExport(contents: string): TrackerData {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    throw new Error('This file is not valid JSON.', { cause: error });
  }

  if (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'format' in value
    && value.format !== 'weight-tracker-export'
  ) {
    throw new Error('This file is not a Weight Tracker export.');
  }

  return normalizeTrackerData(value);
}
