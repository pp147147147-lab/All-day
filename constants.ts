
import { ThursdayScenario, ShiftSymbol } from './types';

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const DEFAULT_STAFF_NAMES = [
  '', '', '', '', '', '', '', ''
];

export const SCENARIO_DESCRIPTIONS: Record<ThursdayScenario, string> = {
  [ThursdayScenario.A]: '情境 A (早5, 午5)',
  [ThursdayScenario.B]: '情境 B (早5, 午4)',
  [ThursdayScenario.C]: '情境 C (早4, 午4)',
  [ThursdayScenario.C_Plus_Tue]: '情境 C + 週二減員',
  [ThursdayScenario.D]: '情境 D(9位,週1,5,6六位)',
};

// Visual styles for symbols and shifts
export const CELL_STYLES: Record<string, string> = {
  'A': 'bg-white text-gray-900 border border-gray-400 font-bold', // Standard shift
  'B': 'bg-white text-gray-900 border border-gray-400 font-bold', // Standard shift
  'C': 'bg-white text-gray-900 border border-gray-400 font-bold', // Standard shift
  
  // Positional X (Looks like X symbol but fits in slot)
  'Xa': 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
  'Xb': 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
  'Xc': 'bg-blue-100 text-blue-800 font-bold border border-blue-200',

  // Special Symbols
  'X': 'bg-blue-100 text-blue-800 font-bold', // Clinic Closed (No deduction)
  'O': 'bg-blue-100 text-blue-800 font-bold', // Off (No deduction)
  '特': 'bg-pink-100 text-pink-700 font-bold', // Special Leave (-2)
  '婚': 'bg-pink-100 text-pink-700 font-bold', // Wedding (-2)
  '產': 'bg-pink-100 text-pink-700 font-bold', // Maternity (-2)
  '年': 'bg-pink-100 text-pink-700 font-bold', // CNY (No shift)
  '喪': 'bg-gray-200 text-gray-700 font-bold', // Funeral (-2)
};

export const SYMBOL_DEDUCTIONS: Record<ShiftSymbol, number> = {
  'X': 0,
  'O': 0,
  '特': 2,
  '婚': 2,
  '產': 2,
  '年': 0, // Since the base target is reduced by holiday days, individual symbol marking shouldn't deduct extra.
  '喪': 2,
};

export const TARGET_MULTIPLIER = 2; // (Days - Sat - Sun) * 2
