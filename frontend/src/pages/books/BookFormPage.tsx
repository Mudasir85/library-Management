import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { BookCondition, Category } from '@/types';
import { bookService } from '@/services/book.service';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface BookFormData {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publicationYear: number | '';
  edition: string;
  category: string;
  language: string;
  pages: number | '';
  shelfLocation: string;
  callNumber: string;
  totalCopies: number;
  availableCopies: number;
  condition: BookCondition;
  purchaseDate: string;
  price: number | '';
  description: string;
  coverImageUrl: string;
}

const CONDITION_OPTIONS: { value: BookCondition; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export default function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingBook, setIsLoadingBook] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookFormData>({
    defaultValues: {
      title: '',
      author: '',
      isbn: '',
      publisher: '',
      publicationYear: '',
      edition: '',
      category: '',
      language: 'English',
      pages: '',
      shelfLocation: '',
      callNumber: '',
      totalCopies: 1,
      availableCopies: 1,
      condition: 'good',
      purchaseDate: '',
      price: '',
      description: '',
      coverImageUrl: '',
    },
  });

  const totalCopiesValue = watch('totalCopies');

  const fetchCategories = useCallback(async () => {
    try {
      const response = await bookService.getCategories();
      setCategories(response.data);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchBook = useCallback(async () => {
    if (!id) return;
    setIsLoadingBook(true);
    try {
      const response = await bookService.getById(id);
      const book = response.data;
      reset({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        publisher: book.publisher ?? '',
        publicationYear: book.publicationYear ?? '',
        edition: book.edition ?? '',
        category: book.category,
        language: book.language,
        pages: book.pages ?? '',
        shelfLocation: book.shelfLocation,
        callNumber: book.callNumber,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        condition: book.condition,
        purchaseDate: book.purchaseDate ? book.purchaseDate.split('T')[0] : '',
        price: book.price ?? '',
        description: book.description ?? '',
        coverImageUrl: book.coverImageUrl ?? '',
      });
    } catch {
      toast.error('Failed to load book data.');
      navigate('/books');
    } finally {
      setIsLoadingBook(false);
    }
  }, [id, navigate, reset]);

  useEffect(() => {
    fetchCategories();
    if (isEditing) {
      fetchBook();
    }
  }, [fetchCategories, fetchBook, isEditing]);

  const onSubmit = async (formData: BookFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn.replace(/[-\s]/g, ''),
        category: formData.category.trim(),
        language: formData.language.trim(),
        shelfLocation: formData.shelfLocation.trim(),
        callNumber: formData.callNumber.trim(),
        totalCopies: Number(formData.totalCopies),
        availableCopies: Number(formData.availableCopies),
        condition: formData.condition,
      };

      // Optional fields: only include if provided
      if (formData.publisher.trim()) payload.publisher = formData.publisher.trim();
      if (formData.publicationYear !== '' && formData.publicationYear != null) {
        payload.publicationYear = Number(formData.publicationYear);
      }
      if (formData.edition.trim()) payload.edition = formData.edition.trim();
      if (formData.pages !== '' && formData.pages != null) payload.pages = Number(formData.pages);
      if (formData.purchaseDate) payload.purchaseDate = formData.purchaseDate;
      if (formData.price !== '' && formData.price != null) payload.price = Number(formData.price);
      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.coverImageUrl.trim()) payload.coverImageUrl = formData.coverImageUrl.trim();

      let bookId: string;

      if (isEditing && id) {
        const response = await bookService.update(id, payload);
        bookId = response.data.id;
        toast.success('Book updated successfully.');
      } else {
        const response = await bookService.create(payload);
        bookId = response.data.id;
        toast.success('Book created successfully.');
      }

      navigate(`/books/${bookId}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data
              ?.error?.message ?? 'An unexpected error occurred.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingBook) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back and header */}
      <div>
        <Link
          to={isEditing ? `/books/${id}` : '/books'}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          {isEditing ? 'Back to Book' : 'Back to Books'}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Book' : 'Add New Book'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEditing
            ? 'Update the book information below.'
            : 'Fill in the details to add a new book to the library.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Title */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                className={`input-field ${errors.title ? 'input-error' : ''}`}
                placeholder="Enter book title"
                {...register('title', {
                  required: 'Title is required.',
                  minLength: { value: 1, message: 'Title is required.' },
                })}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
              )}
            </div>

            {/* Author */}
            <div>
              <label htmlFor="author" className="mb-1 block text-sm font-medium text-gray-700">
                Author <span className="text-red-500">*</span>
              </label>
              <input
                id="author"
                type="text"
                className={`input-field ${errors.author ? 'input-error' : ''}`}
                placeholder="Author name"
                {...register('author', {
                  required: 'Author is required.',
                })}
              />
              {errors.author && (
                <p className="mt-1 text-xs text-red-500">{errors.author.message}</p>
              )}
            </div>

            {/* ISBN */}
            <div>
              <label htmlFor="isbn" className="mb-1 block text-sm font-medium text-gray-700">
                ISBN <span className="text-red-500">*</span>
              </label>
              <input
                id="isbn"
                type="text"
                className={`input-field ${errors.isbn ? 'input-error' : ''}`}
                placeholder="e.g. 978-3-16-148410-0"
                {...register('isbn', {
                  required: 'ISBN is required.',
                  validate: (value) => {
                    const cleaned = value.replace(/[-\s]/g, '');
                    if (!/^\d{10}$|^\d{13}$/.test(cleaned)) {
                      return 'ISBN must be 10 or 13 digits.';
                    }
                    return true;
                  },
                })}
              />
              {errors.isbn && (
                <p className="mt-1 text-xs text-red-500">{errors.isbn.message}</p>
              )}
            </div>

            {/* Publisher */}
            <div>
              <label htmlFor="publisher" className="mb-1 block text-sm font-medium text-gray-700">
                Publisher
              </label>
              <input
                id="publisher"
                type="text"
                className="input-field"
                placeholder="Publisher name"
                {...register('publisher')}
              />
            </div>

            {/* Publication Year */}
            <div>
              <label
                htmlFor="publicationYear"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Publication Year
              </label>
              <input
                id="publicationYear"
                type="number"
                className={`input-field ${errors.publicationYear ? 'input-error' : ''}`}
                placeholder="e.g. 2023"
                {...register('publicationYear', {
                  validate: (value) => {
                    if (value === '' || value == null) return true;
                    const num = Number(value);
                    if (isNaN(num)) return 'Must be a valid number.';
                    if (num < 1000 || num > 2026) return 'Year must be between 1000 and 2026.';
                    return true;
                  },
                })}
              />
              {errors.publicationYear && (
                <p className="mt-1 text-xs text-red-500">{errors.publicationYear.message}</p>
              )}
            </div>

            {/* Edition */}
            <div>
              <label htmlFor="edition" className="mb-1 block text-sm font-medium text-gray-700">
                Edition
              </label>
              <input
                id="edition"
                type="text"
                className="input-field"
                placeholder="e.g. 3rd"
                {...register('edition')}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Classification */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Classification</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">
                Category <span className="text-red-500">*</span>
              </label>
              {categories.length > 0 ? (
                <>
                  <select
                    id="category"
                    className={`input-field ${errors.category ? 'input-error' : ''}`}
                    {...register('category', {
                      required: 'Category is required.',
                    })}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
                  )}
                </>
              ) : (
                <>
                  <input
                    id="category"
                    type="text"
                    className={`input-field ${errors.category ? 'input-error' : ''}`}
                    placeholder="e.g. Fiction, Science, History"
                    {...register('category', {
                      required: 'Category is required.',
                    })}
                  />
                  {errors.category && (
                    <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="mb-1 block text-sm font-medium text-gray-700">
                Language
              </label>
              <input
                id="language"
                type="text"
                className="input-field"
                placeholder="e.g. English"
                {...register('language')}
              />
            </div>

            {/* Pages */}
            <div>
              <label htmlFor="pages" className="mb-1 block text-sm font-medium text-gray-700">
                Pages
              </label>
              <input
                id="pages"
                type="number"
                className={`input-field ${errors.pages ? 'input-error' : ''}`}
                placeholder="Number of pages"
                {...register('pages', {
                  validate: (value) => {
                    if (value === '' || value == null) return true;
                    const num = Number(value);
                    if (isNaN(num) || num < 1) return 'Must be a positive number.';
                    return true;
                  },
                })}
              />
              {errors.pages && (
                <p className="mt-1 text-xs text-red-500">{errors.pages.message}</p>
              )}
            </div>

            {/* Shelf Location */}
            <div>
              <label
                htmlFor="shelfLocation"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Shelf Location <span className="text-red-500">*</span>
              </label>
              <input
                id="shelfLocation"
                type="text"
                className={`input-field ${errors.shelfLocation ? 'input-error' : ''}`}
                placeholder="e.g. A-3-12"
                {...register('shelfLocation', {
                  required: 'Shelf location is required.',
                })}
              />
              {errors.shelfLocation && (
                <p className="mt-1 text-xs text-red-500">{errors.shelfLocation.message}</p>
              )}
            </div>

            {/* Call Number */}
            <div>
              <label htmlFor="callNumber" className="mb-1 block text-sm font-medium text-gray-700">
                Call Number <span className="text-red-500">*</span>
              </label>
              <input
                id="callNumber"
                type="text"
                className={`input-field ${errors.callNumber ? 'input-error' : ''}`}
                placeholder="e.g. QA76.73.J38"
                {...register('callNumber', {
                  required: 'Call number is required.',
                })}
              />
              {errors.callNumber && (
                <p className="mt-1 text-xs text-red-500">{errors.callNumber.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Copies & Condition */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Copies & Condition</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Total Copies */}
            <div>
              <label
                htmlFor="totalCopies"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Total Copies <span className="text-red-500">*</span>
              </label>
              <input
                id="totalCopies"
                type="number"
                min={1}
                className={`input-field ${errors.totalCopies ? 'input-error' : ''}`}
                {...register('totalCopies', {
                  required: 'Total copies is required.',
                  min: { value: 1, message: 'Must be at least 1.' },
                  valueAsNumber: true,
                })}
              />
              {errors.totalCopies && (
                <p className="mt-1 text-xs text-red-500">{errors.totalCopies.message}</p>
              )}
            </div>

            {/* Available Copies */}
            <div>
              <label
                htmlFor="availableCopies"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Available Copies <span className="text-red-500">*</span>
              </label>
              <input
                id="availableCopies"
                type="number"
                min={0}
                className={`input-field ${errors.availableCopies ? 'input-error' : ''}`}
                {...register('availableCopies', {
                  required: 'Available copies is required.',
                  min: { value: 0, message: 'Cannot be negative.' },
                  validate: (value) => {
                    const num = Number(value);
                    const total = Number(totalCopiesValue);
                    if (!isNaN(total) && num > total) {
                      return 'Cannot exceed total copies.';
                    }
                    return true;
                  },
                  valueAsNumber: true,
                })}
              />
              {errors.availableCopies && (
                <p className="mt-1 text-xs text-red-500">{errors.availableCopies.message}</p>
              )}
            </div>

            {/* Condition */}
            <div>
              <label htmlFor="condition" className="mb-1 block text-sm font-medium text-gray-700">
                Condition
              </label>
              <select id="condition" className="input-field" {...register('condition')}>
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Additional Information */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Additional Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Purchase Date */}
            <div>
              <label
                htmlFor="purchaseDate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Purchase Date
              </label>
              <input
                id="purchaseDate"
                type="date"
                className="input-field"
                {...register('purchaseDate')}
              />
            </div>

            {/* Price */}
            <div>
              <label htmlFor="price" className="mb-1 block text-sm font-medium text-gray-700">
                Price ($)
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                min={0}
                className={`input-field ${errors.price ? 'input-error' : ''}`}
                placeholder="0.00"
                {...register('price', {
                  validate: (value) => {
                    if (value === '' || value == null) return true;
                    const num = Number(value);
                    if (isNaN(num) || num < 0) return 'Must be a non-negative number.';
                    return true;
                  },
                })}
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>
              )}
            </div>

            {/* Cover Image URL */}
            <div className="sm:col-span-2">
              <label
                htmlFor="coverImageUrl"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Cover Image URL
              </label>
              <input
                id="coverImageUrl"
                type="text"
                className="input-field"
                placeholder="https://example.com/cover.jpg"
                {...register('coverImageUrl')}
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                className="input-field resize-y"
                placeholder="Brief description of the book..."
                {...register('description')}
              />
            </div>
          </div>
        </div>

        {/* Form actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
          <Link
            to={isEditing ? `/books/${id}` : '/books'}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <X size={16} />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Save size={16} />
            {isSubmitting
              ? isEditing
                ? 'Updating...'
                : 'Creating...'
              : isEditing
              ? 'Update Book'
              : 'Create Book'}
          </button>
        </div>
      </form>
    </div>
  );
}
