import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeftRight,
  BookPlus,
  BookCheck,
  Eye,
  RefreshCw,
  AlertTriangle,
  Filter,
  X,
} from 'lucide-react';
import { transactionService } from '@/services/transaction.service';
import { Transaction, TransactionStatus } from '@/types';
import DataTable, { Column } from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import StatusBadge from '@/components/common/StatusBadge';
import SearchInput from '@/components/common/SearchInput';
import StatsCard from '@/components/common/StatsCard';

const ITEMS_PER_PAGE = 10;

export default function TransactionsPage() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [overdueCount, setOverdueCount] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.fromDate = dateFrom;
      if (dateTo) params.toDate = dateTo;

      const response = await transactionService.getAll(params);
      setTransactions(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter, dateFrom, dateTo]);

  const fetchOverdueCount = useCallback(async () => {
    try {
      const response = await transactionService.getOverdue();
      setOverdueCount(response.data.length);
    } catch {
      /* silently fail for count */
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchOverdueCount();
  }, [fetchOverdueCount]);

  const handleViewDetails = async (transaction: Transaction) => {
    try {
      const response = await transactionService.getById(transaction.id);
      setSelectedTransaction(response.data);
      setDetailModalOpen(true);
    } catch {
      toast.error('Failed to load transaction details');
    }
  };

  const handleRenew = async (transactionId: string) => {
    setRenewingId(transactionId);
    try {
      await transactionService.renewBook(transactionId);
      toast.success('Book renewed successfully');
      fetchTransactions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message ?? 'Failed to renew book');
    } finally {
      setRenewingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = search || statusFilter || dateFrom || dateTo;

  const columns: Column<Transaction>[] = [
    {
      accessor: 'book.title',
      header: 'Book Title',
      render: (_val: unknown, row: Transaction) => (
        <span className="font-medium text-gray-900">{row.book?.title ?? row.bookId}</span>
      ),
    },
    {
      accessor: 'member.fullName',
      header: 'Member',
      render: (_val: unknown, row: Transaction) => row.member?.fullName ?? row.memberId,
    },
    {
      accessor: 'issueDate',
      header: 'Issue Date',
      render: (_val: unknown, row: Transaction) => format(new Date(row.issueDate), 'MMM dd, yyyy'),
    },
    {
      accessor: 'dueDate',
      header: 'Due Date',
      render: (_val: unknown, row: Transaction) => format(new Date(row.dueDate), 'MMM dd, yyyy'),
    },
    {
      accessor: 'returnDate',
      header: 'Return Date',
      render: (_val: unknown, row: Transaction) =>
        row.returnDate ? format(new Date(row.returnDate), 'MMM dd, yyyy') : '\u2014',
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (_val: unknown, row: Transaction) => <StatusBadge status={row.status} />,
    },
    {
      accessor: 'fineAmount',
      header: 'Fine',
      render: (_val: unknown, row: Transaction) =>
        row.fineAmount > 0 ? (
          <span className="font-medium text-red-600">${row.fineAmount.toFixed(2)}</span>
        ) : (
          <span className="text-gray-400">{'\u2014'}</span>
        ),
    },
    {
      accessor: 'id',
      header: 'Actions',
      render: (_val: unknown, row: Transaction) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(row);
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition-colors"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {row.status === 'issued' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenew(row.id);
              }}
              disabled={renewingId === row.id}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Renew"
            >
              <RefreshCw
                className={`h-4 w-4 ${renewingId === row.id ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage book issues, returns, and renewals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions/issue')}
            className="btn-primary flex items-center gap-2"
          >
            <BookPlus className="h-4 w-4" />
            Issue Book
          </button>
          <button
            onClick={() => navigate('/transactions/return')}
            className="btn-secondary flex items-center gap-2"
          >
            <BookCheck className="h-4 w-4" />
            Return Book
          </button>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {overdueCount} overdue transaction{overdueCount !== 1 ? 's' : ''} require
              attention
            </p>
          </div>
          <button
            onClick={() => {
              setStatusFilter('overdue');
              setCurrentPage(1);
            }}
            className="text-sm font-medium text-red-700 underline hover:text-red-900"
          >
            View All
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Transactions"
          value={totalItems}
          icon={ArrowLeftRight}
          iconColor="text-primary-600"
          iconBgColor="bg-primary-50"
        />
        <StatsCard
          title="Overdue Books"
          value={overdueCount}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBgColor="bg-red-50"
        />
        <StatsCard
          title="Current Page"
          value={`${currentPage} / ${totalPages || 1}`}
          icon={BookCheck}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
        />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            placeholder="Search by member name or book title..."
            className="w-full sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 text-sm ${
                showFilters
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : ''
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as TransactionStatus | '');
                  setCurrentPage(1);
                }}
                className="input-field"
              >
                <option value="">All Statuses</option>
                <option value="issued">Issued</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
          {[
            { label: 'All', value: '' as const },
            { label: 'Issued', value: 'issued' as const },
            { label: 'Returned', value: 'returned' as const },
            { label: 'Overdue', value: 'overdue' as const },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? tab.value === 'overdue'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.value === 'overdue' && overdueCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={transactions}
          loading={isLoading}
          emptyMessage="No transactions found matching your criteria."
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

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedTransaction(null);
        }}
        title="Transaction Details"
        size="lg"
      >
        {selectedTransaction && (
          <div className="space-y-6">
            {/* Book Info */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Book Information
              </h3>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <p className="text-lg font-semibold text-gray-900">
                  {selectedTransaction.book?.title ?? 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  by {selectedTransaction.book?.author ?? 'Unknown'}
                </p>
                {selectedTransaction.book?.isbn && (
                  <p className="mt-1 text-xs text-gray-400">
                    ISBN: {selectedTransaction.book.isbn}
                  </p>
                )}
              </div>
            </div>

            {/* Member Info */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Member Information
              </h3>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <p className="font-medium text-gray-900">
                  {selectedTransaction.member?.fullName ?? 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedTransaction.member?.email}
                </p>
                {selectedTransaction.member?.memberType && (
                  <div className="mt-1">
                    <StatusBadge status={selectedTransaction.member.memberType} />
                  </div>
                )}
              </div>
            </div>

            {/* Transaction Details Grid */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Transaction Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Issue Date</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(selectedTransaction.issueDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Due Date</p>
                  <p className="font-medium text-gray-900">
                    {format(new Date(selectedTransaction.dueDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Return Date</p>
                  <p className="font-medium text-gray-900">
                    {selectedTransaction.returnDate
                      ? format(new Date(selectedTransaction.returnDate), 'MMMM dd, yyyy')
                      : 'Not returned'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Status</p>
                  <div className="mt-0.5">
                    <StatusBadge status={selectedTransaction.status} size="md" />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Renewals</p>
                  <p className="font-medium text-gray-900">
                    {selectedTransaction.renewalCount}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-xs text-gray-400">Fine</p>
                  {selectedTransaction.fineAmount > 0 ? (
                    <p className="font-medium text-red-600">
                      ${selectedTransaction.fineAmount.toFixed(2)}{' '}
                      {selectedTransaction.finePaid && (
                        <span className="text-xs text-green-600">(Paid)</span>
                      )}
                    </p>
                  ) : (
                    <p className="font-medium text-gray-400">None</p>
                  )}
                </div>
              </div>
            </div>

            {/* Issued By */}
            {selectedTransaction.issuedBy && (
              <div className="text-xs text-gray-400">
                Issued by: {selectedTransaction.issuedBy.fullName}
                {selectedTransaction.returnedTo && (
                  <> | Returned to: {selectedTransaction.returnedTo.fullName}</>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
