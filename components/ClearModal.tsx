import React from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';

interface ClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'generated' | 'all') => void;
  monthLabel: string;
}

const ClearModal: React.FC<ClearModalProps> = ({ isOpen, onClose, onConfirm, monthLabel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            清除班表資料
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            您正在對 <span className="font-bold text-indigo-600">{monthLabel}</span> 的資料進行操作。請選擇清除方式：
          </p>

          <button
            onClick={() => onConfirm('generated')}
            className="w-full group relative flex items-start gap-4 p-4 rounded-lg border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="p-2 bg-indigo-100 rounded-full text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 group-hover:text-indigo-700">僅清除自動排班</h4>
              <p className="text-xs text-gray-500 mt-1">保留所有的特殊符號（特/婚/產/X...），僅移除 A/B/C 班次。適合重新計算排班。</p>
            </div>
          </button>

          <button
            onClick={() => onConfirm('all')}
            className="w-full group relative flex items-start gap-4 p-4 rounded-lg border-2 border-red-100 hover:border-red-500 hover:bg-red-50 transition-all text-left"
          >
            <div className="p-2 bg-red-100 rounded-full text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 group-hover:text-red-700">全部清除 (重置)</h4>
              <p className="text-xs text-gray-500 mt-1">清空該月所有資料，包含手動輸入的符號。將恢復為一張白紙。</p>
            </div>
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearModal;