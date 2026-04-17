import { Employee, SchedulingConfig, ThursdayScenario, CellData, ShiftSymbol, ScheduleResult, ShiftType } from '../types';
import { SYMBOL_DEDUCTIONS, WEEKDAYS } from '../constants';
import { Solar } from 'lunar-javascript';

// --- 常數設定區 ---
const PRIORITY_HOLIDAY = 9999;
const PRIORITY_THRESHOLD = 9000;
const COST_ABC = 3;
const COST_BC = 2;
const COST_A = 1;

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const isYearHoliday = (year: number, month: number, day: number, startStr?: string, endStr?: string, jan1WorkDay: boolean = false): boolean => {
  if (month === 0 && day === 1 && !jan1WorkDay) return true;
  if (!startStr || !endStr) return false;
  
  const current = new Date(year, month, day);
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  current.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
};

// 支援動態假日的寫法
export const getSpecialHolidayName = (
  year: number, month: number, day: number, jan1WorkDay: boolean = false, customHolidays?: Record<string, string>
): string | null => {
    const m = month + 1;
    const dateStr = `${year}-${m}-${day}`;
    
    if (m === 1 && day === 1 && jan1WorkDay) return "元旦";
    if (m === 2 && day === 28) return "和平紀念日";
    if (m === 4 && day === 4) return "兒童節";
    if (m === 4 && day === 5) return "清明節";
    if (m === 5 && day === 1) return "勞動節";
    if (m === 9 && day === 28) return "教師節";
    if (m === 10 && day === 10) return "國慶日";
    if (m === 10 && day === 25) return "台灣光復節";
    if (m === 12 && day === 25) return "行憲紀念日";

    const solar = Solar.fromYmd(year, m, day);
    const lunar = solar.getLunar();
    if (lunar.getMonth() === 5 && lunar.getDay() === 5) return "端午節";
    if (lunar.getMonth() === 8 && lunar.getDay() === 15) return "中秋節";

    if (customHolidays && customHolidays[dateStr]) return customHolidays[dateStr];
    return null;
}

export const getMonthlySpecialHolidays = (year: number, month: number, jan1WorkDay: boolean = false, customHolidays?: Record<string, string>): string[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const holidays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (month === 0 && d === 1 && !jan1WorkDay) {
        holidays.push(`${d}號 元旦 (休診)`);
        continue;
    }
    const name = getSpecialHolidayName(year, month, d, jan1WorkDay, customHolidays);
    if (name) holidays.push(`${d}號 ${name}`);
  }
  return holidays;
};

export const calculateBaseTarget = (
  year: number, month: number, holidayStart?: string, holidayEnd?: string, jan1WorkDay: boolean = false, customHolidays?: Record<string, string>
): number => {
  const daysInMonth = getDaysInMonth(year, month);
  let deductions = 0;
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) deductions++;
    if (isYearHoliday(year, month, d, holidayStart, holidayEnd, jan1WorkDay)) {
        if (!isWeekend) deductions++;
    }
    if (getSpecialHolidayName(year, month, d, jan1WorkDay, customHolidays) !== null) {
        deductions++;
    }
  }
  
  const calculatedDays = daysInMonth - deductions;
  return Math.max(0, calculatedDays * 2);
};

const getDeduction = (cellData: CellData): number => {
  if (Array.isArray(cellData)) return 0;
  return SYMBOL_DEDUCTIONS[cellData as ShiftSymbol] || 0;
};

const isABCShift = (cell: CellData | undefined): boolean => {
  return Array.isArray(cell) && cell.length === 3 && cell.includes('A') && cell.includes('B') && cell.includes('C');
};

