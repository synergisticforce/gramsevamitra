export type UnitCategory = 'length' | 'weight' | 'temperature';

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
  { id: 'lb', label: 'Pound (lb)', toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
  { id: 'oz', label: 'Ounce (oz)', toBase: (v) => v * 0.028349523125, fromBase: (v) => v / 0.028349523125 },
];

const TEMP_UNITS: UnitDef[] = [
  { id: 'c', label: 'Celsius (°C)', toBase: (v) => v, fromBase: (v) => v },
  { id: 'f', label: 'Fahrenheit (°F)', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
  { id: 'k', label: 'Kelvin (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
];

export const UNIT_CATEGORIES: Record<UnitCategory, UnitDef[]> = {
  length: LENGTH_UNITS,
  weight: WEIGHT_UNITS,
  temperature: TEMP_UNITS,
};

export const DEFAULT_UNITS: Record<UnitCategory, { from: string; to: string }> = {
  length: { from: 'm', to: 'ft' },
  weight: { from: 'kg', to: 'lb' },
  temperature: { from: 'c', to: 'f' },
};

export function getUnit(units: UnitDef[], id: string): UnitDef {
  return units.find((u) => u.id === id) ?? units[0];
}

export function convertUnits(
  value: number,
  fromUnit: UnitDef,
  toUnit: UnitDef,
): number {
  if (!Number.isFinite(value)) return NaN;
  const base = fromUnit.toBase(value);
  return toUnit.fromBase(base);
}

export function formatConverted(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1_000_000) / 1_000_000;
  return String(rounded);
}
