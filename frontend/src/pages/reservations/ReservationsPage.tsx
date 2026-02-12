import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  BookMarked,
  Plus,
  XCircle,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { reservationService } from '@/services/reservation.service';
import { bookService } from '@/services/book.service';
import { Reservation, ReservationStatus, Book } from '@/types';
import DataTable, { Column } from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import StatsCard from '@/components/common/StatsCard';
import api from '@/services/api';

const ITEMS_PER_PAGE = 10;

interface ReservationFormData {
  bookId: string;
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'librarian';

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');

  // Create reservation modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [bookSearchResults, setBookSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookSearching, setBookSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  // Cancel confirm
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingReservation, setCancellingReservation] =
    useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Fulfill
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    setValue,
    formState: { errors },
  } = useForm<ReservationFormData>();

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/reservations', { params });
      const data = response.data;
      setReservations(data.data);
      setTotalPages(data.meta?.totalPages ?? 1);
      setTotalItems(data.meta?.total ?? data.data.length);
    } catch {
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const searchBooks = async () => {
    if (!bookSearchQuery.trim()) return;
    setBookSearching(true);
    try {
      const response = await bookService.getAll({
        search: bookSearchQuery,
        limit: 5,
      });
      setBookSearchResults(response.data);
      if (response.data.length === 0) {
        toast.error('No books found');
      }
    } catch {
      toast.error('Failed to search books');
    } finally {
      setBookSearching(false);
    }
  };

  const handleCreateReservation = async () => {
    if (!selectedBook) return;
    setCreating(true);
    try {
      await reservationService.create(selectedBook.id);
      toast.success('Reservation created successfully');
      setCreateModalOpen(false);
      setSelectedBook(null);
      setBookSearchQuery('');
      setBookSearchResults([]);
      resetForm();
      fetchReservations();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to create reservation',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellingReservation) return;
    setCancelling(true);
    try {
      await reservationService.cancel(cancellingReservation.id);
      toast.success('Reservation cancelled');
      setCancelDialogOpen(false);
      setCancellingReservation(null);
      fetchReservations();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to cancel reservation',
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleFulfill = async (reservation: Reservation) => {
    setFulfillingId(reservation.id);
    try {
      await reservationService.fulfill(reservation.id);
      toast.success('Reservation fulfilled');
      fetchReservations();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to fulfill reservation',
      );
    } finally {
      setFulfillingId(null);
    }
  };

  const activeCount = reservations.filter((r) => r.status === 'active').length;

  const columns: Column<Reservation>[] = [
    {
      accessor: 'book.title',
      header: 'Book Title',
      render: (_val: unknown, row: Reservation) => (
        <span className="font-medium text-gray-900">
          {row.book?.title ?? row.bookId}
        </span>
      ),
    },
    {
      accessor: 'member.fullName',
      header: 'Member',
      render: (_val: unknown, row: Reservation) => row.member?.fullName ?? row.memberId,
    },
    {
      accessor: 'reservationDate',
      header: 'Reserved On',
      render: (_val: unknown, row: Reservation) =>
        format(new Date(row.reservationDate), 'MMM dd, yyyy'),
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (_val: unknown, row: Reservation) => <StatusBadge status={row.status} />,
    },
    {
      accessor: 'expiryDate',
      header: 'Expiry Date',
      render: (_val: unknown, row: Reservation) =>
        row.expiryDate
          ? format(new Date(row.expiryDate), 'MMM dd, yyyy')
          : '\u2014',
    },
    {
      accessor: 'id',
      header: 'Actions',
      render: (_val: unknown, row: Reservation) => (
        <div className="flex items-center gap-1">
          {row.status === 'active' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCancellingReservation(row);
                  setCancelDialogOpen(true);
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Cancel reservation"
              >
                <XCircle className="h-4 w-4" />
              </button>
              {isStaff && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFulfill(row);
                  }}
                  disabled={fulfillingId === row.id}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50"
                  title="Fulfill reservation"
                >
                  {fulfillingId === row.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </>
          )}
          {row.status !== 'active' && (
            <span className="text-xs capitalize text-gray-400">{row.status}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage book reservations and holds
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Make Reservation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Reservations"
          value={totalItems}
          icon={BookMarked}
          iconColor="text-primary-600"
          iconBgColor="bg-primary-50"
        />
        <StatsCard
          title="Active Reservations"
          value={activeCount}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
        />
        <StatsCard
          title="Page"
          value={`${currentPage} / ${totalPages || 1}`}
          icon={BookMarked}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
        />
      </div>

      {/* Status Tabs */}
      <div className="card">
        <div className="flex gap-2">
          {[
            { label: 'All', value: '' as const },
            { label: 'Active', value: 'active' as const },
            { label: 'Fulfilled', value: 'fulfilled' as const },
            { label: 'Cancelled', value: 'cancelled' as const },
            { label: 'Expired', value: 'expired' as const },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={reservations}
          loading={isLoading}
          emptyMessage="No reservations found."
        />
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Reservation Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setSelectedBook(null);
          setBookSearchQuery('');
          setBookSearchResults([]);
        }}
        title="Make a Reservation"
        size="md"
      >
        <div className="space-y-4">
          {/* Book Search */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Search for a Book
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchBooks()}
                  placeholder="Enter book title, author, or ISBN..."
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={searchBooks}
                disabled={bookSearching || !bookSearchQuery.trim()}
                className="btn-primary flex items-center gap-2"
              >
                {bookSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {bookSearchResults.length > 0 && !selectedBook && (
            <div className="space-y-2">
              {bookSearchResults.map((book) => (
                <button
                  key={book.id}
                  onClick={() => {
                    setSelectedBook(book);
                    setBookSearchResults([]);
                    setValue('bookId', book.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{book.title}</p>
                    <p className="text-xs text-gray-500">by {book.author}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      book.availableCopies > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {book.availableCopies} available
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected Book */}
          {selectedBook && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{selectedBook.title}</p>
                  <p className="text-sm text-gray-600">by {selectedBook.author}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    ISBN: {selectedBook.isbn}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-800"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Hidden field for form */}
          <input type="hidden" {...register('bookId', { required: true })} />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setCreateModalOpen(false);
                setSelectedBook(null);
                setBookSearchQuery('');
                setBookSearchResults([]);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateReservation}
              disabled={!selectedBook || creating}
              className="btn-primary flex items-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? 'Creating...' : 'Reserve Book'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setCancellingReservation(null);
        }}
        onConfirm={handleCancel}
        title="Cancel Reservation"
        message={
          cancellingReservation
            ? `Are you sure you want to cancel the reservation for "${cancellingReservation.book?.title ?? 'this book'}"?`
            : ''
        }
        confirmText="Cancel Reservation"
        variant="danger"
        isLoading={cancelling}
      />
    </div>
  );
}