export const recalculateEmployeeStats = (emp: Employee, targetYear: number, targetMonth: number): Employee => {
  let shiftCount = 0;
  let deduction = 0;
  let workDays = 0;
  let specialDays = 0;
  
  Object.entries(emp.shifts).forEach(([dateKey, cell]) => {
    const parts = dateKey.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);

    if (y === targetYear && m === targetMonth) {
      if (Array.isArray(cell)) {
        const workShifts = cell.filter(s => ['A', 'B', 'C'].includes(s));
        shiftCount += workShifts.length;
        if (workShifts.length > 0) {
            workDays++;
        }
      } else {
        deduction += getDeduction(cell);
        if (cell !== 'O' && cell !== 'X') {
            specialDays++;
        }
      }
    }
  });

  return { ...emp, generatedShiftCount: shiftCount, targetDeduction: deduction, generatedWorkDays: workDays, specialDaysCount: specialDays };
};

export const getDailyRequirements = (
  date: Date, config: SchedulingConfig, scenario: ThursdayScenario, useTuesdayReduction: boolean = false
) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dow = date.getDay();
  const customHolidays = (config as any).customHolidays;
  
  if (isYearHoliday(year, month, day, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) {
     return { A: 0, B: 0, C: 0, total: 0 };
  }
  const specialHolidayName = getSpecialHolidayName(year, month, day, config.jan1WorkDay, customHolidays);
  if (specialHolidayName === "清明節") {
     return { A: 0, B: 0, C: 0, total: 0 };
  }
  if (dow === 0) return { A: 0, B: 0, C: 0, total: 0 };
  if (dow === 6) {
      if (scenario === ThursdayScenario.D) {
          return { A: 6, B: 0, C: 0, total: 6 };
      }
      return { A: config.reqSaturdayA, B: 0, C: 0, total: config.reqSaturdayA };
  }
  if (dow === 4) { 
    let reqA = 0, reqB = 0;
    switch (scenario) {
      case ThursdayScenario.A: reqA = 5; reqB = 5; break;
      case ThursdayScenario.B: reqA = 5; reqB = 4; break;
      case ThursdayScenario.C: reqA = 4; reqB = 4; break;
      case ThursdayScenario.C_Plus_Tue: reqA = 4; reqB = 4; break;
      case ThursdayScenario.D: reqA = 6; reqB = 5; break;
    }
    return { A: reqA, B: reqB, C: 0, total: reqA + reqB };
  }
  
  let stdA = config.reqStandardA;
  let stdB = config.reqStandardB;
  let stdC = config.reqStandardC;
  if (dow === 2) {
      if (scenario === ThursdayScenario.D) {
          stdA = 6; stdB = 5; stdC = 5;
      } else if (useTuesdayReduction) {
          stdB = 4; stdC = 4;
      }
  } else if (scenario === ThursdayScenario.D) {
      stdA = 6;
      if (dow === 1 || dow === 5) {
          stdB = 6;
          stdC = 6;
      }
  }
  return { A: stdA, B: stdB, C: stdC, total: stdA + stdB + stdC };
};

export const calculateOverviewStats = (
    config: SchedulingConfig, employees: Employee[], activeScenario: ThursdayScenario, useTuesdayReduction: boolean
) => {
    const customHolidays = (config as any).customHolidays;
    const { year, month } = config;
    const daysInMonth = getDaysInMonth(year, month);
    const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, customHolidays);
    
    let totalDemand = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const req = getDailyRequirements(date, config, activeScenario, useTuesdayReduction);
        totalDemand += req.total;
    }

    let totalCapacity = 0;
    employees.forEach(e => {
        const effectiveTarget = (e.customTarget ?? baseTarget) - e.targetDeduction;
        totalCapacity += Math.max(0, effectiveTarget);
    });

    const surplus = totalCapacity - totalDemand;
    return { totalDemand, totalCapacity, suggestedSpecialLeaves: Math.max(0, Math.floor(surplus / 2)) };
};

export const validateSchedule = (
  employees: Employee[], config: SchedulingConfig, activeScenario: ThursdayScenario, activeTuesdayReduction: boolean
): string[] => {
  const warnings: string[] = [];
  const daysInMonth = getDaysInMonth(config.year, config.month);
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(config.year, config.month, d);
    const dateKey = `${config.year}-${config.month}-${d}`;
    const req = getDailyRequirements(date, config, activeScenario, activeTuesdayReduction);
    
    let countA = 0, countB = 0, countC = 0;
    employees.forEach(emp => {
      const cell = emp.shifts[dateKey];
      if (Array.isArray(cell)) {
        if (cell.includes('A')) countA++;
        if (cell.includes('B')) countB++;
        if (cell.includes('C')) countC++;
      }
    });

    if (countA !== req.A) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): A班 ${countA}人 (應為 ${req.A})`);
    if (countB !== req.B) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): B班 ${countB}人 (應為 ${req.B})`);
    if (countC !== req.C) warnings.push(`${d}號 (週${WEEKDAYS[date.getDay()]}): C班 ${countC}人 (應為 ${req.C})`);
  }
  return warnings;
};

const solveDayPatterns = (reqA: number, reqB: number, reqC: number, availableStaff: number) => {
  let bestSolution: { nABC: number, nAB: number, nBC: number, nA: number, nC: number, staffNeeded: number } | null = null;
  let minStaff = Infinity;

  for (let nABC = 0; nABC <= Math.min(reqA, reqB, reqC, availableStaff); nABC++) {
    for (let nAB = 0; nAB <= Math.min(reqA - nABC, reqB - nABC, availableStaff - nABC); nAB++) {
      for (let nBC = 0; nBC <= Math.min(reqB - nABC - nAB, reqC - nABC, availableStaff - nABC - nAB); nBC++) {
        const nA = reqA - nABC - nAB;
        const nC = reqC - nABC - nBC;
        
        if (nABC + nAB + nBC === reqB && nA >= 0 && nC >= 0) {
          const staffNeeded = nABC + nAB + nBC + nA + nC;
          if (staffNeeded <= availableStaff && staffNeeded < minStaff) {
            minStaff = staffNeeded;
            bestSolution = { nABC, nAB, nBC, nA, nC, staffNeeded };
          }
        }
      }
    }
  }
  
  if (!bestSolution) {
      const nABC = Math.min(reqA, reqB, reqC, availableStaff);
      let remStaff = availableStaff - nABC;
      const nAB = Math.min(reqA - nABC, reqB - nABC, remStaff);
      remStaff -= nAB;
      const nBC = Math.min(reqB - nABC - nAB, reqC - nABC, remStaff);
      remStaff -= nBC;
      const nA = Math.max(0, reqA - nABC - nAB);
      const nC = Math.max(0, reqC - nABC - nBC);
      bestSolution = { nABC, nAB, nBC, nA, nC, staffNeeded: nABC + nAB + nBC + nA + nC };
  }
  
  return bestSolution;
};

const solveThursday = (scenario: ThursdayScenario) => {
  switch (scenario) {
    case ThursdayScenario.A: return { numAB: 5, numA: 0 };
    case ThursdayScenario.B: return { numAB: 4, numA: 1 };
    case ThursdayScenario.C: return { numAB: 4, numA: 0 };
    case ThursdayScenario.C_Plus_Tue: return { numAB: 4, numA: 0 };
    case ThursdayScenario.D: return { numAB: 5, numA: 1 };
  }
};

const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const pickBestCandidates = (
  pool: Employee[], countNeeded: number, cost: number, baseTarget: number, filterFn?: (e: Employee) => boolean
): Employee[] => {
  const eligible = filterFn ? pool.filter(filterFn) : pool;
  const withDeficit = eligible.map(e => {
    const target = (e.customTarget ?? baseTarget) - e.targetDeduction;
    const current = e.generatedShiftCount;
    return { ...e, deficit: target - current };
  });

  const tier1 = withDeficit.filter(e => e.deficit >= cost);
  const tier2 = withDeficit.filter(e => e.deficit < cost);

  shuffle(tier1);
  shuffle(tier2);

  tier1.sort((a, b) => b.deficit - a.deficit);
  tier2.sort((a, b) => b.deficit - a.deficit);

  return [...tier1, ...tier2].slice(0, countNeeded);
};

