import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookCheck,
  Clock,
  DollarSign,
} from 'lucide-react';
import { transactionService } from '@/services/transaction.service';
import { Transaction } from '@/types';
import StatusBadge from '@/components/common/StatusBadge';

export default function ReturnBookPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [returning, setReturning] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  const searchTransaction = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setTransaction(null);
    try {
      const response = await transactionService.getById(searchQuery.trim());
      if (response.data.status === 'returned') {
        toast.error('This book has already been returned');
        return;
      }
      setTransaction(response.data);
    } catch {
      // Try as a general search
      try {
        const listResponse = await transactionService.getAll({
          search: searchQuery.trim(),
          status: 'issued',
          limit: 1,
        });
        if (listResponse.data.length > 0) {
          const fullTxn = await transactionService.getById(listResponse.data[0].id);
          setTransaction(fullTxn.data);
        } else {
          // Try overdue
          const overdueResponse = await transactionService.getAll({
            search: searchQuery.trim(),
            status: 'overdue',
            limit: 1,
          });
          if (overdueResponse.data.length > 0) {
            const fullTxn = await transactionService.getById(
              overdueResponse.data[0].id,
            );
            setTransaction(fullTxn.data);
          } else {
            toast.error('No active transaction found');
          }
        }
      } catch {
        toast.error('Transaction not found');
      }
    } finally {
      setSearching(false);
    }
  };

  const isOverdue =
    transaction && !transaction.returnDate
      ? new Date() > new Date(transaction.dueDate)
      : false;

  const daysOverdue =
    transaction && isOverdue
      ? differenceInDays(new Date(), new Date(transaction.dueDate))
      : 0;

  const estimatedFine = transaction ? transaction.fineAmount || daysOverdue * 1.0 : 0;

  const handleReturn = async () => {
    if (!transaction) return;
    setReturning(true);
    try {
      const response = await transactionService.returnBook({
        transactionId: transaction.id,
      });
      setReceipt(response.data);
      toast.success('Book returned successfully!');
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(error.response?.data?.error?.message ?? 'Failed to return book');
    } finally {
      setReturning(false);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setTransaction(null);
    setReceipt(null);
  };

  // Receipt view
  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="btn-secondary p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Return Receipt</h1>
        </div>

        <div className="card">
          <div className="mb-6 flex items-center justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
            Book Returned Successfully
          </h2>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">
                  Transaction ID
                </p>
                <p className="mt-1 font-mono text-sm text-gray-900">{receipt.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">
                  Return Date
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {receipt.returnDate
                    ? format(new Date(receipt.returnDate), 'MMMM dd, yyyy')
                    : format(new Date(), 'MMMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Book</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {receipt.book?.title ?? transaction?.book?.title}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Member</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {receipt.member?.fullName ?? transaction?.member?.fullName}
                </p>
              </div>
              {receipt.fineAmount > 0 && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase text-gray-400">Fine</p>
                  <p className="mt-1 text-lg font-bold text-red-600">
                    ${receipt.fineAmount.toFixed(2)}
                    {!receipt.finePaid && (
                      <span className="ml-2 text-sm font-normal text-red-500">
                        (Payment pending)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button onClick={resetForm} className="btn-primary">
              Return Another Book
            </button>
            {receipt.fineAmount > 0 && !receipt.finePaid && (
              <button
                onClick={() => navigate('/fines')}
                className="btn-danger flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Process Fine Payment
              </button>
            )}
            <button
              onClick={() => navigate('/transactions')}
              className="btn-secondary"
            >
              Back to Transactions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/transactions')}
          className="btn-secondary p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Return Book</h1>
          <p className="mt-1 text-sm text-gray-500">
            Process a book return from a library member
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Find Transaction
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchTransaction()}
              placeholder="Enter transaction ID, book ID, or member name..."
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={searchTransaction}
            disabled={searching || !searchQuery.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </div>
      </div>

      {/* Transaction Details */}
      {transaction && (
        <>
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Transaction Details
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Book Info */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <BookCheck className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Book
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {transaction.book?.title ?? 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  by {transaction.book?.author ?? 'Unknown'}
                </p>
                {transaction.book?.isbn && (
                  <p className="mt-1 text-xs text-gray-400">
                    ISBN: {transaction.book.isbn}
                  </p>
                )}
              </div>

              {/* Member Info */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Member
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {transaction.member?.fullName ?? 'Unknown'}
                </p>
                <p className="text-sm text-gray-600">
                  {transaction.member?.email}
                </p>
                {transaction.member?.memberType && (
                  <div className="mt-1">
                    <StatusBadge status={transaction.member.memberType} />
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-400">Issue Date</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {format(new Date(transaction.issueDate), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-400">Due Date</p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    isOverdue ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {format(new Date(transaction.dueDate), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-xs text-gray-400">Status</p>
                <div className="mt-1">
                  <StatusBadge status={transaction.status} size="md" />
                </div>
              </div>
            </div>
          </div>

          {/* Overdue Warning */}
          {isOverdue && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="font-medium text-red-800">This book is overdue</p>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-700">
                      {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-red-700">
                      Estimated fine: ${estimatedFine.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fine Details (if any existing fine) */}
          {transaction.fineAmount > 0 && !isOverdue && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <DollarSign className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  Existing fine: ${transaction.fineAmount.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-yellow-700">
                  {transaction.finePaid
                    ? 'Fine has been paid'
                    : 'Fine payment is pending'}
                </p>
              </div>
            </div>
          )}

          {/* Return Action */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Return
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Process the return for{' '}
                  <span className="font-medium">
                    {transaction.book?.title}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleReturn}
                  disabled={returning}
                  className="btn-primary flex items-center gap-2"
                >
                  {returning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BookCheck className="h-4 w-4" />
                  )}
                  {returning ? 'Processing...' : 'Return Book'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
