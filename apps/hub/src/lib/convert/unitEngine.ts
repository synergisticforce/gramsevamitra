export type UnitCategory =
  | 'length'
  | 'weight'
  | 'temperature'
  | 'area'
  | 'volume'
  | 'speed'
  | 'time';

export interface UnitDef {
  id: string;
  label: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

const LENGTH_UNITS: UnitDef[] = [
  { id: 'm', label: 'Meter (m)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'km', label: 'Kilometer (km)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  { id: 'cm', label: 'Centimeter (cm)', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
  { id: 'mm', label: 'Millimeter (mm)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { id: 'mi', label: 'Mile (mi)', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  { id: 'yd', label: 'Yard (yd)', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
  { id: 'ft', label: 'Foot (ft)', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  { id: 'in', label: 'Inch (in)', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
];

const WEIGHT_UNITS: UnitDef[] = [
  { id: 'kg', label: 'Kilogram (kg)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'g', label: 'Gram (g)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { id: 'mg', label: 'Milligram (mg)', toBase: (v) => v / 1_000_000, fromBase: (v) => v * 1_000_000 },
  { id: 't', label: 'Metric ton (t)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  { id: 'lb', label: 'Pound (lb)', toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
  { id: 'oz', label: 'Ounce (oz)', toBase: (v) => v * 0.028349523125, fromBase: (v) => v / 0.028349523125 },
];

const TEMP_UNITS: UnitDef[] = [
  { id: 'c', label: 'Celsius (°C)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'f', label: 'Fahrenheit (°F)', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
  { id: 'k', label: 'Kelvin (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
];

/** Base unit: square meter (m²) */
const AREA_UNITS: UnitDef[] = [
  { id: 'm2', label: 'Square meter (m²)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'km2', label: 'Square kilometer (km²)', toBase: (v) => v * 1_000_000, fromBase: (v) => v / 1_000_000 },
  { id: 'cm2', label: 'Square centimeter (cm²)', toBase: (v) => v / 10_000, fromBase: (v) => v * 10_000 },
  { id: 'ha', label: 'Hectare (ha)', toBase: (v) => v * 10_000, fromBase: (v) => v / 10_000 },
  { id: 'acre', label: 'Acre', toBase: (v) => v * 4046.8564224, fromBase: (v) => v / 4046.8564224 },
  { id: 'ft2', label: 'Square foot (ft²)', toBase: (v) => v * 0.09290304, fromBase: (v) => v / 0.09290304 },
  { id: 'in2', label: 'Square inch (in²)', toBase: (v) => v * 0.00064516, fromBase: (v) => v / 0.00064516 },
];

/** Base unit: liter (L) */
const VOLUME_UNITS: UnitDef[] = [
  { id: 'l', label: 'Liter (L)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'ml', label: 'Milliliter (mL)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { id: 'm3', label: 'Cubic meter (m³)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
  { id: 'cm3', label: 'Cubic centimeter (cm³)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { id: 'gal', label: 'US gallon (gal)', toBase: (v) => v * 3.785411784, fromBase: (v) => v / 3.785411784 },
  { id: 'floz', label: 'US fluid ounce (fl oz)', toBase: (v) => v * 0.0295735295625, fromBase: (v) => v / 0.0295735295625 },
  { id: 'ft3', label: 'Cubic foot (ft³)', toBase: (v) => v * 28.316846592, fromBase: (v) => v / 28.316846592 },
];

/** Base unit: meters per second (m/s) */
const SPEED_UNITS: UnitDef[] = [
  { id: 'mps', label: 'Meter/sec (m/s)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'kmh', label: 'Kilometer/hour (km/h)', toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
  { id: 'mph', label: 'Mile/hour (mph)', toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
  { id: 'fps', label: 'Foot/sec (ft/s)', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
  { id: 'knot', label: 'Knot (kn)', toBase: (v) => v * 0.514444, fromBase: (v) => v / 0.514444 },
];

/** Base unit: second */
const TIME_UNITS: UnitDef[] = [
  { id: 's', label: 'Second (s)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'ms', label: 'Millisecond (ms)', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
  { id: 'min', label: 'Minute (min)', toBase: (v) => v * 60, fromBase: (v) => v / 60 },
  { id: 'hr', label: 'Hour (hr)', toBase: (v) => v * 3600, fromBase: (v) => v / 3600 },
  { id: 'day', label: 'Day', toBase: (v) => v * 86_400, fromBase: (v) => v / 86_400 },
  { id: 'wk', label: 'Week', toBase: (v) => v * 604_800, fromBase: (v) => v / 604_800 },
];

export const UNIT_CATEGORIES: Record<UnitCategory, UnitDef[]> = {
  length: LENGTH_UNITS,
  weight: WEIGHT_UNITS,
  temperature: TEMP_UNITS,
  area: AREA_UNITS,
  volume: VOLUME_UNITS,
  speed: SPEED_UNITS,
  time: TIME_UNITS,
};

export const ALL_UNIT_CATEGORIES: UnitCategory[] = [
  'length',
  'weight',
  'temperature',
  'area',
  'volume',
  'speed',
  'time',
];

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  length: 'Length',
  weight: 'Weight',
  temperature: 'Temperature',
  area: 'Area',
  volume: 'Volume',
  speed: 'Speed',
  time: 'Time',
};

export const DEFAULT_UNITS: Record<UnitCategory, { from: string; to: string }> = {
  length: { from: 'm', to: 'ft' },
  weight: { from: 'kg', to: 'lb' },
  temperature: { from: 'c', to: 'f' },
  area: { from: 'm2', to: 'ft2' },
  volume: { from: 'l', to: 'gal' },
  speed: { from: 'kmh', to: 'mph' },
  time: { from: 'min', to: 'hr' },
};

export function getUnit(units: UnitDef[], id: string): UnitDef {
  return units.find((u) => u.id === id) ?? units[0];
}

export function convertUnits(value: number, fromUnit: UnitDef, toUnit: UnitDef): number {
  if (!Number.isFinite(value)) return NaN;
  const base = fromUnit.toBase(value);
  return toUnit.fromBase(base);
}

export function formatConverted(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1_000_000) / 1_000_000;
  return String(rounded);
}
