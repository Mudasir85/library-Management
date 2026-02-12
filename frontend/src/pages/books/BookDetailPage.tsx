import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  BookOpen,
  Calendar,
  MapPin,
  Hash,
  Globe,
  FileText,
  DollarSign,
  Layers,
  BookMarked,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Book, Reservation } from '@/types';
import { bookService } from '@/services/book.service';
import { reservationService } from '@/services/reservation.service';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReserving, setIsReserving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'librarian';
  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';

  const fetchBook = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await bookService.getById(id);
      setBook(response.data);
    } catch {
      toast.error('Failed to load book details.');
      navigate('/books');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  const fetchReservations = useCallback(async () => {
    if (!id) return;
    try {
      const response = await reservationService.getByBook(id);
      setReservations(response.data);
    } catch {
      // Reservations are supplementary; fail silently
    }
  }, [id]);

  useEffect(() => {
    fetchBook();
    fetchReservations();
  }, [fetchBook, fetchReservations]);

  const handleDelete = async () => {
    if (!book) return;
    setIsDeleting(true);
    try {
      await bookService.delete(book.id);
      toast.success(`"${book.title}" has been deleted successfully.`);
      navigate('/books');
    } catch {
      toast.error('Failed to delete the book. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleReserve = async () => {
    if (!book) return;
    setIsReserving(true);
    try {
      await reservationService.create(book.id);
      toast.success('Book reserved successfully! You will be notified when it becomes available.');
      fetchReservations();
    } catch {
      toast.error('Failed to reserve the book. Please try again.');
    } finally {
      setIsReserving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <BookOpen size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Book not found</h2>
        <p className="mt-1 text-sm text-gray-500">The book you are looking for does not exist or has been removed.</p>
        <Link to="/books" className="btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back to Books
        </Link>
      </div>
    );
  }

  const isAvailable = book.availableCopies > 0;
  const availabilityPercent = book.totalCopies > 0 ? (book.availableCopies / book.totalCopies) * 100 : 0;
  const activeReservations = reservations.filter((r) => r.status === 'active');

  const detailItems = [
    { label: 'Author', value: book.author, icon: <UserIcon size={16} /> },
    { label: 'ISBN', value: book.isbn, icon: <Hash size={16} /> },
    { label: 'Publisher', value: book.publisher, icon: <BookOpen size={16} /> },
    {
      label: 'Publication Year',
      value: book.publicationYear ? String(book.publicationYear) : null,
      icon: <Calendar size={16} />,
    },
    { label: 'Edition', value: book.edition, icon: <Layers size={16} /> },
    { label: 'Category', value: book.category, icon: <BookMarked size={16} /> },
    { label: 'Language', value: book.language, icon: <Globe size={16} /> },
    {
      label: 'Pages',
      value: book.pages ? String(book.pages) : null,
      icon: <FileText size={16} />,
    },
    { label: 'Shelf Location', value: book.shelfLocation, icon: <MapPin size={16} /> },
    { label: 'Call Number', value: book.callNumber, icon: <Hash size={16} /> },
    {
      label: 'Price',
      value: book.price != null ? `$${book.price.toFixed(2)}` : null,
      icon: <DollarSign size={16} />,
    },
    {
      label: 'Purchase Date',
      value: book.purchaseDate ? format(new Date(book.purchaseDate), 'MMM d, yyyy') : null,
      icon: <Calendar size={16} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/books"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Books
        </Link>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cover image section */}
        <div className="lg:col-span-1">
          <div className="card flex flex-col items-center">
            {book.coverImageUrl ? (
              <img
                src={book.coverImageUrl}
                alt={`Cover of ${book.title}`}
                className="h-80 w-56 rounded-lg object-cover shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`${
                book.coverImageUrl ? 'hidden' : 'flex'
              } h-80 w-56 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 shadow-md`}
            >
              <BookOpen size={56} className="text-primary-400 mb-3" />
              <p className="px-4 text-center text-sm font-medium text-primary-600">{book.title}</p>
            </div>

            {/* Condition badge */}
            <div className="mt-4">
              <StatusBadge status={book.condition} />
            </div>

            {/* Availability bar */}
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium text-gray-700">Availability</span>
                <span
                  className={`font-semibold ${
                    isAvailable ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {book.availableCopies} of {book.totalCopies} available
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    availabilityPercent > 50
                      ? 'bg-green-500'
                      : availabilityPercent > 0
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${availabilityPercent}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex w-full flex-col gap-2">
              {isStaff && (
                <Link
                  to={`/books/${book.id}/edit`}
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  <Pencil size={16} />
                  Edit Book
                </Link>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="btn-danger inline-flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Book
                </button>
              )}
              {isMember && !isAvailable && (
                <button
                  onClick={handleReserve}
                  disabled={isReserving}
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  <BookMarked size={16} />
                  {isReserving ? 'Reserving...' : 'Reserve Book'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <div className="card">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                {book.category}
              </span>
              {!isAvailable && (
                <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Unavailable
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{book.title}</h1>
            <p className="mt-1 text-lg text-gray-600">by {book.author}</p>
            {book.edition && (
              <p className="mt-0.5 text-sm text-gray-400">{book.edition} Edition</p>
            )}

            {/* Added/Updated timestamps */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Added {format(new Date(book.createdAt), 'MMM d, yyyy')}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Updated {format(new Date(book.updatedAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Book Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {detailItems.map(
                (item) =>
                  item.value && (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                          {item.label}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900">{item.value}</p>
                      </div>
                    </div>
                  )
              )}
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Description</h2>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">
                {book.description}
              </p>
            </div>
          )}

          {/* Reservation queue */}
          {activeReservations.length > 0 && (
            <div className="card">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Reservation Queue
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {activeReservations.length}
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-2 text-left font-medium text-gray-500">#</th>
                      <th className="pb-2 text-left font-medium text-gray-500">Member</th>
                      <th className="pb-2 text-left font-medium text-gray-500">Reserved On</th>
                      <th className="pb-2 text-left font-medium text-gray-500">Expires</th>
                      <th className="pb-2 text-left font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeReservations.map((reservation, index) => (
                      <tr key={reservation.id}>
                        <td className="py-2.5 text-gray-500">{index + 1}</td>
                        <td className="py-2.5 font-medium text-gray-900">
                          {reservation.member?.fullName ?? reservation.memberId}
                        </td>
                        <td className="py-2.5 text-gray-600">
                          {format(new Date(reservation.reservationDate), 'MMM d, yyyy')}
                        </td>
                        <td className="py-2.5 text-gray-600">
                          {reservation.expiryDate
                            ? format(new Date(reservation.expiryDate), 'MMM d, yyyy')
                            : '---'}
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={reservation.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={`Are you sure you want to delete "${book.title}"? This action cannot be undone and will remove all associated records.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
