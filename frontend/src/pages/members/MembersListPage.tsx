import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Eye, Pencil, UserX, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { memberService } from '@/services/member.service';
import { Member, MemberType, MemberStatus } from '@/types';
import DataTable, { Column } from '@/components/common/DataTable';
import Pagination from '@/components/common/Pagination';
import SearchInput from '@/components/common/SearchInput';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const MEMBER_TYPE_OPTIONS: { value: MemberType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'public', label: 'Public' },
];

const STATUS_OPTIONS: { value: MemberStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
];

const memberTypeBadgeColors: Record<MemberType, string> = {
  student: 'bg-blue-100 text-blue-800',
  faculty: 'bg-purple-100 text-purple-800',
  public: 'bg-teal-100 text-teal-800',
};

const ITEMS_PER_PAGE = 10;

export default function MembersListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState<MemberType | ''>(
    (searchParams.get('type') as MemberType) || '',
  );
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>(
    (searchParams.get('status') as MemberStatus) || '',
  );
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page')) || 1,
  );

  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const isStaff = user?.role === 'admin' || user?.role === 'librarian';
  const isAdmin = user?.role === 'admin';

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.memberType = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await memberService.getAll(params);
      setMembers(response.data);
      setTotalPages(response.meta.totalPages);
    } catch {
      toast.error('Failed to load members. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (typeFilter) params.type = typeFilter;
    if (statusFilter) params.status = statusFilter;
    if (currentPage > 1) params.page = String(currentPage);
    setSearchParams(params, { replace: true });
  }, [search, typeFilter, statusFilter, currentPage, setSearchParams]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value as MemberType | '');
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as MemberStatus | '');
    setCurrentPage(1);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await memberService.deactivate(deactivateTarget.id);
      toast.success(`${deactivateTarget.fullName} has been deactivated.`);
      setDeactivateTarget(null);
      fetchMembers();
    } catch {
      toast.error('Failed to deactivate member. Please try again.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: Column<Member & Record<string, unknown>>[] = [
    {
      key: 'fullName',
      header: 'Name',
      render: (member: Member) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            {member.fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <Link
              to={`/members/${member.id}`}
              className="font-medium text-gray-900 hover:text-primary-600"
            >
              {member.fullName}
            </Link>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (member: Member) => (
        <span className="text-gray-600">{member.email}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (member: Member) => (
        <span className="text-gray-600">{member.phone}</span>
      ),
    },
    {
      key: 'memberType',
      header: 'Type',
      render: (member: Member) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            memberTypeBadgeColors[member.memberType]
          }`}
        >
          {member.memberType}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member: Member) => <StatusBadge status={member.status} />,
    },
    {
      key: 'booksIssuedCount',
      header: 'Books Issued',
      render: (member: Member) => (
        <span className="text-gray-700">{member.booksIssuedCount}</span>
      ),
    },
    {
      key: 'outstandingFines',
      header: 'Fines',
      render: (member: Member) => (
        <span
          className={
            member.outstandingFines > 0
              ? 'font-medium text-red-600'
              : 'text-gray-500'
          }
        >
          ${member.outstandingFines.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (member: Member) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/members/${member.id}`);
            }}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {isStaff && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/members/${member.id}/edit`);
              }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
              title="Edit member"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {isAdmin && member.status === 'active' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeactivateTarget(member);
              }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
              title="Deactivate member"
            >
              <UserX className="h-4 w-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage library members and their memberships
          </p>
        </div>
        {isStaff && (
          <Link to="/members/new" className="btn-primary inline-flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, email, or phone..."
            className="flex-1"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Filters:</span>
            </div>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="input-field sm:w-40"
            >
              {MEMBER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input-field sm:w-40"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={members as (Member & Record<string, unknown>)[]}
          isLoading={isLoading}
          emptyMessage={
            search || typeFilter || statusFilter
              ? 'No members match your search criteria.'
              : 'No members found. Add a new member to get started.'
          }
          rowKeyField="id"
        />
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="card p-0 overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Member"
        message={`Are you sure you want to deactivate ${deactivateTarget?.fullName}? This member will no longer be able to borrow books or access library services.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeactivating}
      />
    </div>
  );
}
