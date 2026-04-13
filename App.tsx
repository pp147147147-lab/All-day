
import React, { useState, useEffect } from 'react';
import Controls from './components/Controls';
import RosterTable from './components/RosterTable';
import ClearModal from './components/ClearModal';
import { SchedulingConfig, Employee, ThursdayScenario, Tool, ShiftType, ShiftSymbol } from './types';
import { generateSchedule, calculateBaseTarget, validateSchedule, recalculateEmployeeStats, calculateOverviewStats, determineActiveScenario } from './services/scheduleGenerator';

const STORAGE_KEY = 'shiftflow_data_v1';
// 👇 新增這行：將引號裡面的內容，替換成您剛剛複製的長網址 👇
const GOOGLE_API_URL = 'https://script.google.com/macros/s/AKfycbyFJYH28ayS01LZrRFfhUt_O3oI5YFB8jZG--8kGYuHQEmQWTjciQBdDOzUUBAB3fX4/exec'; 

const App: React.FC = () => {
  const today = new Date();
  
  // -- State --
  // Initialize with 8 employees by default as requested
  const [employees, setEmployees] = useState<Employee[]>(
    Array.from({ length: 8 }).map((_, idx) => ({
      id: (idx + 1).toString(),
      name: `員工 ${idx + 1}`,
      shifts: {},
      manualEntries: {},
      generatedShiftCount: 0,
      targetDeduction: 0
    }))
  );

  const [config, setConfig] = useState<SchedulingConfig>({
    year: today.getFullYear(),
    month: today.getMonth(),
    staffIds: Array.from({ length: 8 }).map((_, idx) => (idx + 1).toString()),
    
    reqStandardA: 5,
    reqStandardB: 5,
    reqStandardC: 5,
    reqSaturdayA: 5,
    thursdayMode: 'Auto',
    yearHolidayStart: '', 
    yearHolidayEnd: '',
    jan1WorkDay: false,
    autoBalanceOffToSpecial: false,
    enableMinDaysOff: false,
    minDaysOff: 10,
    historicalSaturdayCounts: {},
    customHolidays: {}
  });

  const [warnings, setWarnings] = useState<string[]>([]);
  const [baseTarget, setBaseTarget] = useState(0);
  const [stats, setStats] = useState<{totalDemand: number, totalCapacity: number, suggestedSpecialLeaves: number} | undefined>(undefined);
  const [activeThursdayScenario, setActiveThursdayScenario] = useState<ThursdayScenario>(ThursdayScenario.A);
  const [usedTuesdayReduction, setUsedTuesdayReduction] = useState<boolean>(false);
  
  const [selectedSymbol, setSelectedSymbol] = useState<Tool>(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  // -- Persistence --
  useEffect(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (parsed.config) {
                 const loadedConfig = parsed.config;
                 // Migration checks
                 if (loadedConfig.yearHolidayCount !== undefined) delete loadedConfig.yearHolidayCount;
                 if (loadedConfig.jan1WorkDay === undefined) loadedConfig.jan1WorkDay = false;
                 if (loadedConfig.autoBalanceOffToSpecial === undefined) loadedConfig.autoBalanceOffToSpecial = false;
                 if (loadedConfig.enableMinDaysOff === undefined) loadedConfig.enableMinDaysOff = false;
                 if (loadedConfig.minDaysOff === undefined) loadedConfig.minDaysOff = 10;
                 if (loadedConfig.customHolidays === undefined) loadedConfig.customHolidays = {};
                 setConfig(loadedConfig);
              }
              if (parsed.employees) {
                  const loadedEmployees = parsed.employees.map((e: any) => ({
                      ...e,
                      manualEntries: e.manualEntries || {}
                  }));
                  setEmployees(loadedEmployees);
              }
              if (parsed.stats) setStats(parsed.stats);
              // Ensure type safety for enum from JSON
              if (parsed.activeThursdayScenario) setActiveThursdayScenario(parsed.activeThursdayScenario as ThursdayScenario);
              if (parsed.usedTuesdayReduction !== undefined) setUsedTuesdayReduction(parsed.usedTuesdayReduction);
          } catch (e) {
              console.error("Failed to load saved data", e);
          }
      }
  }, []);

  useEffect(() => {
      const data = { config, employees, stats, activeThursdayScenario, usedTuesdayReduction };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [config, employees, stats, activeThursdayScenario, usedTuesdayReduction]);


  // -- Effects --
  useEffect(() => {
     setBaseTarget(calculateBaseTarget(config.year, config.month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, config.customHolidays));

     const updatedEmployees = employees.map(emp => recalculateEmployeeStats(emp, config.year, config.month));
     setEmployees(updatedEmployees);

     const newStats = calculateOverviewStats(config, updatedEmployees, activeThursdayScenario, usedTuesdayReduction);
     setStats(newStats);

  }, [config.year, config.month, config.yearHolidayStart, config.yearHolidayEnd, config.jan1WorkDay, config.customHolidays, config.reqStandardA, config.reqStandardB, config.reqStandardC, config.reqSaturdayA]);

  useEffect(() => {
    const newWarnings = validateSchedule(employees, config, activeThursdayScenario, usedTuesdayReduction);
    setWarnings(newWarnings);
  }, [employees, config, activeThursdayScenario, usedTuesdayReduction]);

  // -- Handlers --

  const handleGenerate = () => {
    const result = generateSchedule(config, employees);
    
    setEmployees(result.employees);
    setWarnings(result.warnings);
    setStats(result.stats);
    setActiveThursdayScenario(result.usedThursdayScenario);
    setUsedTuesdayReduction(result.usedTuesdayReduction);
    setGridKey(prev => prev + 1);
  };

  const handleRefreshStats = () => {
      const { selectedScenario, useTuesdayReduction } = determineActiveScenario(config, employees);
      const newStats = calculateOverviewStats(config, employees, selectedScenario, useTuesdayReduction);
      setStats(newStats);
      setActiveThursdayScenario(selectedScenario);
      setUsedTuesdayReduction(useTuesdayReduction);
  };

  const handleClear = (mode: 'generated' | 'all') => {
      const prefix = `${config.year}-${config.month}-`;
      
      const newEmployees = employees.map(emp => {
          if (emp.isLocked) return emp; // Skip locked employees

          const newShifts = { ...emp.shifts };
          const newManualEntries = { ...(emp.manualEntries || {}) };
          
          Object.keys(newShifts).forEach(key => {
              if (!key.startsWith(prefix)) return;
              
              const cellValue = newShifts[key];
              const isManual = newManualEntries[key];
              
              if (mode === 'all') {
                  delete newShifts[key];
                  delete newManualEntries[key];
              } else if (mode === 'generated') {
                  if (!isManual) {
                      delete newShifts[key];
                  } else if (Array.isArray(cellValue)) {
                      if (Array.isArray(isManual)) {
                          newShifts[key] = [...isManual];
                      } else {
                          // Fallback for old data where isManual is just `true`
                          const hasX = cellValue.some(s => ['Xa', 'Xb', 'Xc'].includes(s));
                          if (hasX) {
                              newShifts[key] = cellValue.filter(s => ['Xa', 'Xb', 'Xc'].includes(s));
                          }
                      }
                  }
              }
          });
          
          return recalculateEmployeeStats({
              ...emp,
              shifts: newShifts,
              manualEntries: newManualEntries
          }, config.year, config.month);
      });
      
      setEmployees(newEmployees);
      setIsClearModalOpen(false);
      setGridKey(prev => prev + 1);
      
      if (mode === 'all') {
          const emptyStats = calculateOverviewStats(config, newEmployees, ThursdayScenario.A, false);
          setStats(emptyStats);
          setActiveThursdayScenario(ThursdayScenario.A);
          setUsedTuesdayReduction(false);
      }
  };

  const handleToggleLock = (empIndex: number) => {
      const newEmployees = [...employees];
      newEmployees[empIndex] = {
          ...newEmployees[empIndex],
          isLocked: !newEmployees[empIndex].isLocked
      };
      setEmployees(newEmployees);
  };

  const handleCellClick = (empIndex: number, day: number, shiftClicked?: ShiftType) => {
      const newEmployees = [...employees];
      const emp = newEmployees[empIndex];
      
      if (emp.isLocked) return; // Prevent modification if locked

      const dateKey = `${config.year}-${config.month}-${day}`;
      const newShifts = { ...emp.shifts };
      const newManualEntries = { ...(emp.manualEntries || {}) };
      
      const currentVal = newShifts[dateKey];

      if (selectedSymbol === 'eraser') {
          if (Array.isArray(currentVal) && shiftClicked) {
              const newVal = currentVal.filter(s => {
                  if (shiftClicked === 'A') return s !== 'A' && s !== 'Xa';
                  if (shiftClicked === 'B') return s !== 'B' && s !== 'Xb';
                  if (shiftClicked === 'C') return s !== 'C' && s !== 'Xc';
                  return s !== shiftClicked;
              });
              
              let manualArr: ShiftType[] = [];
              if (Array.isArray(newManualEntries[dateKey])) {
                  manualArr = [...newManualEntries[dateKey]];
              } else if (newManualEntries[dateKey] === true) {
                  if (Array.isArray(currentVal)) manualArr = [...currentVal];
              }
              
              const newManual = manualArr.filter(s => {
                  if (shiftClicked === 'A') return s !== 'A' && s !== 'Xa';
                  if (shiftClicked === 'B') return s !== 'B' && s !== 'Xb';
                  if (shiftClicked === 'C') return s !== 'C' && s !== 'Xc';
                  return s !== shiftClicked;
              });
              
              if (newVal.length === 0) {
                  delete newShifts[dateKey];
                  delete newManualEntries[dateKey];
              } else {
                  newShifts[dateKey] = newVal;
                  if (newManual.length === 0) {
                      delete newManualEntries[dateKey];
                  } else {
                      newManualEntries[dateKey] = newManual;
                  }
              }
          } else {
              delete newShifts[dateKey];
              delete newManualEntries[dateKey];
          }
      } 
      else if (selectedSymbol && !['A', 'B', 'C', 'X'].includes(selectedSymbol)) {
          newShifts[dateKey] = selectedSymbol as ShiftSymbol;
          newManualEntries[dateKey] = true;
      }
      else {
          let targetShift: string | undefined = selectedSymbol ? selectedSymbol : shiftClicked;

          if (targetShift === 'X') {
              if (shiftClicked === 'A') targetShift = 'Xa';
              else if (shiftClicked === 'B') targetShift = 'Xb';
              else if (shiftClicked === 'C') targetShift = 'Xc';
          }
          
          const validShifts: string[] = ['A', 'B', 'C', 'Xa', 'Xb', 'Xc'];

          if (targetShift && validShifts.includes(targetShift)) {
              const finalShift = targetShift as ShiftType;
              let currentArr: ShiftType[] = [];
              if (Array.isArray(currentVal)) {
                  currentArr = [...currentVal];
              }
              
              let manualArr: ShiftType[] = [];
              if (Array.isArray(newManualEntries[dateKey])) {
                  manualArr = [...newManualEntries[dateKey]];
              } else if (newManualEntries[dateKey] === true) {
                  if (Array.isArray(currentVal)) manualArr = [...currentVal];
              }

              if (currentArr.includes(finalShift)) {
                  currentArr = currentArr.filter(s => s !== finalShift);
                  manualArr = manualArr.filter(s => s !== finalShift);
              } else {
                  currentArr.push(finalShift);
                  manualArr.push(finalShift);
                  
                  if (finalShift === 'Xa') { currentArr = currentArr.filter(s => s !== 'A'); manualArr = manualArr.filter(s => s !== 'A'); }
                  if (finalShift === 'A') { currentArr = currentArr.filter(s => s !== 'Xa'); manualArr = manualArr.filter(s => s !== 'Xa'); }
                  if (finalShift === 'Xb') { currentArr = currentArr.filter(s => s !== 'B'); manualArr = manualArr.filter(s => s !== 'B'); }
                  if (finalShift === 'B') { currentArr = currentArr.filter(s => s !== 'Xb'); manualArr = manualArr.filter(s => s !== 'Xb'); }
                  if (finalShift === 'Xc') { currentArr = currentArr.filter(s => s !== 'C'); manualArr = manualArr.filter(s => s !== 'C'); }
                  if (finalShift === 'C') { currentArr = currentArr.filter(s => s !== 'Xc'); manualArr = manualArr.filter(s => s !== 'Xc'); }

                  const sortOrder: Record<string, number> = { 'A':1, 'Xa':1, 'B':2, 'Xb':2, 'C':3, 'Xc':3 };
                  currentArr.sort((a, b) => (sortOrder[a] || 99) - (sortOrder[b] || 99));
                  manualArr.sort((a, b) => (sortOrder[a] || 99) - (sortOrder[b] || 99));
              }

              if (currentArr.length === 0) {
                  delete newShifts[dateKey];
                  delete newManualEntries[dateKey];
              } else {
                  newShifts[dateKey] = currentArr;
                  if (manualArr.length === 0) {
                      delete newManualEntries[dateKey];
                  } else {
                      newManualEntries[dateKey] = manualArr;
                  }
              }
          }
      }
      
      emp.shifts = newShifts;
      emp.manualEntries = newManualEntries;
      
      newEmployees[empIndex] = recalculateEmployeeStats(emp, config.year, config.month);
      setEmployees(newEmployees);

      const newStats = calculateOverviewStats(config, newEmployees, activeThursdayScenario, usedTuesdayReduction);
      setStats(newStats);
  };
// --- 👇 更新：雲端儲存功能 (包含年份、月份、目標節數) 👇 ---
  const handleSaveToCloud = async () => {
    try {
      alert('正在產生漂亮報表並上傳，這可能需要幾秒鐘...');
      
      // 我們把傳令兵畫表格需要的資訊全部包裝起來
      const dataToSave = {
        year: config.year,
        month: config.month,
        baseTarget: baseTarget,
        employees: employees
      };

      const response = await fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(dataToSave)
      });
      
      const result = await response.json();
      if(result.status === 'success') {
        alert('✅ 儲存成功！請去 Google 試算表查看您的精美排班表。');
      } else {
        alert('❌ 儲存失敗：' + result.message);
      }
    } catch(e) {
      alert('❌ 發生錯誤，請確認網路是否連線。');
    }
  };

  const handleLoadFromCloud = async () => {
    try {
      alert('正在尋找雲端資料，請稍候...');
      const currentMonthKey = `${config.year}_${config.month}`;
      const response = await fetch(`${GOOGLE_API_URL}?monthKey=${currentMonthKey}`);
      const result = await response.json();
      
      if(result.status === 'success') {
        setEmployees(JSON.parse(result.data));
        alert('✅ 成功讀取雲端班表！');
      } else {
        alert('⚠️ ' + result.message);
      }
    } catch(e) {
      alert('❌ 發生錯誤，請確認網址是否正確或網路是否連線。');
    }
  };

  const handleFetchLastMonthSaturdays = async () => {
    try {
      alert('正在尋找上個月的雲端資料，請稍候...');
      let lastYear = config.year;
      let lastMonth = config.month - 1;
      if (lastMonth < 0) {
        lastMonth = 11;
        lastYear -= 1;
      }
      const lastMonthKey = `${lastYear}_${lastMonth}`;
      const response = await fetch(`${GOOGLE_API_URL}?monthKey=${lastMonthKey}`);
      const result = await response.json();
      
      if(result.status === 'success') {
        const lastMonthEmployees: Employee[] = JSON.parse(result.data);
        
        // Calculate how many Saturdays each employee worked last month
        const satCounts: Record<string, number> = {};
        
        lastMonthEmployees.forEach(emp => {
          satCounts[emp.id] = 0;
          Object.entries(emp.shifts).forEach(([dateStr, shift]) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            if (y === lastYear && m === lastMonth) {
              const date = new Date(y, m, d);
              if (date.getDay() === 6) {
                // If they had any actual shift on Saturday
                if (Array.isArray(shift) && shift.some(s => ['A', 'B', 'C'].includes(s))) {
                  satCounts[emp.id] += 1;
                } else if (typeof shift === 'string' && ['A', 'B', 'C'].includes(shift)) {
                  satCounts[emp.id] += 1;
                }
              }
            }
          });
        });

        setConfig(prev => ({ ...prev, historicalSaturdayCounts: satCounts }));
        
        const details = Object.entries(satCounts).map(([id, count]) => {
            const emp = lastMonthEmployees.find(e => e.id === id);
            return `${emp?.name}: ${count}次`;
        }).join(', ');
        alert(`✅ 成功分析上個月班表！\n各員工上月週六班次：\n${details}\n系統將在排班時自動平衡所有人的週六次數。`);
      } else {
        alert('⚠️ 無法取得上個月資料：' + result.message);
      }
    } catch(e) {
      alert('❌ 發生錯誤，請確認網址是否正確或網路是否連線。');
    }
  };
  // --- 👆 新增結束 👆 ---

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans print:bg-white print:h-auto print:block print:overflow-visible">
      {/* 👇 新增：雲端同步按鈕列 👇 */}
      <div className="bg-white px-4 py-2 border-b border-gray-200 flex justify-end gap-3 print:hidden">
         <button onClick={handleFetchLastMonthSaturdays} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg font-bold text-sm hover:bg-purple-100 transition-colors shadow-sm border border-purple-200">
            🔍 抓取上月週六班表 (設定優先人員)
         </button>
         <button onClick={handleLoadFromCloud} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors shadow-sm border border-blue-200">
            📥 從雲端讀取本月班表
         </button>
         <button onClick={handleSaveToCloud} className="px-4 py-2 bg-green-50 text-green-700 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors shadow-sm border border-green-200">
            📤 儲存本月班表至雲端
         </button>
      </div>
      {/* 👆 新增結束 👆 */}
      <Controls 
        config={config} 
        setConfig={setConfig} 
        employees={employees}
        setEmployees={setEmployees}
        onGenerate={handleGenerate}
        baseTarget={baseTarget}
        stats={stats}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
        onOpenClearModal={() => setIsClearModalOpen(true)}
        activeScenario={activeThursdayScenario}
        usedTuesdayReduction={usedTuesdayReduction}
        onRefreshStats={handleRefreshStats}
      />
      
      <ClearModal 
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleClear}
        monthLabel={`${config.year}年${config.month + 1}月`}
      />
      
      <RosterTable 
        key={gridKey}
        year={config.year}
        month={config.month}
        employees={employees}
        baseTarget={baseTarget}
        onCellClick={handleCellClick}
        onToggleLock={handleToggleLock}
        selectedSymbol={selectedSymbol}
        config={config}
        activeScenario={activeThursdayScenario}
        usedTuesdayReduction={usedTuesdayReduction}
      />
    </div>
  );
};

export default App;
