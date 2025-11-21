
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Book, ApiKeys, FetchSource, GeminiAnalysis, SearchTarget } from './types';
import { fetchBooks, searchBooks } from './services/bookService';
import { analyzeAcquisitionList } from './services/geminiService';
import BookCard from './components/BookCard';
import ApiKeyModal from './components/ApiKeyModal';
import { Settings, Search, BookOpen, Star, TrendingUp, ArrowRight, Sparkles, Download, Loader2, AlertCircle, Key, Library, BookCopy, Zap, Award } from 'lucide-react';

function App() {
  // Kanban Columns
  const [discoveryBooks, setDiscoveryBooks] = useState<Book[]>([]);
  const [reviewBooks, setReviewBooks] = useState<Book[]>([]);
  const [confirmedBooks, setConfirmedBooks] = useState<Book[]>([]);
  
  // Refs to track excluded IDs without triggering re-renders or effect dependencies
  const excludedIdsRef = useRef<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<FetchSource>('combined');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('Keyword');
  const [isSearching, setIsSearching] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // AI Analysis State
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('smart_acquisition_keys');
    return saved ? JSON.parse(saved) : { aladinTtb: '', nlkApiKey: '' };
  });

  // Update excluded IDs ref whenever lists change
  useEffect(() => {
    excludedIdsRef.current = new Set([...reviewBooks, ...confirmedBooks].map(b => b.id));
  }, [reviewBooks, confirmedBooks]);

  // Data Fetching
  const loadDiscoveryBooks = useCallback(async (source: FetchSource, currentPage: number) => {
    // Pre-checks for keys
    if (source === 'editorRecommend' && !apiKeys.nlkApiKey) {
       setDiscoveryBooks([]);
       return;
    }
    if ((source === 'combined' || source === 'bestseller' || source === 'itemNewSpecial') && !apiKeys.aladinTtb) {
      setDiscoveryBooks([]);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    
    try {
      const data = await fetchBooks(source, apiKeys.aladinTtb, apiKeys.nlkApiKey, currentPage);
      
      // Filter using the ref to avoid effect dependency on review/confirmed lists
      const currentExcluded = excludedIdsRef.current;
      const freshData = data.filter(b => !currentExcluded.has(b.id));
      
      setDiscoveryBooks(freshData);
    } catch (error) {
      console.error("Failed to fetch books", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setFetchError(`도서 정보를 불러오는데 실패했습니다. (${msg})`);
      setDiscoveryBooks([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKeys.aladinTtb, apiKeys.nlkApiKey]);

  // Effect to load books when source changes (reset page) or keys update
  useEffect(() => {
    if (!searchQuery) {
       loadDiscoveryBooks(activeSource, page);
    }
  }, [activeSource, loadDiscoveryBooks, page]); // Remove searchQuery from dependency to prevent loop

  // Handler for source change - resets page
  const handleSourceChange = (source: FetchSource) => {
    if (source === 'editorRecommend' && !apiKeys.nlkApiKey) {
      setIsKeyModalOpen(true);
    }
    setActiveSource(source);
    setPage(1); // Reset to first page on source change
    setSearchQuery('');
  };

  const handleSearch = async (e?: React.FormEvent, targetPage: number = 1) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !apiKeys.aladinTtb) return;

    setIsSearching(true);
    setIsLoading(true);
    setFetchError(null);
    
    // Reset page if this is a new search submit (not a pagination call)
    if (targetPage === 1) setPage(1);

    try {
      const data = await searchBooks(searchQuery, apiKeys.aladinTtb, searchTarget, targetPage);
      const currentExcluded = excludedIdsRef.current;
      const freshData = data.filter(b => !currentExcluded.has(b.id));
      
      if (data.length === 0) {
         setFetchError("최근 1년 이내의 검색 결과가 없습니다.");
      }
      
      setDiscoveryBooks(freshData);
    } catch (error) {
      console.error("Search failed", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setFetchError(`검색에 실패했습니다. (${msg})`);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleRefresh = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    
    if (searchQuery && activeSource !== 'editorRecommend') {
      handleSearch(undefined, nextPage);
    }
    // Note: useEffect will handle the fetch for category sources when `page` updates
  };

  const handleSaveKeys = (keys: ApiKeys) => {
    setApiKeys(keys);
    localStorage.setItem('smart_acquisition_keys', JSON.stringify(keys));
    // Force reload by resetting page or source triggering effect
    setPage(1);
  };

  // Kanban Actions
  const moveBook = (book: Book, action: 'add' | 'approve' | 'remove' | 'return') => {
    if (action === 'add') {
      setDiscoveryBooks(prev => prev.filter(b => b.id !== book.id));
      setReviewBooks(prev => [{ ...book, status: 'review' }, ...prev]);
    } else if (action === 'approve') {
      setReviewBooks(prev => prev.filter(b => b.id !== book.id));
      setConfirmedBooks(prev => [{ ...book, status: 'confirmed' }, ...prev]);
      setAnalysis(null);
    } else if (action === 'return') {
      if (book.status === 'confirmed') {
        setConfirmedBooks(prev => prev.filter(b => b.id !== book.id));
        setReviewBooks(prev => [{ ...book, status: 'review' }, ...prev]);
        setAnalysis(null);
      } else if (book.status === 'review') {
         setReviewBooks(prev => prev.filter(b => b.id !== book.id));
      }
    }
  };

  const handleAnalyze = async () => {
    if (confirmedBooks.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeAcquisitionList(confirmedBooks);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
      alert("AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadOrder = () => {
    if (confirmedBooks.length === 0) return;

    // Create CSV content with BOM for Korean character support in Excel
    const bom = '\uFEFF';
    const headers = ['제목', '저자', '출판사', '출판일', '정가', '판매가', 'ISBN', '카테고리'];
    const rows = confirmedBooks.map(book => [
      `"${book.title.replace(/"/g, '""')}"`,
      `"${book.author.replace(/"/g, '""')}"`,
      `"${book.publisher.replace(/"/g, '""')}"`,
      `"${book.pubDate}"`,
      book.priceStandard,
      book.priceSales,
      `"${book.isbn13}"`,
      `"${book.categoryName || ''}"`
    ]);

    const csvContent = bom + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `도서수서목록_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAmount = confirmedBooks.reduce((sum, item) => sum + item.priceSales, 0);

  // Render Helpers
  const renderDiscoveryEmptyState = () => {
    if (activeSource === 'editorRecommend' && !apiKeys.nlkApiKey) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-center text-gray-400 p-4">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-slate-700">
             <Library size={32} className="text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">사서 추천 API 키 필요</h3>
          <p className="mb-6 text-sm">국립중앙도서관 API 키를 입력하여<br/>사서 추천 도서를 확인하세요.</p>
          <button onClick={() => setIsKeyModalOpen(true)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 shadow-lg">
             키 입력하기
          </button>
        </div>
      );
    }
    if (!apiKeys.aladinTtb) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-center text-gray-400 p-4">
           <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700">
              <Key size={32} className="text-gray-300" />
           </div>
           <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">알라딘 API 키 필요</h3>
           <p className="mb-6 text-sm">알라딘 TTB 키를 입력하여<br/>도서 검색 및 추천 기능을 사용하세요.</p>
           <button onClick={() => setIsKeyModalOpen(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-dark shadow-lg shadow-accent/20">
              키 입력하기
           </button>
        </div>
      );
    }
    if (fetchError) {
      return (
        <div className="flex h-full flex-col items-center justify-center text-center text-gray-400 p-4">
          <AlertCircle size={32} className="mb-2 text-red-400" />
          <p className="text-sm text-red-500 break-keep">{fetchError}</p>
          <button onClick={() => loadDiscoveryBooks(activeSource, page)} className="mt-4 text-sm underline hover:text-gray-600">
            다시 시도
          </button>
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
         <Search size={32} className="mb-2 opacity-20" />
         <p>검색 결과가 없습니다.</p>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-gray-100 text-gray-900 dark:bg-slate-900 dark:text-gray-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="z-30 shrink-0 bg-white border-b border-gray-200 px-6 py-3 dark:bg-slate-900 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-lg shadow-accent/30">
              <TrendingUp size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Smart<span className="text-accent">Acquisition</span> Board
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-slate-800 overflow-x-auto max-w-[600px] scrollbar-hide">
               <button 
                onClick={() => handleSourceChange('combined')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${activeSource === 'combined' ? 'bg-white shadow text-accent font-bold' : 'text-gray-500'}`}
               >
                 <BookCopy size={14} /> 종합 (100)
               </button>
               <button 
                onClick={() => handleSourceChange('bestseller')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${activeSource === 'bestseller' ? 'bg-white shadow text-purple-600 font-bold' : 'text-gray-500'}`}
               >
                 <Award size={14} /> 베스트셀러
               </button>
               <button 
                onClick={() => handleSourceChange('itemNewSpecial')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${activeSource === 'itemNewSpecial' ? 'bg-white shadow text-amber-600 font-bold' : 'text-gray-500'}`}
               >
                 <Zap size={14} /> 주목할 신간
               </button>
               <button 
                onClick={() => handleSourceChange('editorRecommend')} 
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${activeSource === 'editorRecommend' ? 'bg-white shadow text-green-600 font-bold' : 'text-gray-500'}`}
               >
                 <Library size={14} /> 사서 추천
               </button>
            </div>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${(!apiKeys.aladinTtb && activeSource !== 'editorRecommend') || (!apiKeys.nlkApiKey && activeSource === 'editorRecommend') ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-100 text-gray-600 dark:text-gray-300'}`}
            >
              <Settings size={18} />
              설정
            </button>
          </div>
        </div>
      </header>

      {/* Kanban Board Area */}
      <main className="flex flex-1 overflow-x-auto overflow-y-hidden p-6 gap-6 scrollbar-hide">
        
        {/* Column 1: Discovery */}
        <div className="flex h-full w-full min-w-[350px] max-w-[400px] flex-col rounded-2xl bg-gray-50 border border-gray-200 dark:bg-slate-800/50 dark:border-gray-700">
          <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-white rounded-t-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded text-white ${activeSource === 'editorRecommend' ? 'bg-green-500' : activeSource === 'bestseller' ? 'bg-purple-500' : activeSource === 'itemNewSpecial' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                  {activeSource === 'editorRecommend' ? <Library size={14} /> : activeSource === 'bestseller' ? <Award size={14} /> : activeSource === 'itemNewSpecial' ? <Zap size={14} /> : <Search size={14} />}
                </div>
                <h2 className="font-bold text-gray-800 dark:text-gray-200 line-clamp-1">
                  {searchQuery ? `"${searchQuery}" 검색 결과` : 
                    activeSource === 'editorRecommend' ? '국립중앙도서관 사서 추천' : 
                    activeSource === 'bestseller' ? '알라딘 베스트셀러' : 
                    activeSource === 'itemNewSpecial' ? '주목할 신간 (스테디)' : '도서 탐색'
                  }
                </h2>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium dark:bg-gray-700 shrink-0">{discoveryBooks.length}</span>
              </div>
              <button 
                onClick={handleRefresh} 
                className="text-gray-400 hover:text-accent transition-transform hover:rotate-180 active:scale-90"
                title="새로고침"
              >
                <RotateCcwIcon size={16} />
              </button>
            </div>

            {/* Search Input Area */}
            <div className="px-4 pb-4">
              <form onSubmit={(e) => handleSearch(e, 1)} className="flex gap-2">
                 <select
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value as SearchTarget)}
                  disabled={activeSource === 'editorRecommend'}
                  className="rounded-lg border border-gray-200 bg-gray-50 py-2 px-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 dark:border-gray-700 dark:bg-slate-700 dark:text-white"
                 >
                   <option value="Keyword">전체</option>
                   <option value="Title">제목</option>
                   <option value="Author">저자</option>
                   <option value="Publisher">출판사</option>
                 </select>
                 <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={activeSource === 'editorRecommend' ? "사서 추천 목록은 검색을 지원하지 않습니다" : "도서 검색 (1년 이내)"}
                      disabled={activeSource === 'editorRecommend'}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 dark:border-gray-700 dark:bg-slate-700 dark:text-white"
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </form>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-400">
                <Loader2 className="animate-spin mb-2 text-accent" size={32} />
                <p>{isSearching ? "최근 도서를 검색하고 있습니다..." : "도서 정보를 불러오는 중..."}</p>
              </div>
            ) : (
              <div className="space-y-3 h-full">
                {discoveryBooks.length === 0 ? renderDiscoveryEmptyState() : (
                  discoveryBooks.map(book => (
                    <BookCard key={book.id} book={book} onAction={moveBook} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center text-gray-300">
          <ArrowRight size={24} />
        </div>

        {/* Column 2: Review */}
        <div className="flex h-full w-full min-w-[350px] max-w-[400px] flex-col rounded-2xl bg-indigo-50/50 border border-indigo-100 dark:bg-slate-800/50 dark:border-gray-700">
          <div className="flex items-center justify-between border-b border-indigo-100 p-4 dark:border-gray-700 bg-white rounded-t-2xl dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
                <BookOpen size={14} />
              </div>
              <h2 className="font-bold text-gray-800 dark:text-gray-200">검토 대기</h2>
              <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-xs font-medium dark:bg-indigo-900">{reviewBooks.length}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-3 h-full">
              {reviewBooks.length === 0 ? (
                 <div className="flex h-full flex-col items-center justify-center text-indigo-300/50">
                    <div className="rounded-lg border-2 border-dashed border-indigo-200/50 p-6 text-center">
                      <p className="text-sm">왼쪽에서 도서를 선택하여<br/>이곳으로 옮기세요</p>
                    </div>
                 </div>
              ) : (
                reviewBooks.map(book => (
                  <BookCard key={book.id} book={book} onAction={moveBook} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center text-gray-300">
          <ArrowRight size={24} />
        </div>

        {/* Column 3: Confirmed */}
        <div className="flex h-full w-full min-w-[350px] max-w-[400px] flex-col rounded-2xl bg-green-50/50 border border-green-100 dark:bg-slate-800/50 dark:border-gray-700">
          <div className="flex items-center justify-between border-b border-green-100 p-4 dark:border-gray-700 bg-white rounded-t-2xl dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
                <Star size={14} />
              </div>
              <h2 className="font-bold text-gray-800 dark:text-gray-200">최종 확정</h2>
              <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium dark:bg-green-900">{confirmedBooks.length}</span>
            </div>
            <div className="text-sm font-bold text-green-700 dark:text-green-400">
              {totalAmount.toLocaleString()}원
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            
            {/* Analysis Result Block */}
            {analysis && (
              <div className="mb-4 rounded-xl bg-white p-4 shadow-sm border border-green-100 dark:bg-slate-800 dark:border-gray-700 animate-fade-in-up">
                 <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 mb-2">
                    <Sparkles size={16} /> AI 수서 분석
                 </div>
                 <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{analysis.summary}</p>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded dark:bg-gray-700">
                      <span className="block font-semibold text-gray-500">예산</span>
                      {analysis.budgetAnalysis}
                    </div>
                    <div className="bg-gray-50 p-2 rounded dark:bg-gray-700">
                      <span className="block font-semibold text-gray-500">추천 점수</span>
                      <span className="text-lg font-bold text-accent">{analysis.recommendationScore}</span>
                    </div>
                 </div>
              </div>
            )}

            <div className="space-y-3 h-full">
              {confirmedBooks.length === 0 ? (
                 <div className="flex h-full flex-col items-center justify-center text-green-300/50">
                    <div className="rounded-lg border-2 border-dashed border-green-200/50 p-6 text-center">
                       <p className="text-sm">구매 확정된 도서가<br/>이곳에 표시됩니다</p>
                    </div>
                 </div>
              ) : (
                confirmedBooks.map(book => (
                  <BookCard key={book.id} book={book} onAction={moveBook} />
                ))
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-green-100 dark:border-gray-700 bg-white rounded-b-2xl dark:bg-slate-800">
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || confirmedBooks.length === 0}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  AI 분석
                </button>
                <button 
                  disabled={confirmedBooks.length === 0}
                  className="flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  onClick={handleDownloadOrder}
                >
                  <Download size={16} />
                  주문서
                </button>
             </div>
          </div>
        </div>

      </main>

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={handleSaveKeys}
        initialKeys={apiKeys}
      />
    </div>
  );
}

const RotateCcwIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

export default App;
