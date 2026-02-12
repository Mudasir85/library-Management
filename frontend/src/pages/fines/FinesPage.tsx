import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  DollarSign,
  AlertTriangle,
  CreditCard,
  Ban,
  Filter,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fineService } from '@/services/fine.service';
import { Fine, FineStatus, FineType, PaymentMethod } from '@/types';
import DataTable, { Column } from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import SearchInput from '@/components/common/SearchInput';
import StatsCard from '@/components/common/StatsCard';

const ITEMS_PER_PAGE = 10;

interface PaymentFormData {
  amount: number;
  paymentMethod: PaymentMethod;
}

const fineTypeLabels: Record<FineType, string> = {
  overdue: 'Overdue',
  lost: 'Lost Book',
  damage: 'Damage',
  membership: 'Membership',
  reservation_noshow: 'No Show',
};

const fineTypeVariants: Record<FineType, string> = {
  overdue: 'bg-red-100 text-red-800',
  lost: 'bg-purple-100 text-purple-800',
  damage: 'bg-orange-100 text-orange-800',
  membership: 'bg-blue-100 text-blue-800',
  reservation_noshow: 'bg-gray-100 text-gray-800',
};

export default function FinesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [fines, setFines] = useState<Fine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FineStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<FineType | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  // Outstanding summary
  const [outstandingCount, setOutstandingCount] = useState(0);
  const [outstandingTotal, setOutstandingTotal] = useState(0);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedFine, setSelectedFine] = useState<Fine | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Waive confirm
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [waivingFine, setWaivingFine] = useState<Fine | null>(null);
  const [waiving, setWaiving] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>();

  const fetchFines = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.fineType = typeFilter;

      const response = await fineService.getAll(params);
      setFines(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalItems(response.meta.total);
    } catch {
      toast.error('Failed to load fines');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter, typeFilter]);

  const fetchOutstanding = useCallback(async () => {
    try {
      const response = await fineService.getOutstanding();
      const outstanding = response.data;
      setOutstandingCount(outstanding.length);
      setOutstandingTotal(
        outstanding.reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
      );
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  useEffect(() => {
    fetchOutstanding();
  }, [fetchOutstanding]);

  const openPaymentModal = (fine: Fine) => {
    setSelectedFine(fine);
    setValue('amount', fine.amount - fine.paidAmount);
    setValue('paymentMethod', 'cash');
    setPaymentModalOpen(true);
  };

  const handlePayment = async (data: PaymentFormData) => {
    if (!selectedFine) return;
    setProcessingPayment(true);
    try {
      await fineService.processPayment(
        selectedFine.id,
        data.amount,
        data.paymentMethod,
      );
      toast.success('Payment processed successfully');
      setPaymentModalOpen(false);
      setSelectedFine(null);
      resetForm();
      fetchFines();
      fetchOutstanding();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to process payment',
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const openWaiveDialog = (fine: Fine) => {
    setWaivingFine(fine);
    setWaiveDialogOpen(true);
  };

  const handleWaive = async () => {
    if (!waivingFine) return;
    setWaiving(true);
    try {
      await fineService.waive(waivingFine.id);
      toast.success('Fine waived successfully');
      setWaiveDialogOpen(false);
      setWaivingFine(null);
      fetchFines();
      fetchOutstanding();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(error.response?.data?.error?.message ?? 'Failed to waive fine');
    } finally {
      setWaiving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = search || statusFilter || typeFilter;

  const columns: Column<Fine>[] = [
    {
      accessor: 'member.fullName',
      header: 'Member',
      render: (_val: unknown, row: Fine) => (
        <span className="font-medium text-gray-900">
          {row.member?.fullName ?? row.memberId}
        </span>
      ),
    },
    {
      accessor: 'fineType',
      header: 'Type',
      render: (_val: unknown, row: Fine) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            fineTypeVariants[row.fineType]
          }`}
        >
          {fineTypeLabels[row.fineType]}
        </span>
      ),
    },
    {
      accessor: 'amount',
      header: 'Amount',
      render: (_val: unknown, row: Fine) => (
        <span className="font-medium text-gray-900">${row.amount.toFixed(2)}</span>
      ),
    },
    {
      accessor: 'paidAmount',
      header: 'Paid',
      render: (_val: unknown, row: Fine) => (
        <span
          className={
            row.paidAmount > 0 ? 'font-medium text-green-600' : 'text-gray-400'
          }
        >
          {row.paidAmount > 0 ? `$${row.paidAmount.toFixed(2)}` : '\u2014'}
        </span>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (_val: unknown, row: Fine) => <StatusBadge status={row.status} />,
    },
    {
      accessor: 'createdAt',
      header: 'Date',
      render: (_val: unknown, row: Fine) => format(new Date(row.createdAt), 'MMM dd, yyyy'),
    },
    {
      accessor: 'id',
      header: 'Actions',
      render: (_val: unknown, row: Fine) => (
        <div className="flex items-center gap-1">
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openPaymentModal(row);
                }}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                title="Process payment"
              >
                <CreditCard className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openWaiveDialog(row);
                  }}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Waive fine"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          {row.status !== 'pending' && (
            <span className="text-xs text-gray-400">
              {row.status === 'paid' ? 'Paid' : 'Waived'}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fines Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track, collect, and manage library fines
        </p>
      </div>

      {/* Outstanding Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Outstanding Fines"
          value={outstandingCount}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBgColor="bg-red-50"
        />
        <StatsCard
          title="Total Outstanding"
          value={`$${outstandingTotal.toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-50"
        />
        <StatsCard
          title="Total Records"
          value={totalItems}
          icon={CreditCard}
          iconColor="text-primary-600"
          iconBgColor="bg-primary-50"
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
            placeholder="Search by member name..."
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
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as FineStatus | '');
                  setCurrentPage(1);
                }}
                className="input-field"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Fine Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as FineType | '');
                  setCurrentPage(1);
                }}
                className="input-field"
              >
                <option value="">All Types</option>
                <option value="overdue">Overdue</option>
                <option value="lost">Lost Book</option>
                <option value="damage">Damage</option>
                <option value="membership">Membership</option>
                <option value="reservation_noshow">No Show</option>
              </select>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
          {[
            { label: 'All', value: '' as const },
            { label: 'Pending', value: 'pending' as const },
            { label: 'Paid', value: 'paid' as const },
            { label: 'Waived', value: 'waived' as const },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? tab.value === 'pending'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-primary-100 text-primary-700'
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
          data={fines}
          loading={isLoading}
          emptyMessage="No fines found matching your criteria."
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

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedFine(null);
          resetForm();
        }}
        title="Process Fine Payment"
        size="md"
      >
        {selectedFine && (
          <form onSubmit={handleSubmit(handlePayment)} className="space-y-4">
            {/* Fine Summary */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Member</p>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFine.member?.fullName ?? selectedFine.memberId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Fine Type</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      fineTypeVariants[selectedFine.fineType]
                    }`}
                  >
                    {fineTypeLabels[selectedFine.fineType]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Amount</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${selectedFine.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Already Paid</p>
                  <p className="text-sm font-medium text-green-600">
                    ${selectedFine.paidAmount.toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Remaining Balance</p>
                  <p className="text-lg font-bold text-red-600">
                    ${(selectedFine.amount - selectedFine.paidAmount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Payment Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedFine.amount - selectedFine.paidAmount}
                {...register('amount', {
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                  max: {
                    value: selectedFine.amount - selectedFine.paidAmount,
                    message: 'Cannot exceed remaining balance',
                  },
                  valueAsNumber: true,
                })}
                className={`input-field ${errors.amount ? 'input-error' : ''}`}
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                {...register('paymentMethod', {
                  required: 'Payment method is required',
                })}
                className="input-field"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
              {errors.paymentMethod && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.paymentMethod.message}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setSelectedFine(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingPayment}
                className="btn-primary flex items-center gap-2"
              >
                {processingPayment && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {processingPayment ? 'Processing...' : 'Process Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Waive Confirm Dialog */}
      <ConfirmDialog
        isOpen={waiveDialogOpen}
        onClose={() => {
          setWaiveDialogOpen(false);
          setWaivingFine(null);
        }}
        onConfirm={handleWaive}
        title="Waive Fine"
        message={
          waivingFine
            ? `Are you sure you want to waive the $${waivingFine.amount.toFixed(2)} ${fineTypeLabels[waivingFine.fineType].toLowerCase()} fine for ${waivingFine.member?.fullName ?? 'this member'}? This action cannot be undone.`
            : ''
        }
        confirmText="Waive Fine"
        variant="danger"
        isLoading={waiving}
      />
    </div>
  );
}
