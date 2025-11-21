import React, { useState, useEffect } from 'react';
import { ApiKeys } from '../types';
import { Key, X, CheckCircle2, AlertCircle, Loader2, Save, Building2 } from 'lucide-react';
import { validateTtbKey, validateNlkKey } from '../services/bookService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
  initialKeys: ApiKeys;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, initialKeys }) => {
  const [keys, setKeys] = useState<ApiKeys>(initialKeys);
  
  // Validation States
  const [validatingAladin, setValidatingAladin] = useState(false);
  const [aladinStatus, setAladinStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const [validatingNlk, setValidatingNlk] = useState(false);
  const [nlkStatus, setNlkStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys(initialKeys);
      setAladinStatus('idle');
      setNlkStatus('idle');
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-save effect
  useEffect(() => {
    if (
      keys.aladinTtb === initialKeys.aladinTtb && 
      keys.nlkApiKey === initialKeys.nlkApiKey
    ) return;

    const timer = setTimeout(() => {
      setIsSaving(true);
      onSave(keys);
      setTimeout(() => setIsSaving(false), 1000);
    }, 800);

    return () => clearTimeout(timer);
  }, [keys, onSave, initialKeys]);

  if (!isOpen) return null;

  const handleValidateAladin = async () => {
    if (!keys.aladinTtb) return;
    setValidatingAladin(true);
    setAladinStatus('idle');
    try {
      const isValid = await validateTtbKey(keys.aladinTtb);
      setAladinStatus(isValid ? 'success' : 'error');
    } catch {
      setAladinStatus('error');
    } finally {
      setValidatingAladin(false);
    }
  };

  const handleValidateNlk = async () => {
    if (!keys.nlkApiKey) return;
    setValidatingNlk(true);
    setNlkStatus('idle');
    try {
      const isValid = await validateNlkKey(keys.nlkApiKey);
      setNlkStatus(isValid ? 'success' : 'error');
    } catch {
      setNlkStatus('error');
    } finally {
      setValidatingNlk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="glass-panel relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl animate-fade-in-up">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Key className="h-5 w-5 text-accent" />
              API 키 설정
            </h2>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-300">
             서비스 이용을 위한 API 키를 입력해주세요.
          </p>
        </div>

        <div className="p-6 space-y-6 bg-white dark:bg-slate-800 max-h-[70vh] overflow-y-auto">
          
          {/* Aladin Section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                알라딘 TTB Key
              </label>
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-accent animate-pulse">
                  <Save size={12} /> 저장 중...
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={keys.aladinTtb}
                onChange={(e) => {
                  setKeys({ ...keys, aladinTtb: e.target.value });
                  setAladinStatus('idle');
                }}
                placeholder="알라딘 TTB키 입력"
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-gray-600 dark:bg-slate-700 dark:text-white transition-all"
              />
              <button
                type="button"
                onClick={handleValidateAladin}
                disabled={!keys.aladinTtb || validatingAladin}
                className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
              >
                {validatingAladin ? <Loader2 className="animate-spin" size={18} /> : "검증"}
              </button>
            </div>
            
            {aladinStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={12} /> 유효한 키입니다.
              </p>
            )}
            {aladinStatus === 'error' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={12} /> 유효하지 않은 키입니다.
              </p>
            )}
            <a href="https://www.aladin.co.kr/ttb/wmain.aspx" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline ml-1 mt-1 block">
               알라딘 TTB 키 발급받기 &rarr;
            </a>
          </div>

          {/* NLK Section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                국립중앙도서관 인증키
              </label>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={keys.nlkApiKey || ''}
                onChange={(e) => {
                  setKeys({ ...keys, nlkApiKey: e.target.value });
                  setNlkStatus('idle');
                }}
                placeholder="국립중앙도서관 API 키 입력"
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-gray-600 dark:bg-slate-700 dark:text-white transition-all"
              />
              <button
                type="button"
                onClick={handleValidateNlk}
                disabled={!keys.nlkApiKey || validatingNlk}
                className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
              >
                {validatingNlk ? <Loader2 className="animate-spin" size={18} /> : "검증"}
              </button>
            </div>
            
            {nlkStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={12} /> 유효한 키입니다.
              </p>
            )}
            {nlkStatus === 'error' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={12} /> 유효하지 않은 키입니다.
              </p>
            )}
            <a href="https://www.data4library.kr/apiMain" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline ml-1 mt-1 block">
               정보나루(국립중앙도서관) 인증키 발급받기 &rarr;
            </a>
          </div>

          <div className="mt-6 flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;