const applyShifts = (
    employees: Employee[], candidates: Employee[], dateKey: string, shift: ShiftType[], cost: number
) => {
    candidates.forEach(c => {
        const realEmp = employees.find(e => e.id === c.id);
        if (realEmp) {
            const existing = realEmp.shifts[dateKey];
            let wasWorking = false;
            if (Array.isArray(existing)) {
                wasWorking = existing.some(s => ['A', 'B', 'C'].includes(s));
                const xShifts = existing.filter(s => ['Xa', 'Xb', 'Xc'].includes(s));
                realEmp.shifts[dateKey] = [...xShifts, ...shift];
            } else {
                realEmp.shifts[dateKey] = [...shift];
            }
            realEmp.generatedShiftCount += cost;
            if (!wasWorking) {
                realEmp.generatedWorkDays = (realEmp.generatedWorkDays || 0) + 1;
            }
        }
    });
};

const calculateDayPriority = (
    d: number, year: number, month: number, employees: Employee[], config: SchedulingConfig, scenario: ThursdayScenario, useTueReduction: boolean
) => {
    const date = new Date(year, month, d);
    const dateKey = `${year}-${month}-${d}`;
    const customHolidays = (config as any).customHolidays;
    
    if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) return PRIORITY_HOLIDAY;
    const specialHolidayName = getSpecialHolidayName(year, month, d, config.jan1WorkDay, customHolidays);
    if (specialHolidayName === "清明節") return PRIORITY_HOLIDAY;
    if (date.getDay() === 0) return PRIORITY_HOLIDAY;
    if (date.getDay() === 6) return -10000 + d; // Prioritize Saturdays first

    const available = employees.filter(e => {
        const shift = e.shifts[dateKey];
        if (!shift) return true;
        if (Array.isArray(shift)) {
            const hasActualShift = shift.some(s => ['A', 'B', 'C'].includes(s));
            return !hasActualShift;
        }
        return false;
    }).length;
    const req = getDailyRequirements(date, config, scenario, useTueReduction);
    return (available * 100) - req.total;
}

// 改良版防呆機制：利用 Date 跨月取值，並「只檢查過去日期」
const getDateKeyByOffset = (y: number, m: number, d: number, offset: number) => {
    const targetDate = new Date(y, m, d + offset);
    return `${targetDate.getFullYear()}-${targetDate.getMonth()}-${targetDate.getDate()}`;
};

const workedLastSaturday = (emp: Employee, y: number, m: number, d: number): boolean => {
    const dateKey = getDateKeyByOffset(y, m, d, -7);
    const shift = emp.shifts[dateKey];
    if (Array.isArray(shift)) {
        return shift.some(s => ['A', 'B', 'C'].includes(s));
    }
    return false;
};

const checkConsecutiveABC = (emp: Employee, year: number, month: number, d: number, force: boolean): boolean => {
    if (force) return true;
    
    const prev2 = emp.shifts[getDateKeyByOffset(year, month, d, -2)];
    const prev1 = emp.shifts[getDateKeyByOffset(year, month, d, -1)];
    const next1 = emp.shifts[getDateKeyByOffset(year, month, d, 1)];
    const next2 = emp.shifts[getDateKeyByOffset(year, month, d, 2)];
    
    const isABC = (cell: any) => isABCShift(cell);

    // Check if adding ABC to day 'd' would create 3 consecutive ABCs
    if (isABC(prev2) && isABC(prev1)) return false; // prev2, prev1, [d]
    if (isABC(prev1) && isABC(next1)) return false; // prev1, [d], next1
    if (isABC(next1) && isABC(next2)) return false; // [d], next1, next2

    return true;
};

const checkRollingWeeklyLimits = (emp: Employee, year: number, month: number, d: number, proposedShifts: ShiftType[], daysInMonth: number, force: boolean): boolean => {
    if (force) return true; // Relax limits on critical days

    for (let startD = d - 6; startD <= d; startD++) {
        let endD = startD + 6;
        
        let shiftsInWindow = 0;
        let workDaysInWindow = 0;
        
        for (let currD = startD; currD <= endD; currD++) {
            if (currD < 1 || currD > daysInMonth) continue;
            
            let shiftsForCurrD: ShiftType[] = [];
            if (currD === d) {
                shiftsForCurrD = proposedShifts;
            } else {
                const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(currD).padStart(2, '0')}`;
                const cell = emp.shifts[dateKey];
                if (Array.isArray(cell)) {
                    shiftsForCurrD = cell.filter(s => ['A', 'B', 'C'].includes(s as any)) as ShiftType[];
                }
            }
            
            if (shiftsForCurrD.length > 0) {
                workDaysInWindow++;
                shiftsInWindow += shiftsForCurrD.length;
            }
        }
        
        if (shiftsInWindow > 12) return false;
        if (workDaysInWindow > 5) return false; // Max 5 work days per 7-day window => at least 2 days off
    }
    return true;
};

const canWorkShifts = (emp: Employee, dateKey: string, requiredShifts: ShiftType[], config: SchedulingConfig, daysInMonth: number, isCriticalDay: boolean = false): boolean => {
    if (emp.noBC && !requiredShifts.includes('A')) return false;

    const shift = emp.shifts[dateKey];
    
    if (config.enableMinDaysOff) {
        const hasActualShiftToday = Array.isArray(shift) && shift.some(s => ['A', 'B', 'C'].includes(s));
        if (!hasActualShiftToday) {
            const workingDays = emp.generatedWorkDays || 0;
            const specialDays = emp.specialDaysCount || 0;
            const maxWorkingDays = Math.max(0, daysInMonth - (config.minDaysOff || 10) - specialDays);
            if (workingDays >= maxWorkingDays) {
                return false;
            }
        }
    }

    const [yearStr, monthStr, dayStr] = dateKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (!checkRollingWeeklyLimits(emp, year, month, day, requiredShifts, daysInMonth, isCriticalDay)) {
        return false;
    }

    if (!shift) return true;
    if (Array.isArray(shift)) {
        const hasActualShift = shift.some(s => ['A', 'B', 'C'].includes(s));
        if (hasActualShift) return false;

        if (requiredShifts.includes('A') && shift.includes('Xa')) return false;
        if (requiredShifts.includes('B') && shift.includes('Xb')) return false;
        if (requiredShifts.includes('C') && shift.includes('Xc')) return false;

        return true;
    }
    return false;
};

const getExistingShiftCounts = (employees: Employee[], dateKey: string) => {
    let existingA = 0;
    let existingB = 0;
    let existingC = 0;
    
    employees.forEach(e => {
        const shift = e.shifts[dateKey];
        if (Array.isArray(shift)) {
            if (shift.includes('A')) existingA++;
            if (shift.includes('B')) existingB++;
            if (shift.includes('C')) existingC++;
        }
    });
    
    return { existingA, existingB, existingC };
};

export const determineActiveScenario = (config: SchedulingConfig, employees: Employee[]) => {
  const customHolidays = (config as any).customHolidays;
  const { year, month, thursdayMode } = config;
  const daysInMonth = getDaysInMonth(year, month);
  const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, customHolidays);

  let absTotalCapacity = 0;
  employees.forEach(e => {
      absTotalCapacity += Math.max(0, (e.customTarget ?? baseTarget) - e.targetDeduction);
  });

  let baseDemand = 0, thursdayCount = 0, tuesdayCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) continue; 
    const specialHolidayName = getSpecialHolidayName(year, month, d, config.jan1WorkDay, customHolidays);
    if (specialHolidayName === "清明節") continue;
    const dow = date.getDay();
    if (dow === 0) continue; 
    
    if (dow === 6) baseDemand += config.reqSaturdayA;
    else if (dow === 4) { thursdayCount++; baseDemand += 10; } 
    else { baseDemand += (config.reqStandardA + config.reqStandardB + config.reqStandardC); if (dow === 2) tuesdayCount++; }
  }

  let selectedScenario = ThursdayScenario.A;
  let useTuesdayReduction = false;
  
  if (thursdayMode === 'Auto') {
      const gap = baseDemand - absTotalCapacity;
      if (gap <= 0) selectedScenario = ThursdayScenario.A;
      else {
          const saveB = thursdayCount * 1;
          const saveC = thursdayCount * 2;
          if (gap <= saveB) selectedScenario = ThursdayScenario.B;
          else if (gap <= saveC) selectedScenario = ThursdayScenario.C;
          else {
              selectedScenario = ThursdayScenario.C_Plus_Tue;
              useTuesdayReduction = true;
          }
      }
  } else {
      selectedScenario = thursdayMode;
      if (thursdayMode === ThursdayScenario.C_Plus_Tue || thursdayMode === ThursdayScenario.D) {
          useTuesdayReduction = true;
      }
  }

  return { selectedScenario, useTuesdayReduction, absTotalCapacity };
};

export const generateSchedule = (config: SchedulingConfig, currentEmployees: Employee[]): ScheduleResult => {
  const customHolidays = (config as any).customHolidays;
  const { year, month, staffIds } = config;
  const daysInMonth = getDaysInMonth(year, month);
  const baseTarget = calculateBaseTarget(year, month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, customHolidays);
  let warnings: string[] = [];

  const employees: Employee[] = staffIds.map(id => {
    const existing = currentEmployees.find(e => e.id === id);
    return {
      id,
      name: existing ? existing.name : `員工 ${id}`,
      shifts: existing ? { ...existing.shifts } : {}, 
      manualEntries: existing ? { ...existing.manualEntries } : {},
      customTarget: existing?.customTarget,
      noBC: existing?.noBC,
      isLocked: existing?.isLocked,
      generatedShiftCount: 0,
      targetDeduction: 0,
    };
  });

  employees.forEach(e => {
    if (e.isLocked) {
        // Do not clear shifts for locked employees
    } else {
        Object.keys(e.shifts).forEach(dateKey => {
          const [y, m] = dateKey.split('-').map(Number);
          if (y === year && m === month) {
              const manual = e.manualEntries?.[dateKey];
              if (!manual) {
                  delete e.shifts[dateKey];
              } else if (Array.isArray(manual)) {
                  e.shifts[dateKey] = [...manual];
              }
          }
        });

        // 自動填上週日為 O
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d);
          if (date.getDay() === 0) {
            const dateKey = `${year}-${month}-${d}`;
            if (!e.manualEntries?.[dateKey]) {
              e.shifts[dateKey] = 'O';
            }
          }
        }
    }

    const cleanEmp = recalculateEmployeeStats(e, year, month);
    e.generatedShiftCount = cleanEmp.generatedShiftCount;
    e.targetDeduction = cleanEmp.targetDeduction;
  });

  let { selectedScenario, useTuesdayReduction, absTotalCapacity } = determineActiveScenario(config, employees);

  
  let finalThuCost = 10;
  if (selectedScenario === ThursdayScenario.B) finalThuCost = 9;
  else if (selectedScenario === ThursdayScenario.C || selectedScenario === ThursdayScenario.C_Plus_Tue) finalThuCost = 8;
  else if (selectedScenario === ThursdayScenario.D) finalThuCost = 11;

  let finalTueCost = config.reqStandardA + config.reqStandardB + config.reqStandardC;
  if (selectedScenario === ThursdayScenario.D) {
      finalTueCost = 6 + 5 + 5;
  } else if (useTuesdayReduction) {
      finalTueCost = config.reqStandardA + 4 + 4; 
  }
  const standardCost = config.reqStandardA + config.reqStandardB + config.reqStandardC;
  
  let finalTotalDemand = 0;
  const daysToSchedule = [];
  for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      if (isYearHoliday(year, month, d, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay)) continue; 
      const specialHolidayName = getSpecialHolidayName(year, month, d, config.jan1WorkDay, customHolidays);
      if (specialHolidayName === "清明節") continue;
      const dow = date.getDay();
      if (dow === 0) continue;
      
      if (dow === 6) {
          if (selectedScenario === ThursdayScenario.D) finalTotalDemand += 6;
          else finalTotalDemand += config.reqSaturdayA;
      }
      else if (dow === 4) finalTotalDemand += finalThuCost;
      else if (dow === 2) finalTotalDemand += finalTueCost;
      else if (selectedScenario === ThursdayScenario.D && (dow === 1 || dow === 5)) finalTotalDemand += 18;
      else if (selectedScenario === ThursdayScenario.D && dow === 3) finalTotalDemand += 6 + config.reqStandardB + config.reqStandardC;
      else finalTotalDemand += standardCost;

      const priority = calculateDayPriority(d, year, month, employees, config, selectedScenario, useTuesdayReduction);
      if (priority < PRIORITY_THRESHOLD) {
          daysToSchedule.push({ day: d, priority });
      }
  }

  let surplus = absTotalCapacity - finalTotalDemand;

  if (config.autoBalanceOffToSpecial && surplus >= 2) {
      const oEntries: { empId: string, dateKey: string }[] = [];
      employees.forEach(e => {
          if (e.isLocked) return; // Skip locked employees
          Object.entries(e.manualEntries || {}).forEach(([dateKey, isManual]) => {
              if (isManual && e.shifts[dateKey] === 'O') {
                  const [y, m] = dateKey.split('-').map(Number);
                  if (y === year && m === month) {
                      oEntries.push({ empId: e.id, dateKey });
                  }
              }
          });
      });

      const oCountPerEmp: Record<string, number> = {};
      oEntries.forEach(entry => {
          oCountPerEmp[entry.empId] = (oCountPerEmp[entry.empId] || 0) + 1;
      });

      oEntries.sort((a, b) => {
          if (oCountPerEmp[b.empId] !== oCountPerEmp[a.empId]) {
              return oCountPerEmp[b.empId] - oCountPerEmp[a.empId];
          }
          return a.dateKey.localeCompare(b.dateKey);
      });

      for (const entry of oEntries) {
          if (surplus < 2) break;
          const emp = employees.find(e => e.id === entry.empId);
          if (emp) {
              emp.shifts[entry.dateKey] = '特';
              emp.manualEntries![entry.dateKey] = true;
              
              const stats = recalculateEmployeeStats(emp, year, month);
              emp.generatedShiftCount = stats.generatedShiftCount;
              emp.targetDeduction = stats.targetDeduction;
              
              surplus -= 2;
              absTotalCapacity -= 2;
          }
      }
  }

  daysToSchedule.sort((a, b) => a.priority - b.priority);

  for (const { day } of daysToSchedule) {
    const date = new Date(year, month, day);
    const dow = date.getDay();
    const dateKey = `${year}-${month}-${day}`;
    
    const staffPool = employees.filter(e => {
        if (e.isLocked) return false; // Locked employees are not available for auto-scheduling
        const shift = e.shifts[dateKey];
        if (!shift) return true;
        if (Array.isArray(shift)) {
            const hasActualShift = shift.some(s => ['A', 'B', 'C'].includes(s));
            return !hasActualShift;
        }
        return false;
    }); 
    
    const isCriticalDay = staffPool.length <= 5;

    if (dow === 6) {
      const { existingA } = getExistingShiftCounts(employees, dateKey);
      const reqSatA = selectedScenario === ThursdayScenario.D ? 6 : config.reqSaturdayA;
      const neededA = Math.max(0, reqSatA - existingA);

      const poolForSatA = staffPool.filter(e => canWorkShifts(e, dateKey, ['A'], config, daysInMonth, isCriticalDay));
      
      const poolDidNotWorkLastSat = poolForSatA.filter(e => !workedLastSaturday(e, year, month, day));
      const poolWorkedLastSat = poolForSatA.filter(e => workedLastSaturday(e, year, month, day));
      
      let candidates: Employee[] = [];
      if (poolDidNotWorkLastSat.length >= neededA) {
          candidates = pickBestCandidates(poolDidNotWorkLastSat, neededA, COST_A, baseTarget);
      } else {
          candidates = pickBestCandidates(poolDidNotWorkLastSat, poolDidNotWorkLastSat.length, COST_A, baseTarget);
          const remainingNeeded = neededA - candidates.length;
          const additionalCandidates = pickBestCandidates(poolWorkedLastSat, remainingNeeded, COST_A, baseTarget);
          candidates = [...candidates, ...additionalCandidates];
      }
      
      applyShifts(employees, candidates, dateKey, ['A'], COST_A);
    } 
    else {
      let reqA = 0, reqB = 0, reqC = 0;
      if (dow === 4) {
          const { numAB, numA } = solveThursday(selectedScenario)!;
          reqA = numAB + numA;
          reqB = numAB;
          reqC = 0;
      } else {
          reqA = config.reqStandardA; 
          reqB = config.reqStandardB; 
          reqC = config.reqStandardC;
          if (selectedScenario === ThursdayScenario.D) {
              reqA = 6;
              if (dow === 1 || dow === 5) {
                  reqB = 6; reqC = 6;
              } else if (dow === 2) {
                  reqB = 5; reqC = 5;
              }
          } else {
              if (dow === 2 && useTuesdayReduction) {
                  reqB = 4; reqC = 4;
              }
          }
      }

      const { existingA, existingB, existingC } = getExistingShiftCounts(employees, dateKey);
      
      const neededA = Math.max(0, reqA - existingA);
      const neededB = Math.max(0, reqB - existingB);
      const neededC = Math.max(0, reqC - existingC);

      const solution = solveDayPatterns(neededA, neededB, neededC, staffPool.length);
      
      if (solution) {
        const { nABC, nAB, nBC, nA, nC } = solution;
        const assignedForDay = new Set<string>();
        
        const applyPattern = (count: number, shifts: ShiftType[], cost: number, requireConsecutiveCheck: boolean = false) => {
            if (count <= 0) return;
            const pool = staffPool.filter(e => 
                !assignedForDay.has(e.id) && 
                canWorkShifts(e, dateKey, shifts, config, daysInMonth, isCriticalDay) &&
                (!requireConsecutiveCheck || checkConsecutiveABC(e, year, month, day, isCriticalDay))
            );
            const candidates = pickBestCandidates(pool, count, cost, baseTarget);
            applyShifts(employees, candidates, dateKey, shifts, cost);
            candidates.forEach(c => assignedForDay.add(c.id));
        };

        applyPattern(nABC, ['A', 'B', 'C'], COST_ABC, true);
        applyPattern(nAB, ['A', 'B'], COST_BC);
        applyPattern(nBC, ['B', 'C'], COST_BC);
        applyPattern(nA, ['A'], COST_A);
        applyPattern(nC, ['C'], COST_A);
      }
    }
  }
  
  employees.forEach(e => {
      const stats = recalculateEmployeeStats(e, year, month);
      e.generatedShiftCount = stats.generatedShiftCount;
      e.targetDeduction = stats.targetDeduction;
  });
  
  warnings = validateSchedule(employees, config, selectedScenario, useTuesdayReduction);

  return {
    employees, warnings,
    stats: { totalDemand: finalTotalDemand, totalCapacity: absTotalCapacity, suggestedSpecialLeaves: Math.max(0, Math.floor(surplus / 2)) },
    usedThursdayScenario: selectedScenario,
    usedTuesdayReduction: useTuesdayReduction
  };
};