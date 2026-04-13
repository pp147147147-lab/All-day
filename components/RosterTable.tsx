
import React, { useState } from 'react';
import { Employee, ShiftType, ShiftSymbol, SchedulingConfig, ThursdayScenario, Tool } from '../types';
import { CELL_STYLES, WEEKDAYS } from '../constants';
import { getDailyRequirements, getSpecialHolidayName } from '../services/scheduleGenerator';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';

interface RosterTableProps {
  year: number;
  month: number;
  employees: Employee[];
  baseTarget: number;
  onCellClick: (empIndex: number, day: number, shiftClicked?: ShiftType) => void;
  onToggleLock: (empIndex: number) => void;
  selectedSymbol: Tool;
  config: SchedulingConfig;
  activeScenario: ThursdayScenario;
  usedTuesdayReduction: boolean;
}

const ShiftBadge: React.FC<{ type: ShiftType }> = ({ type }) => {
  const label = type.startsWith('X') ? 'X' : type;
  
  return (
      <div className={`flex items-center justify-center w-full h-full text-sm font-bold print:text-base print:text-black ${CELL_STYLES[type] ? CELL_STYLES[type].replace('border border-gray-400', '') : 'text-gray-900'}`}>
          {label}
      </div>
  );
};

const SymbolBadge: React.FC<{ symbol: ShiftSymbol }> = ({ symbol }) => {
    return (
        <div className={`flex items-center justify-center w-full h-full text-xs font-bold print:text-xs ${CELL_STYLES[symbol] || ''}`}>
            {symbol}
        </div>
    );
};

