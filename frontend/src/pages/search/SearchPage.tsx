import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Search,
  SlidersHorizontal,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  X,
} from 'lucide-react';
import api from '@/services/api';
import { bookService } from '@/services/book.service';
import { Book, Category } from '@/types';
import Pagination from '@/components/common/Pagination';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const ITEMS_PER_PAGE = 12;

type SortOption = 'title' | 'author' | 'publicationYear' | 'popularity';

export default function SearchPage() {
  // Search state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Results
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [authorFilter, setAuthorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('title');

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);

  // New arrivals & popular
  const [newArrivals, setNewArrivals] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await bookService.getCategories();
        setCategories(response.data);
      } catch {
        /* silently fail */
      }
    };
    fetchCategories();
  }, []);

  // Fetch featured sections
  useEffect(() => {
    const fetchFeatured = async () => {
      setLoadingFeatured(true);
      try {
        const [arrivalsRes, popularRes] = await Promise.all([
          bookService.getAll({ sort: 'createdAt', order: 'desc', limit: 6 }),
          bookService.getAll({ sort: 'popularity', order: 'desc', limit: 6 }),
        ]);
        setNewArrivals(arrivalsRes.data);
        setPopularBooks(popularRes.data);
      } catch {
        /* silently fail */
      } finally {
        setLoadingFeatured(false);
      }
    };
    fetchFeatured();
  }, []);

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value);
      setCurrentPage(1);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Search function
  const performSearch = useCallback(async () => {
    if (!debouncedQuery && !authorFilter && !categoryFilter && !availableOnly) {
      setHasSearched(false);
      setResults([]);
      return;
    }
    setIsLoading(true);
    setHasSearched(true);
    try {
      const params: Record<string, string | number | boolean> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sort: sortBy,
      };
      if (debouncedQuery) params.search = debouncedQuery;
      if (authorFilter) params.author = authorFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (yearFrom) params.yearFrom = yearFrom;
      if (yearTo) params.yearTo = yearTo;
      if (languageFilter) params.language = languageFilter;
      if (availableOnly) params.available = true;

      const response = await api.get('/search', { params });
      const data = response.data;

      // Handle both paginated and plain array responses
      if (data.data && data.meta) {
        setResults(data.data);
        setTotalPages(data.meta.totalPages);
        setTotalItems(data.meta.total);
      } else if (Array.isArray(data.data)) {
        setResults(data.data);
        setTotalPages(1);
        setTotalItems(data.data.length);
      } else {
        // Fallback to bookService
        const bookResponse = await bookService.getAll(
          params as Record<string, string | number | boolean>,
        );
        setResults(bookResponse.data);
        setTotalPages(bookResponse.meta.totalPages);
        setTotalItems(bookResponse.meta.total);
      }
    } catch {
      // Fallback to bookService
      try {
        const params: Record<string, string | number | boolean> = {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        };
        if (debouncedQuery) params.search = debouncedQuery;
        if (categoryFilter) params.category = categoryFilter;
        if (availableOnly) params.available = true;

        const response = await bookService.getAll(params);
        setResults(response.data);
        setTotalPages(response.meta.totalPages);
        setTotalItems(response.meta.total);
      } catch {
        toast.error('Failed to search books');
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedQuery,
    authorFilter,
    categoryFilter,
    yearFrom,
    yearTo,
    languageFilter,
    availableOnly,
    sortBy,
    currentPage,
  ]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const clearAllFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setAuthorFilter('');
    setCategoryFilter('');
    setYearFrom('');
    setYearTo('');
    setLanguageFilter('');
    setAvailableOnly(false);
    setSortBy('title');
    setCurrentPage(1);
    setHasSearched(false);
  };

  const hasFilters =
    authorFilter || categoryFilter || yearFrom || yearTo || languageFilter || availableOnly;

  const BookCard = ({ book }: { book: Book }) => (
    <div className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-primary-300 hover:shadow-md">
      {/* Cover placeholder */}
      <div className="mb-3 flex h-40 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <BookOpen className="h-12 w-12 text-primary-300" />
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-primary-700">
          {book.title}
        </h3>
        <p className="text-xs text-gray-500">{book.author}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {book.category}
          </span>
          {book.publicationYear && (
            <span className="text-[10px] text-gray-400">
              {book.publicationYear}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              book.availableCopies > 0
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {book.availableCopies > 0
              ? `${book.availableCopies} available`
              : 'Unavailable'}
          </span>
          <StatusBadge status={book.condition} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Find books by title, author, ISBN, or category
        </p>
      </div>

      {/* Main Search Bar */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by title, author, ISBN..."
              className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-10 text-base shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 placeholder:text-gray-400"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 ${
                showFilters
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : ''
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {showFilters ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Author
              </label>
              <input
                type="text"
                value={authorFilter}
                onChange={(e) => {
                  setAuthorFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by author..."
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Language
              </label>
              <input
                type="text"
                value={languageFilter}
                onChange={(e) => {
                  setLanguageFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g., English"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Year From
              </label>
              <input
                type="number"
                value={yearFrom}
                onChange={(e) => {
                  setYearFrom(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g., 2000"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Year To
              </label>
              <input
                type="number"
                value={yearTo}
                onChange={(e) => {
                  setYearTo(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g., 2024"
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => {
                    setAvailableOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Available only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Sort & Results Header */}
      {hasSearched && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isLoading
              ? 'Searching...'
              : `${totalItems} result${totalItems !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortOption);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="publicationYear">Year</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {isLoading && <LoadingSpinner message="Searching library catalog..." />}

      {!isLoading && hasSearched && results.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {results.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {!isLoading && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No books found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search terms or filters
          </p>
        </div>
      )}

      {/* Featured Sections (shown when no active search) */}
      {!hasSearched && !isLoading && (
        <div className="space-y-8">
          {/* New Arrivals */}
          {newArrivals.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  New Arrivals
                </h2>
              </div>
              {loadingFeatured ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  {newArrivals.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Popular Books */}
          {popularBooks.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Popular Books
                </h2>
              </div>
              {loadingFeatured ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  {popularBooks.map((book) => (
                    <BookCard key={book.id} book={book} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state for featured */}
          {newArrivals.length === 0 && popularBooks.length === 0 && !loadingFeatured && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-4 h-16 w-16 text-gray-200" />
              <h3 className="text-lg font-medium text-gray-900">
                Start searching
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Enter a search term above to find books in the library catalog
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
