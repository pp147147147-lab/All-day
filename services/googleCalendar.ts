
export const GOOGLE_CALENDAR_ID = '0d473a3daff6e28d93967fe92749dcbd4765680d74f65485643b4b62ca401a52@group.calendar.google.com';

export const LEAVE_NAMES = [
  '筳崴',
  '顏甄',
  '俊男',
  '孟璇',
  '雁琳',
  '廣毅',
  '宜菁',
  '天成',
  '詩涵'
];

/**
 * 從 Google Apps Script 代理獲取請假資料
 * @param proxyUrl Apps Script 部署的網址
 * @param year 年份
 * @param month 月份 (0-11)
 */
export const fetchGoogleCalendarLeaveFromAppsScript = async (
  proxyUrl: string,
  year: number,
  month: number
): Promise<Record<string, string[]>> => {
  // Apps Script 通常使用 1-12 月，所以 month + 1
  const url = `${proxyUrl}?action=getLeave&year=${year}&month=${month + 1}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Apps Script 代理無法存取：${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Apps Script 代理回傳格式錯誤。');
  }

  if ((data as any).status === 'error') {
    throw new Error((data as any).message || 'Apps Script 代理回傳錯誤。');
  }

  // 回傳格式預期為 { "2024-3-15": ["姓名1", "姓名2"], ... }
  return data as Record<string, string[]>;
};
