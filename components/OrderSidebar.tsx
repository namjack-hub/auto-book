import React, { useState } from 'react';
import { CartItem, GeminiAnalysis } from '../types';
import { Trash2, FileText, Download, Sparkles, X, Loader2 } from 'lucide-react';
import { analyzeAcquisitionList } from '../services/geminiService';

interface OrderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemove: (id: string) => void;
}

const OrderSidebar: React.FC<OrderSidebarProps> = ({ isOpen, onClose, cart, onRemove }) => {
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = cart.reduce((sum, item) => sum + item.priceSales, 0);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeAcquisitionList(cart);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div 
        className={`
          fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">수서 목록</h2>
              <p className="text-sm text-gray-500">{cart.length}권 선택됨</p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-slate-800">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>선택된 도서가 없습니다.</p>
                <p className="text-sm">목록에서 도서를 추가해주세요.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {cart.map((item) => (
                  <li key={item.id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-slate-800/50">
                    <img src={item.cover} alt="" className="h-20 w-14 rounded object-cover shadow-sm" />
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h4 className="line-clamp-1 font-medium text-gray-900 dark:text-white">{item.title}</h4>
                        <p className="text-xs text-gray-500">{item.author}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent">{item.priceSales.toLocaleString()}원</span>
                        <button 
                          onClick={() => onRemove(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* AI Analysis Result Area */}
            {analysis && (
              <div className="mt-6 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                <div className="mb-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                  <Sparkles size={18} />
                  <h3 className="font-bold">AI 수서 분석 보고서</h3>
                </div>
                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    <span className="font-semibold block text-xs text-gray-500 mb-1">요약 및 선정 사유</span>
                    {analysis.summary}
                  </div>
                  <div>
                    <span className="font-semibold block text-xs text-gray-500 mb-1">예산 효율성</span>
                    {analysis.budgetAnalysis}
                  </div>
                  <div>
                    <span className="font-semibold block text-xs text-gray-500 mb-1">주제 분포</span>
                    {analysis.categoryBreakdown}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-indigo-200 dark:border-indigo-800">
                    <span className="font-semibold">추천 점수</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{analysis.recommendationScore}점</span>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-500">총 예상 금액</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || cart.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                AI 분석
              </button>
              <button
                disabled={cart.length === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white transition-all hover:bg-accent-dark disabled:opacity-50 shadow-lg shadow-accent/25"
                onClick={() => alert("엑셀 다운로드 기능은 실제 구현 시 xlsx 라이브러리를 사용합니다.")}
              >
                <Download size={18} />
                주문서 생성
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderSidebar;