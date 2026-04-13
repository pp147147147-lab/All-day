
export type ShiftType = 'A' | 'B' | 'C' | 'Xa' | 'Xb' | 'Xc';
export type ShiftSymbol = 'X' | 'O' | '特' | '婚' | '產' | '年' | '喪';

// Union for cell content
export type CellData = ShiftType[] | ShiftSymbol;

// New type for the selected tool in UI
export type Tool = ShiftSymbol | string | 'eraser' | null;

export interface Employee {
  id: string;
  name: string;
  // dateKey -> array of shifts (e.g. ['A', 'B']) OR single symbol string
  shifts: Record<string, CellData>; 
  
  // Track which dates were manually modified by the user
  // dateKey -> true or array of manual shifts
  manualEntries?: Record<string, boolean | ShiftType[]>;

  // Custom target override (optional). If null, use calculated default.
  customTarget?: number;
  
  // If true, employee can only work shifts that include 'A' (A, AB, ABC). Cannot work BC.
  noBC?: boolean;
  
  // If true, the employee's schedule is locked and cannot be modified manually or by auto-scheduler
  isLocked?: boolean;
  
  // Stats for display
  generatedShiftCount: number; // Actual shifts assigned (A=1, B=1...)
  targetDeduction: number; // Points to deduct from target based on symbols
  generatedWorkDays?: number; // Number of days with at least one shift
  specialDaysCount?: number; // Number of days with a special symbol
  deficit?: number; // Internal use for sorting
}

export enum ThursdayScenario {
  A = 'A', // A=5, B=5
  B = 'B', // A=5, B=4
  C = 'C', // A=4, B=4
  C_Plus_Tue = 'C_Plus_Tue', // A=4, B=4 + Tue Reduced
  D = 'D', // A=5, B=5 + Tue Reduced
}

export interface SchedulingConfig {
  year: number;
  month: number;
  staffIds: string[];
  
  // Daily Requirements
  reqStandardA: number;
  reqStandardB: number;
  reqStandardC: number;
  reqSaturdayA: number;
  
  // Thursday Logic (Auto-selected usually, but kept in config if we want to force it per week)
  thursdayMode: 'Auto' | ThursdayScenario;

  // Year Holiday Date Range (YYYY-MM-DD)
  yearHolidayStart: string;
  yearHolidayEnd: string;

  // Jan 1st Configuration
  jan1WorkDay: boolean;

  // Auto Balance Configuration
  autoBalanceOffToSpecial: boolean;

  // Minimum Days Off Configuration
  enableMinDaysOff?: boolean;
  minDaysOff?: number;

  // Historical Saturday Counts for balancing
  historicalSaturdayCounts: Record<string, number>;

  // Custom Holidays (YYYY-MM-DD -> Holiday Name)
  customHolidays: Record<string, string>;
}

export interface ScheduleResult {
  employees: Employee[];
  warnings: string[];
  stats: {
    totalDemand: number;
    totalCapacity: number;
    suggestedSpecialLeaves: number;
  };
  usedThursdayScenario: ThursdayScenario;
  usedTuesdayReduction: boolean;
}
