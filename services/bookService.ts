
import { Book, FetchSource, SearchTarget } from '../types';

// List of proxies to try in order to ensure reliability
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` 
];

// Robust fetch function with retries and proxy fallback
async function fetchWithRetry(targetUrl: string): Promise<any> {
  let lastError: any;

  for (const proxyGenerator of PROXIES) {
    const proxyUrl = proxyGenerator(targetUrl);
    
    // Try 2 times per proxy
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        
        // Try to parse JSON
        const data = await response.json();
        return data;
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed for proxy ${proxyUrl}:`, error);
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError || new Error("Network Error: Failed to fetch data from all proxies.");
}

export const validateTtbKey = async (ttbKey: string): Promise<boolean> => {
  if (!ttbKey) return false;
  try {
    const cleanKey = ttbKey.trim();
    // Added timestamp to prevent caching during validation
    const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${cleanKey}&QueryType=Bestseller&MaxResults=1&start=1&SearchTarget=Book&output=js&Version=20131101&_t=${Date.now()}`;
    const data = await fetchWithRetry(aladinUrl);
    if (data.errorCode) return false;
    if (data.item && Array.isArray(data.item)) return true;
    return false;
  } catch (error) {
    return false; 
  }
};

export const validateNlkKey = async (authKey: string): Promise<boolean> => {
  if (!authKey) return false;
  try {
    const cleanKey = authKey.trim();
    // Added timestamp to prevent caching during validation
    const nlkUrl = `https://data4library.kr/api/recommandList?authKey=${cleanKey}&startDt=20230101&endDt=20230131&format=json&pageNo=1&pageSize=1&_t=${Date.now()}`;
    const data = await fetchWithRetry(nlkUrl);
    
    if (data.response?.error) return false;
    if (data.response?.docs) return true;
    return false;
  } catch (error) {
    return false;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAladinItemToBook = (item: any): Book => ({
  id: String(item.itemId),
  title: item.title,
  author: item.author,
  publisher: item.publisher,
  pubDate: item.pubDate,
  cover: item.cover,
  description: item.description || '',
  isbn13: item.isbn13,
  priceStandard: item.priceStandard,
  priceSales: item.priceSales,
  link: item.link,
  categoryName: item.categoryName,
  status: 'discovery'
});

const isWithinOneYear = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const pubDate = new Date(dateStr);
  if (isNaN(pubDate.getTime())) return true; // Keep if date is invalid to be safe
  
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return pubDate >= oneYearAgo;
};

// Filter function to exclude comics
const isNotComic = (book: Book): boolean => {
  if (!book.categoryName) return true;
  return !book.categoryName.includes('만화');
};

export const searchBooks = async (query: string, ttbKey: string, target: SearchTarget = 'Keyword', page: number = 1): Promise<Book[]> => {
  if (!query || !ttbKey) return [];
  const cleanKey = ttbKey.trim();
  
  // Added timestamp to prevent caching search results
  // Use the 'target' parameter for QueryType (Keyword, Title, Author, Publisher)
  const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${cleanKey}&Query=${encodeURIComponent(query)}&QueryType=${target}&MaxResults=50&start=${page}&SearchTarget=Book&output=js&Version=20131101&Cover=Big&_t=${Date.now()}`;

  try {
    const data = await fetchWithRetry(aladinUrl);
    if (data.errorCode) throw new Error(`Aladin Search Error: ${data.errorMessage || data.errorCode}`);
    if (!data.item || !Array.isArray(data.item)) return [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const books = data.item.map(mapAladinItemToBook);
    return books
      .filter((book: Book) => isWithinOneYear(book.pubDate))
      .filter(isNotComic); // Exclude comics
  } catch (error) {
    console.error("Search failed", error);
    throw error;
  }
};

export const fetchBooks = async (source: FetchSource, ttbKey?: string, nlkKey?: string, page: number = 1): Promise<Book[]> => {
  try {
    // 1. National Library of Korea (Librarian Recommendation)
    if (source === 'editorRecommend') {
      if (!nlkKey) throw new Error("국립중앙도서관 API 키가 필요합니다.");
      const cleanKey = nlkKey.trim();
      
      // Added timestamp to prevent caching
      const nlkUrl = `https://data4library.kr/api/recommandList?authKey=${cleanKey}&format=json&pageNo=${page}&pageSize=50&_t=${Date.now()}`;
      const data = await fetchWithRetry(nlkUrl);
      
      if (data.response?.error) throw new Error(data.response.error);
      if (!data.response?.docs || !Array.isArray(data.response.docs)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.response.docs.map((wrapper: any) => {
        const item = wrapper.doc;
        return {
          id: `nlk-${item.isbn13 || item.no}`,
          title: item.bookname,
          author: item.authors,
          publisher: item.publisher,
          pubDate: item.publication_year,
          cover: item.bookImageURL,
          description: item.description || item.class_nm || '',
          isbn13: item.isbn13,
          priceStandard: 0,
          priceSales: 0,
          link: item.bookDtlUrl,
          categoryName: item.class_nm,
          status: 'discovery'
        };
      });
    }

    // Aladin Logic
    if (!ttbKey) return [];
    const cleanKey = ttbKey.trim();
    // Added timestamp to commonParams
    const commonParams = `ttbkey=${cleanKey}&MaxResults=50&start=${page}&SearchTarget=Book&output=js&Version=20131101&Cover=Big&_t=${Date.now()}`;

    let books: Book[] = [];

    // 2. Aladin Bestseller Only
    if (source === 'bestseller') {
      const url = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?${commonParams}&QueryType=Bestseller`;
      const data = await fetchWithRetry(url);
      if (data.errorCode) throw new Error(`Aladin Error: ${data.errorMessage}`);
      books = Array.isArray(data.item) ? data.item.map(mapAladinItemToBook) : [];
    }

    // 3. Aladin New Special (Mapped as "Steady Seller" / Noteworthy New)
    else if (source === 'itemNewSpecial') {
      const url = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?${commonParams}&QueryType=ItemNewSpecial`;
      const data = await fetchWithRetry(url);
      if (data.errorCode) throw new Error(`Aladin Error: ${data.errorMessage}`);
      books = Array.isArray(data.item) ? data.item.map(mapAladinItemToBook) : [];
    }

    // 4. Combined (Bestseller 50 + ItemNewSpecial 50)
    else if (source === 'combined') {
      const bestsellerUrl = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?${commonParams}&QueryType=Bestseller`;
      const newSpecialUrl = `https://www.aladin.co.kr/ttb/api/ItemList.aspx?${commonParams}&QueryType=ItemNewSpecial`;

      const [bestsellerData, newSpecialData] = await Promise.all([
        fetchWithRetry(bestsellerUrl),
        fetchWithRetry(newSpecialUrl)
      ]);

      if (bestsellerData.errorCode) throw new Error(`Aladin Bestseller Error: ${bestsellerData.errorMessage}`);
      if (newSpecialData.errorCode) throw new Error(`Aladin NewSpecial Error: ${newSpecialData.errorMessage}`);

      const bestsellers = Array.isArray(bestsellerData.item) ? bestsellerData.item.map(mapAladinItemToBook) : [];
      const newSpecials = Array.isArray(newSpecialData.item) ? newSpecialData.item.map(mapAladinItemToBook) : [];

      // Merge and deduplicate by ID
      const combined = [...bestsellers, ...newSpecials];
      const uniqueBooks = Array.from(new Map(combined.map(item => [item.id, item])).values());
      
      books = uniqueBooks;
    }

    // Apply comic filter to all Aladin results
    return books.filter(isNotComic);

  } catch (error) {
    console.error("Fetching books failed", error);
    throw error;
  }
};
