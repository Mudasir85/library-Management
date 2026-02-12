import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  BookOpen,
  Filter,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Book, Category } from '@/types';
import { bookService } from '@/services/book.service';
import DataTable from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import SearchInput from '@/components/common/SearchInput';

const ITEMS_PER_PAGE = 10;

const CONDITION_OPTIONS = [
  { value: '', label: 'All Conditions' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

const AVAILABILITY_OPTIONS = [
  { value: '', label: 'All Availability' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Other', label: 'Other' },
];

export default function BooksListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const languageFilter = searchParams.get('language') || '';
  const availabilityFilter = searchParams.get('availability') || '';
  const conditionFilter = searchParams.get('condition') || '';

  const isStaff = user?.role === 'admin' || user?.role === 'librarian';
  const isAdmin = user?.role === 'admin';

  const hasActiveFilters = categoryFilter || languageFilter || availabilityFilter || conditionFilter;

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter) params.category = categoryFilter;
      if (languageFilter) params.language = languageFilter;
      if (availabilityFilter) params.availability = availabilityFilter;
      if (conditionFilter) params.condition = conditionFilter;

      const response = await bookService.getAll(params);
      setBooks(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
    } catch {
      toast.error('Failed to fetch books. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, categoryFilter, languageFilter, availabilityFilter, conditionFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await bookService.getCategories();
      setCategories(response.data);
    } catch {
      // Categories are non-critical; fail silently
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const updateSearchParams = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change (unless we're only changing page)
    if (!('page' in updates)) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  const handleSearch = (value: string) => {
    updateSearchParams({ search: value });
  };

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: String(page) });
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await bookService.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" has been deleted successfully.`);
      setDeleteTarget(null);
      fetchBooks();
    } catch {
      toast.error('Failed to delete the book. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'title' as const,
      header: 'Title',
      render: (book: Book) => (
        <div className="max-w-xs">
          <Link
            to={`/books/${book.id}`}
            className="font-medium text-primary-600 hover:text-primary-800 hover:underline"
          >
            {book.title}
          </Link>
          {book.edition && (
            <span className="ml-1 text-xs text-gray-400">({book.edition})</span>
          )}
        </div>
      ),
    },
    {
      key: 'author' as const,
      header: 'Author',
      render: (book: Book) => (
        <span className="text-sm text-gray-700">{book.author}</span>
      ),
    },
    {
      key: 'isbn' as const,
      header: 'ISBN',
      render: (book: Book) => (
        <span className="font-mono text-xs text-gray-500">{book.isbn}</span>
      ),
    },
    {
      key: 'category' as const,
      header: 'Category',
      render: (book: Book) => (
        <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
          {book.category}
        </span>
      ),
    },
    {
      key: 'availableCopies' as const,
      header: 'Available / Total',
      render: (book: Book) => {
        const isAvailable = book.availableCopies > 0;
        return (
          <span
            className={`text-sm font-medium ${
              isAvailable ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {book.availableCopies} / {book.totalCopies}
          </span>
        );
      },
    },
    {
      key: 'condition' as const,
      header: 'Condition',
      render: (book: Book) => <StatusBadge status={book.condition} />,
    },
    {
      key: 'actions' as const,
      header: 'Actions',
      render: (book: Book) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/books/${book.id}`)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600 transition-colors"
            title="View details"
          >
            <Eye size={16} />
          </button>
          {isStaff && (
            <button
              onClick={() => navigate(`/books/${book.id}/edit`)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600 transition-colors"
              title="Edit book"
            >
              <Pencil size={16} />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setDeleteTarget(book)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete book"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the library book collection
            {totalItems > 0 && (
              <span className="ml-1">
                — {totalItems} book{totalItems !== 1 ? 's' : ''} total
              </span>
            )}
          </p>
        </div>
        {isStaff && (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/books/import" className="btn-secondary inline-flex items-center gap-2">
                <BookOpen size={18} />
                <span className="hidden sm:inline">Bulk Import</span>
              </Link>
            )}
            <Link to="/books/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={18} />
              Add Book
            </Link>
          </div>
        )}
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by title, author, or ISBN..."
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary inline-flex items-center gap-2 ${
              hasActiveFilters ? 'ring-2 ring-primary-300' : ''
            }`}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                {[categoryFilter, languageFilter, availabilityFilter, conditionFilter].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Category filter */}
              <div>
                <label htmlFor="filter-category" className="mb-1 block text-xs font-medium text-gray-600">
                  Category
                </label>
                <select
                  id="filter-category"
                  value={categoryFilter}
                  onChange={(e) => updateSearchParams({ category: e.target.value })}
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

              {/* Language filter */}
              <div>
                <label htmlFor="filter-language" className="mb-1 block text-xs font-medium text-gray-600">
                  Language
                </label>
                <select
                  id="filter-language"
                  value={languageFilter}
                  onChange={(e) => updateSearchParams({ language: e.target.value })}
                  className="input-field"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Availability filter */}
              <div>
                <label htmlFor="filter-availability" className="mb-1 block text-xs font-medium text-gray-600">
                  Availability
                </label>
                <select
                  id="filter-availability"
                  value={availabilityFilter}
                  onChange={(e) => updateSearchParams({ availability: e.target.value })}
                  className="input-field"
                >
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition filter */}
              <div>
                <label htmlFor="filter-condition" className="mb-1 block text-xs font-medium text-gray-600">
                  Condition
                </label>
                <select
                  id="filter-condition"
                  value={conditionFilter}
                  onChange={(e) => updateSearchParams({ condition: e.target.value })}
                  className="input-field"
                >
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X size={14} />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
              <BookOpen size={28} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No books found</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">
              {searchQuery || hasActiveFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first book to the library.'}
            </p>
            {isStaff && !searchQuery && !hasActiveFilters && (
              <Link to="/books/new" className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus size={18} />
                Add Book
              </Link>
            )}
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={books} />
            {totalPages > 1 && (
              <div className="border-t border-gray-200 px-6 py-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
