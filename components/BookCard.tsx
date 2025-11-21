import React from 'react';
import { Book, BookStatus } from '../types';
import { Plus, ArrowRight, Trash2, RotateCcw } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onAction: (book: Book, action: 'add' | 'approve' | 'remove' | 'return') => void;
  compact?: boolean;
}

const BookCard: React.FC<BookCardProps> = ({ book, onAction, compact = false }) => {
  const currentStatus = book.status || 'discovery';

  // Determine actions based on status
  const renderActions = () => {
    switch (currentStatus) {
      case 'discovery':
        return (
          <button
            onClick={() => onAction(book, 'add')}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-lg hover:bg-accent-dark hover:scale-110 transition-all"
            title="검토 목록에 추가"
          >
            <Plus size={18} />
          </button>
        );
      case 'review':
        return (
          <div className="mt-3 flex w-full gap-2">
             <button
              onClick={() => onAction(book, 'return')}
              className="flex-1 flex items-center justify-center gap-1 rounded-md border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-slate-700 dark:text-gray-300"
              title="제외"
            >
              <RotateCcw size={14} /> 제외
            </button>
            <button
              onClick={() => onAction(book, 'approve')}
              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-700 shadow-sm"
              title="확정"
            >
              확정 <ArrowRight size={14} />
            </button>
          </div>
        );
      case 'confirmed':
        return (
          <div className="absolute top-2 right-2">
            <button
              onClick={() => onAction(book, 'return')}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm backdrop-blur-sm"
              title="목록에서 제거"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
    }
  };

  return (
    <div 
      className={`
        relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-800 dark:border-gray-700
        ${currentStatus === 'confirmed' ? 'border-green-200 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10' : 'border-gray-100'}
      `}
    >
      <div className="flex p-3 gap-3">
        <div className="relative w-20 shrink-0 overflow-hidden rounded-md bg-gray-100 shadow-inner">
           {book.cover ? (
            <img 
              src={book.cover} 
              alt={book.title} 
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-28 w-full items-center justify-center text-[10px] text-gray-400">No Img</div>
          )}
        </div>

        <div className="flex flex-1 flex-col min-w-0">
          <div className="mb-1 text-[10px] font-bold text-accent dark:text-accent-light">
            {book.categoryName?.split('>').pop() || '기타'}
          </div>
          <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-gray-900 dark:text-white" title={book.title}>
            {book.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
            {book.author}
          </p>
          
          <div className="mt-auto">
             <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {book.priceSales.toLocaleString()}원
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions Area */}
      {(currentStatus === 'review') && (
         <div className="px-3 pb-3 pt-0">
           {renderActions()}
         </div>
      )}
      {currentStatus !== 'review' && renderActions()}

    </div>
  );
};

export default BookCard;