const RosterTable: React.FC<RosterTableProps> = ({ 
    year, month, employees, baseTarget, onCellClick, onToggleLock, selectedSymbol,
    config, activeScenario, usedTuesdayReduction
}) => {
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getDayInfo = (day: number) => {
    const date = new Date(year, month, day);
    const dow = date.getDay(); 
    const specialHoliday = getSpecialHolidayName(year, month, day, config.jan1WorkDay, config.customHolidays || {});
    return {
      dow,
      label: WEEKDAYS[dow],
      isWeekend: dow === 0 || dow === 6,
      isSunday: dow === 0,
      isSaturday: dow === 6,
      specialHoliday
    };
  };

  const handleCellClick = (idx: number, day: number, shiftType?: ShiftType) => {
      const { isSunday } = getDayInfo(day);
      if (isSunday) return;
      onCellClick(idx, day, shiftType);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative bg-white shadow-sm border-t border-gray-200 print:shadow-none print:border-0 print:block print:overflow-visible print:h-auto">
      
      {/* Print Header Removed as requested */}

      <div className="overflow-auto flex-1 pb-4 bg-white print:overflow-visible print:pb-0">
        <table className="min-w-max border-collapse text-xs w-full print:text-[10px] print:w-full">
          <thead className="bg-white sticky top-0 z-20 shadow-sm print:static print:shadow-none print:table-header-group">
            <tr>
              <th className="sticky left-0 z-30 bg-white border border-gray-300 p-1 min-w-[36px] w-[36px] text-center text-base font-bold text-gray-700 print:border-black print:static print:bg-transparent print:w-auto print:min-w-0 align-bottom">
                <span className="[writing-mode:vertical-rl]">員工</span>
              </th>
              <th className="sticky left-[36px] z-30 bg-white border border-gray-300 p-0.5 min-w-[24px] w-[24px] text-center text-[10px] font-bold text-gray-700 print:border-black print:static print:bg-transparent print:w-auto print:min-w-0">
                班
              </th>
              
              {daysArray.map(day => {
                const { label, isSunday, isSaturday, specialHoliday } = getDayInfo(day);
                return (
                  <th key={day} className={`border border-gray-300 p-0 w-[32px] min-w-[32px] text-center h-10 align-middle print:border-black print:h-10 print:w-[32px] print:min-w-[32px] ${isSunday ? 'bg-red-50' : isSaturday ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className="flex flex-col items-center justify-center h-full relative">
                      <span className="text-[10px] text-gray-500 leading-none mb-0.5 print:text-black print:text-xs">{day}</span>
                      <span className={`text-xs font-bold leading-none print:text-xs ${isSunday ? 'text-red-600' : isSaturday ? 'text-green-700' : 'text-gray-800'}`}>
                        {label}
                      </span>
                      {specialHoliday && (
                          <span className="text-[8px] text-purple-600 font-bold absolute bottom-0.5 scale-90 whitespace-nowrap print:text-[8px]">
                              {specialHoliday}
                          </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-30 bg-white border border-gray-300 p-1 w-[40px] min-w-[40px] text-center text-xs font-bold text-gray-700 print:border-black print:static print:bg-transparent print:min-w-[40px]">
                統計
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp, idx) => {
               const effectiveTarget = (emp.customTarget ?? baseTarget) - emp.targetDeduction;
               const diff = emp.generatedShiftCount - effectiveTarget;
               
               return (
                <React.Fragment key={emp.id}>
                    <tr className="hover:bg-gray-50 transition-colors h-8 print:h-6 print:break-inside-avoid border-t-2 border-gray-300 print:border-black">
                        <td 
                            rowSpan={3} 
                            className={`sticky left-0 z-10 ${emp.isLocked ? 'bg-gray-200' : 'bg-white'} border-r border-b border-gray-300 px-0 py-1 font-bold text-gray-800 text-center text-lg shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:border-black print:static print:text-xs align-middle [writing-mode:vertical-rl] tracking-widest cursor-pointer hover:bg-gray-100`}
                            onClick={() => onToggleLock(idx)}
                            title={emp.isLocked ? "點擊解除鎖定" : "點擊鎖定班表"}
                        >
                            <div className="flex items-center justify-center h-full">
                                {emp.name}
                                {emp.isLocked && <Lock className="w-3 h-3 text-gray-500 mt-1" />}
                            </div>
                        </td>
                        
                        <td className="sticky left-[36px] z-10 bg-gray-50/50 border-r border-b border-gray-300 text-center text-[10px] text-gray-500 font-medium align-middle print:border-black print:static print:text-xs">
                            早
                        </td>

                        {daysArray.map(day => {
                            const dateKey = `${year}-${month}-${day}`;
                            const cellData = emp.shifts[dateKey];
                            const { isSunday, isSaturday } = getDayInfo(day);
                            const isSymbol = !Array.isArray(cellData) && cellData;
                            const shifts = Array.isArray(cellData) ? cellData : [];
                            
                            if (isSymbol) {
                                return (
                                    <td 
                                        key={day} 
                                        rowSpan={3}
                                        onClick={() => handleCellClick(idx, day)}
                                        className={`border border-b border-gray-300 p-0 text-center align-middle cursor-pointer hover:bg-indigo-50 relative print:border-black 
                                            ${selectedSymbol ? 'cursor-cell' : ''}
                                            ${isSunday ? 'cursor-not-allowed opacity-50 bg-red-50/30' : isSaturday ? 'bg-green-50' : ''}
                                        `}
                                    >
                                        <SymbolBadge symbol={cellData as ShiftSymbol} />
                                    </td>
                                );
                            }

                            return (
                                <td 
                                    key={day} 
                                    onClick={() => handleCellClick(idx, day, 'A')}
                                    className={`border border-gray-200 border-r-gray-300 p-0 text-center align-middle cursor-pointer hover:bg-indigo-50 relative print:border-black 
                                        ${isSunday ? 'bg-red-50/30 cursor-not-allowed' : isSaturday ? 'bg-green-50' : ''}
                                        ${selectedSymbol && !isSunday ? 'cursor-cell' : ''}
                                    `}
                                >
                                    <div className="flex items-center justify-center h-full w-full">
                                        {shifts.includes('A') && <ShiftBadge type="A" />}
                                        {shifts.includes('Xa') && <ShiftBadge type="Xa" />}
                                    </div>
                                </td>
                            );
                        })}

                        <td rowSpan={3} className="sticky right-0 z-10 bg-white border-l border-b border-gray-300 px-0.5 text-center shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:border-black print:static align-middle">
                            <div className="flex flex-col items-center justify-center text-xs leading-tight print:text-xs">
                                <span className="font-bold text-indigo-600 text-sm print:text-black print:text-sm">{emp.generatedShiftCount}</span>
                                <span className="text-gray-400 text-[10px] print:text-gray-600">/ {effectiveTarget}</span>
                                {Math.abs(diff) > 2 && (
                                    <span className={`font-bold text-[10px] ${diff > 0 ? 'text-green-500' : 'text-red-500'} print:hidden`}>
                                        {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                )}
                            </div>
                        </td>
                    </tr>

                    <tr className="hover:bg-gray-50 transition-colors h-8 print:h-6 print:break-inside-avoid">
                        <td className="sticky left-[36px] z-10 bg-gray-50/50 border-r border-b border-gray-300 text-center text-[10px] text-gray-500 font-medium align-middle print:border-black print:static print:text-xs">
                            中
                        </td>
                         {daysArray.map(day => {
                            const dateKey = `${year}-${month}-${day}`;
                            const cellData = emp.shifts[dateKey];
                            const { isSunday, isSaturday } = getDayInfo(day);
                            const isSymbol = !Array.isArray(cellData) && cellData;
                            const shifts = Array.isArray(cellData) ? cellData : [];

                            if (isSymbol) return null;

                            return (
                                <td 
                                    key={day} 
                                    onClick={() => handleCellClick(idx, day, 'B')}
                                    className={`border border-gray-200 border-r-gray-300 p-0 text-center align-middle cursor-pointer hover:bg-indigo-50 relative print:border-black 
                                        ${isSunday ? 'bg-red-50/30 cursor-not-allowed' : isSaturday ? 'bg-green-50' : ''}
                                        ${selectedSymbol && !isSunday ? 'cursor-cell' : ''}
                                    `}
                                >
                                    <div className="flex items-center justify-center h-full w-full">
                                        {shifts.includes('B') && <ShiftBadge type="B" />}
                                        {shifts.includes('Xb') && <ShiftBadge type="Xb" />}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>

                    <tr className="hover:bg-gray-50 transition-colors h-8 print:h-6 print:break-inside-avoid">
                        <td className="sticky left-[36px] z-10 bg-gray-50/50 border-r border-b border-gray-300 text-center text-[10px] text-gray-500 font-medium align-middle print:border-black print:static print:text-xs">
                            晚
                        </td>
                        {daysArray.map(day => {
                            const dateKey = `${year}-${month}-${day}`;
                            const cellData = emp.shifts[dateKey];
                            const { isSunday, isSaturday } = getDayInfo(day);
                            const isSymbol = !Array.isArray(cellData) && cellData;
                            const shifts = Array.isArray(cellData) ? cellData : [];

                            if (isSymbol) return null;

                            return (
                                <td 
                                    key={day} 
                                    onClick={() => handleCellClick(idx, day, 'C')}
                                    className={`border border-b border-gray-300 p-0 text-center align-middle cursor-pointer hover:bg-indigo-50 relative print:border-black 
                                        ${isSunday ? 'bg-red-50/30 cursor-not-allowed' : isSaturday ? 'bg-green-50' : ''}
                                        ${selectedSymbol && !isSunday ? 'cursor-cell' : ''}
                                    `}
                                >
                                    <div className="flex items-center justify-center h-full w-full">
                                        {shifts.includes('C') && <ShiftBadge type="C" />}
                                        {shifts.includes('Xc') && <ShiftBadge type="Xc" />}
                                    </div>
                                </td>
                            );
                        })}
                    </tr>
                </React.Fragment>
               );
            })}
          </tbody>
          
          <tfoot className="bg-gray-50 sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] print:table-footer-group print:shadow-none print:static transition-all duration-300">
            <tr>
              <td colSpan={2} className="sticky left-0 z-30 bg-gray-100 border border-gray-300 p-0 font-bold text-gray-600 text-center text-xs print:border-black print:static print:bg-transparent">
                <button 
                  onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                  className="w-full h-full flex items-center justify-center gap-1 py-2 hover:bg-gray-200 transition-colors focus:outline-none"
                  title={isStatsExpanded ? "摺疊統計" : "展開統計"}
                >
                  <span className="[writing-mode:vertical-rl] text-[10px]">統計</span>
                  {isStatsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>
              </td>
              {daysArray.map(day => {
                  const date = new Date(year, month, day);
                  const dateKey = `${year}-${month}-${day}`;
                  const { isSunday } = getDayInfo(day);
                  const req = getDailyRequirements(date, config, activeScenario, usedTuesdayReduction);
                  
                  let countA = 0, countB = 0, countC = 0;
                  employees.forEach(e => {
                      const cell = e.shifts[dateKey];
                      if (Array.isArray(cell)) {
                          if (cell.includes('A')) countA++;
                          if (cell.includes('B')) countB++;
                          if (cell.includes('C')) countC++;
                      }
                  });

                  if (isSunday) return <td key={day} className="border border-gray-300 bg-red-50/50 print:border-black"></td>;

                  const badA = countA !== req.A;
                  const badB = countB !== req.B;
                  const badC = countC !== req.C;
                  const isReduced = usedTuesdayReduction && date.getDay() === 2;

                  if (!isStatsExpanded) {
                      const hasError = badA || badB || badC;
                      return (
                          <td key={day} className={`border border-gray-300 p-0.5 h-6 print:border-black ${hasError ? 'bg-red-50' : ''}`}>
                              {hasError && <div className="w-2 h-2 rounded-full bg-red-500 mx-auto"></div>}
                          </td>
                      );
                  }

                  return (
                      <td key={day} className="border border-gray-300 p-0.5 align-top print:border-black">
                          <div className="flex flex-col items-center text-[10px] leading-tight py-1 print:text-[8px]">
                              {req.A > 0 && (
                                  <div className={badA ? 'text-red-600 font-bold' : 'text-gray-500 print:text-black'}>
                                      A:{countA}
                                  </div>
                              )}
                              {req.B > 0 && (
                                  <div className={badB ? 'text-red-600 font-bold' : isReduced ? 'text-green-600 font-bold' : 'text-gray-500 print:text-black'}>
                                      B:{countB}
                                  </div>
                              )}
                              {req.C > 0 && (
                                  <div className={badC ? 'text-red-600 font-bold' : isReduced ? 'text-green-600 font-bold' : 'text-gray-500 print:text-black'}>
                                      C:{countC}
                                  </div>
                              )}
                          </div>
                      </td>
                  );
              })}
              <td className="sticky right-0 z-30 bg-gray-100 border border-gray-300 print:border-black print:static"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default RosterTable;
