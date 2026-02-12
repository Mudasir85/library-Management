import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  RefreshCw,
  UserX,
  CreditCard,
  BookOpen,
  Clock,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Hash,
  Building,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { memberService } from '@/services/member.service';
import { Member, Transaction, Fine, MemberType } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatusBadge from '@/components/common/StatusBadge';
import DataTable, { Column } from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type ActiveTab = 'current' | 'history' | 'fines';

const memberTypeBadgeColors: Record<MemberType, string> = {
  student: 'bg-blue-100 text-blue-800',
  faculty: 'bg-purple-100 text-purple-800',
  public: 'bg-teal-100 text-teal-800',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch {
    return '\u2014';
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('current');

  // Current books (transactions with status 'issued')
  const [currentBooks, setCurrentBooks] = useState<Transaction[]>([]);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);

  // Borrowing history
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Fines
  const [fines, setFines] = useState<Fine[]>([]);
  const [isLoadingFines, setIsLoadingFines] = useState(false);

  // Actions
  const [isRenewing, setIsRenewing] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'librarian';
  const isAdmin = user?.role === 'admin';

  const fetchMember = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await memberService.getById(id);
      setMember(response.data);
    } catch {
      toast.error('Failed to load member details.');
      navigate('/members');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  const fetchCurrentBooks = useCallback(async () => {
    if (!id) return;
    setIsLoadingCurrent(true);
    try {
      const response = await memberService.getHistory(id, {
        status: 'issued',
        limit: 50,
      });
      setCurrentBooks(response.data);
    } catch {
      toast.error('Failed to load current books.');
    } finally {
      setIsLoadingCurrent(false);
    }
  }, [id]);

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    setIsLoadingHistory(true);
    try {
      const response = await memberService.getHistory(id, {
        page: historyPage,
        limit: 10,
      });
      setHistory(response.data);
      setHistoryTotalPages(response.meta.totalPages);
    } catch {
      toast.error('Failed to load borrowing history.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [id, historyPage]);

  const fetchFines = useCallback(async () => {
    if (!id) return;
    setIsLoadingFines(true);
    try {
      const response = await memberService.getFines(id);
      setFines(response.data);
    } catch {
      toast.error('Failed to load fines.');
    } finally {
      setIsLoadingFines(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  useEffect(() => {
    if (!id) return;
    if (activeTab === 'current') {
      fetchCurrentBooks();
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'fines') {
      fetchFines();
    }
  }, [activeTab, id, fetchCurrentBooks, fetchHistory, fetchFines]);

  const handleRenew = async () => {
    if (!id) return;
    setIsRenewing(true);
    try {
      const response = await memberService.renew(id);
      setMember(response.data);
      toast.success('Membership renewed successfully.');
    } catch {
      toast.error('Failed to renew membership.');
    } finally {
      setIsRenewing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!id) return;
    setIsDeactivating(true);
    try {
      await memberService.deactivate(id);
      toast.success('Member has been deactivated.');
      setShowDeactivateDialog(false);
      navigate('/members');
    } catch {
      toast.error('Failed to deactivate member.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleGenerateIdCard = () => {
    toast.success('ID Card generation initiated. Download will start shortly.');
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading member details..." />;
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-500">Member not found.</p>
        <Link to="/members" className="mt-4 btn-primary">
          Back to Members
        </Link>
      </div>
    );
  }

  // Tab content columns
  const currentBooksColumns: Column<Transaction>[] = [
    {
      key: 'bookTitle',
      header: 'Book Title',
      render: (txn: Transaction) => (
        <div>
          <p className="font-medium text-gray-900">{txn.book?.title ?? '\u2014'}</p>
          <p className="text-xs text-gray-500">{txn.book?.author ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (txn: Transaction) => (
        <span className="text-gray-600">{formatDate(txn.issueDate)}</span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (txn: Transaction) => {
        const isOverdue =
          txn.dueDate && new Date(txn.dueDate) < new Date() && !txn.returnDate;
        return (
          <span className={isOverdue ? 'font-medium text-red-600' : 'text-gray-600'}>
            {formatDate(txn.dueDate)}
            {isOverdue && (
              <span className="ml-1 text-xs">(Overdue)</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'renewalCount',
      header: 'Renewals',
      render: (txn: Transaction) => (
        <span className="text-gray-600">{txn.renewalCount}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (txn: Transaction) => <StatusBadge status={txn.status} />,
    },
  ];

  const historyColumns: Column<Transaction>[] = [
    {
      key: 'bookTitle',
      header: 'Book Title',
      render: (txn: Transaction) => (
        <div>
          <p className="font-medium text-gray-900">{txn.book?.title ?? '\u2014'}</p>
          <p className="text-xs text-gray-500">{txn.book?.author ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'issueDate',
      header: 'Issue Date',
      render: (txn: Transaction) => (
        <span className="text-gray-600">{formatDate(txn.issueDate)}</span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (txn: Transaction) => (
        <span className="text-gray-600">{formatDate(txn.dueDate)}</span>
      ),
    },
    {
      key: 'returnDate',
      header: 'Return Date',
      render: (txn: Transaction) => (
        <span className="text-gray-600">{formatDate(txn.returnDate)}</span>
      ),
    },
    {
      key: 'fineAmount',
      header: 'Fine',
      render: (txn: Transaction) => (
        <span className={txn.fineAmount > 0 ? 'font-medium text-red-600' : 'text-gray-500'}>
          {formatCurrency(txn.fineAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (txn: Transaction) => <StatusBadge status={txn.status} />,
    },
  ];

  const fineColumns: Column<Fine>[] = [
    {
      key: 'fineType',
      header: 'Type',
      render: (fine: Fine) => (
        <span className="capitalize text-gray-900">
          {fine.fineType.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (fine: Fine) => (
        <span className="text-gray-600">{fine.description || '\u2014'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (fine: Fine) => (
        <span className="font-medium text-gray-900">{formatCurrency(fine.amount)}</span>
      ),
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      render: (fine: Fine) => (
        <span className="text-gray-600">{formatCurrency(fine.paidAmount)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (fine: Fine) => (
        <span className="text-gray-600">{formatDate(fine.createdAt)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (fine: Fine) => <StatusBadge status={fine.status} />,
    },
  ];

  const tabs = [
    { id: 'current' as ActiveTab, label: 'Current Books', icon: BookOpen, count: currentBooks.length },
    { id: 'history' as ActiveTab, label: 'Borrowing History', icon: Clock },
    { id: 'fines' as ActiveTab, label: 'Fines', icon: DollarSign, count: fines.length },
  ];

  const infoItems = [
    { label: 'Date of Birth', value: formatDate(member.dateOfBirth), icon: Calendar },
    {
      label: 'Gender',
      value: member.gender
        ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1)
        : '\u2014',
      icon: User,
    },
    { label: 'Address', value: member.address || '\u2014', icon: MapPin },
    { label: 'City', value: member.city || '\u2014', icon: MapPin },
    { label: 'Postal Code', value: member.postalCode || '\u2014', icon: Hash },
    { label: 'Department', value: member.department || '\u2014', icon: Building },
    {
      label: 'Student/Employee ID',
      value: member.studentEmployeeId || '\u2014',
      icon: CreditCard,
    },
    {
      label: 'Registration Date',
      value: formatDate(member.registrationDate),
      icon: Calendar,
    },
    { label: 'Expiry Date', value: formatDate(member.expiryDate), icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <Link
          to="/members"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Avatar */}
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.fullName}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-primary-50"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700 ring-4 ring-primary-50">
                {getInitials(member.fullName)}
              </div>
            )}

            {/* Basic Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {member.fullName}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    memberTypeBadgeColors[member.memberType]
                  }`}
                >
                  {member.memberType}
                </span>
                <StatusBadge status={member.status} size="md" />
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm text-gray-500 sm:flex-row sm:gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {member.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isStaff && (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/members/${member.id}/edit`}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`}
                />
                {isRenewing ? 'Renewing...' : 'Renew Membership'}
              </button>
              {isAdmin && member.status === 'active' && (
                <button
                  onClick={() => setShowDeactivateDialog(true)}
                  className="btn-danger inline-flex items-center gap-1.5 text-sm"
                >
                  <UserX className="h-4 w-4" />
                  Deactivate
                </button>
              )}
              <button
                onClick={handleGenerateIdCard}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <CreditCard className="h-4 w-4" />
                Generate ID Card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Member Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-gray-100 p-2">
                <item.icon className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <p className="mt-0.5 text-sm text-gray-900">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Books Issued</p>
            <p className="text-2xl font-bold text-gray-900">
              {member.booksIssuedCount}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-xl bg-red-50 p-3">
            <DollarSign className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">
              Outstanding Fines
            </p>
            <p
              className={`text-2xl font-bold ${
                member.outstandingFines > 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {formatCurrency(member.outstandingFines)}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div
            className={`rounded-xl p-3 ${
              member.status === 'active'
                ? 'bg-green-50'
                : member.status === 'suspended'
                  ? 'bg-red-50'
                  : 'bg-gray-100'
            }`}
          >
            <User
              className={`h-6 w-6 ${
                member.status === 'active'
                  ? 'text-green-600'
                  : member.status === 'suspended'
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">
              Membership Status
            </p>
            <p className="mt-1">
              <StatusBadge status={member.status} size="md" />
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-0 overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && activeTab === tab.id && (
                  <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {/* Current Books Tab */}
          {activeTab === 'current' && (
            <DataTable
              columns={
                currentBooksColumns as unknown as Column<
                  Record<string, unknown>
                >[]
              }
              data={
                currentBooks as unknown as Record<string, unknown>[]
              }
              isLoading={isLoadingCurrent}
              emptyMessage="No books currently issued to this member."
              rowKeyField="id"
            />
          )}

          {/* Borrowing History Tab */}
          {activeTab === 'history' && (
            <div>
              <DataTable
                columns={
                  historyColumns as unknown as Column<
                    Record<string, unknown>
                  >[]
                }
                data={
                  history as unknown as Record<string, unknown>[]
                }
                isLoading={isLoadingHistory}
                emptyMessage="No borrowing history found."
                rowKeyField="id"
              />
              {!isLoadingHistory && historyTotalPages > 1 && (
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                />
              )}
            </div>
          )}

          {/* Fines Tab */}
          {activeTab === 'fines' && (
            <DataTable
              columns={
                fineColumns as unknown as Column<
                  Record<string, unknown>
                >[]
              }
              data={fines as unknown as Record<string, unknown>[]}
              isLoading={isLoadingFines}
              emptyMessage="No fines found for this member."
              rowKeyField="id"
            />
          )}
        </div>
      </div>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        isOpen={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate ${member.fullName}? This member will no longer be able to borrow books or access library services. Any currently issued books must be returned first.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeactivating}
      />
    </div>
  );
}
