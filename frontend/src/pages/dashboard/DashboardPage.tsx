import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BookOpen,
  BookCheck,
  Users,
  UserCheck,
  AlertTriangle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Plus,
  CornerDownLeft,
  Search,
  BookMarked,
  CreditCard,
  RefreshCw,
  Clock,
  TrendingUp,
  ArrowRight,
  Library,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { reportService } from '@/services/report.service';
import { DashboardStats, Transaction } from '@/types';
import StatsCard from '@/components/common/StatsCard';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStaff = user?.role === 'admin' || user?.role === 'librarian';

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reportService.getDashboard();
      setStats(response.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(
        error?.response?.data?.error?.message ||
          'Failed to load dashboard data. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="rounded-full bg-red-50 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to Load Dashboard
        </h3>
        <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
          {error}
        </p>
        <button onClick={fetchDashboard} className="btn-primary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  if (isStaff) {
    return <AdminDashboard stats={stats} navigate={navigate} userName={user?.fullName || 'User'} />;
  }

  return <MemberDashboard stats={stats} navigate={navigate} user={user!} />;
}

/* ============================================================
   ADMIN / LIBRARIAN DASHBOARD
   ============================================================ */

interface AdminDashboardProps {
  stats: DashboardStats;
  navigate: ReturnType<typeof useNavigate>;
  userName: string;
}

function AdminDashboard({ stats, navigate, userName }: AdminDashboardProps) {
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {greeting}, {userName.split(' ')[0]}. Here is your library overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* Stats Grid - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatsCard
          title="Total Books"
          value={stats.totalBooks.toLocaleString()}
          icon={BookOpen}
          color="primary"
        />
        <StatsCard
          title="Available Books"
          value={stats.availableBooks.toLocaleString()}
          icon={BookCheck}
          color="green"
        />
        <StatsCard
          title="Issued Books"
          value={stats.issuedBooks.toLocaleString()}
          icon={ArrowUpRight}
          color="blue"
        />
        <StatsCard
          title="Total Members"
          value={stats.totalMembers.toLocaleString()}
          icon={Users}
          color="indigo"
        />
        <StatsCard
          title="Active Members"
          value={stats.activeMembers.toLocaleString()}
          icon={UserCheck}
          color="green"
        />
      </div>

      {/* Stats Grid - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatsCard
          title="Overdue Books"
          value={stats.overdueBooks.toLocaleString()}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Outstanding Fines"
          value={`$${stats.totalFinesOutstanding.toFixed(2)}`}
          icon={DollarSign}
          color="yellow"
        />
        <StatsCard
          title="Today's Issues"
          value={stats.todayIssues.toLocaleString()}
          icon={ArrowUpRight}
          color="blue"
        />
        <StatsCard
          title="Today's Returns"
          value={stats.todayReturns.toLocaleString()}
          icon={ArrowDownRight}
          color="green"
        />
        <StatsCard
          title="New Members (Month)"
          value={stats.newMembersThisMonth.toLocaleString()}
          icon={UserPlus}
          color="purple"
        />
      </div>

      {/* Middle Section: Quick Actions + Popular Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/transactions/issue')}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-primary-50 hover:border-primary-200 transition-colors group"
            >
              <div className="rounded-lg bg-primary-100 p-2.5 group-hover:bg-primary-200 transition-colors">
                <ArrowUpRight className="h-5 w-5 text-primary-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">
                Issue Book
              </span>
            </button>
            <button
              onClick={() => navigate('/transactions/return')}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-green-50 hover:border-green-200 transition-colors group"
            >
              <div className="rounded-lg bg-green-100 p-2.5 group-hover:bg-green-200 transition-colors">
                <CornerDownLeft className="h-5 w-5 text-green-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-green-700">
                Return Book
              </span>
            </button>
            <button
              onClick={() => navigate('/books/new')}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
            >
              <div className="rounded-lg bg-blue-100 p-2.5 group-hover:bg-blue-200 transition-colors">
                <Plus className="h-5 w-5 text-blue-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">
                Add Book
              </span>
            </button>
            <button
              onClick={() => navigate('/members/new')}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-violet-50 hover:border-violet-200 transition-colors group"
            >
              <div className="rounded-lg bg-violet-100 p-2.5 group-hover:bg-violet-200 transition-colors">
                <UserPlus className="h-5 w-5 text-violet-700" />
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-violet-700">
                Add Member
              </span>
            </button>
          </div>
        </div>

        {/* Popular Categories */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Popular Categories
            </h2>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          {stats.popularCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Library className="h-8 w-8 mb-2" />
              <p className="text-sm">No category data available yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.popularCategories.map((cat, index) => {
                const maxCount = stats.popularCategories[0]?.count || 1;
                const percentage = Math.round((cat.count / maxCount) * 100);
                return (
                  <div key={cat.category} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                          {cat.category}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {cat.count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          books
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
          <Link
            to="/transactions"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <RecentActivityTable transactions={stats.recentActivities} />
      </div>
    </div>
  );
}

/* ============================================================
   MEMBER DASHBOARD
   ============================================================ */

interface MemberDashboardProps {
  stats: DashboardStats;
  navigate: ReturnType<typeof useNavigate>;
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
}

function MemberDashboard({ stats, navigate, user }: MemberDashboardProps) {
  const greeting = getGreeting();

  // Derive member-specific stats from the dashboard data
  const borrowedBooks = stats.recentActivities.filter(
    (t) => t.status === 'issued'
  );
  const dueSoonBooks = borrowedBooks.filter((t) => {
    const dueDate = new Date(t.dueDate);
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    return dueDate <= threeDaysFromNow && dueDate >= now;
  });

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="card bg-gradient-to-r from-primary-600 to-primary-700 border-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {greeting}, {user.fullName.split(' ')[0]}!
            </h1>
            <p className="mt-1 text-sm text-primary-100">
              Welcome to your library dashboard. Here is your reading summary.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary-200">
            <Clock className="h-3.5 w-3.5" />
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Member Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Books Borrowed"
          value={borrowedBooks.length}
          icon={BookOpen}
          color="primary"
        />
        <StatsCard
          title="Due Soon (3 days)"
          value={dueSoonBooks.length}
          icon={AlertTriangle}
          color="yellow"
        />
        <StatsCard
          title="Outstanding Fines"
          value={`$${stats.totalFinesOutstanding.toFixed(2)}`}
          icon={DollarSign}
          color="red"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/books')}
          className="card flex items-center gap-4 hover:shadow-md hover:border-primary-200 transition-all group"
        >
          <div className="rounded-xl bg-primary-50 p-3 group-hover:bg-primary-100 transition-colors">
            <Search className="h-6 w-6 text-primary-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">
              Search Catalog
            </p>
            <p className="text-xs text-gray-500">Find and reserve books</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-primary-500 transition-colors" />
        </button>
        <button
          onClick={() => navigate('/reservations')}
          className="card flex items-center gap-4 hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="rounded-xl bg-blue-50 p-3 group-hover:bg-blue-100 transition-colors">
            <BookMarked className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">
              My Reservations
            </p>
            <p className="text-xs text-gray-500">View reserved books</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-blue-500 transition-colors" />
        </button>
        <button
          onClick={() => navigate('/fines')}
          className="card flex items-center gap-4 hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="rounded-xl bg-amber-50 p-3 group-hover:bg-amber-100 transition-colors">
            <CreditCard className="h-6 w-6 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">My Fines</p>
            <p className="text-xs text-gray-500">View and pay fines</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-amber-500 transition-colors" />
        </button>
      </div>

      {/* Currently Borrowed Books */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Currently Borrowed Books
          </h2>
          <span className="badge badge-blue">
            {borrowedBooks.length} {borrowedBooks.length === 1 ? 'book' : 'books'}
          </span>
        </div>
        {borrowedBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <BookOpen className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium text-gray-500">
              No books currently borrowed
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Visit the catalog to find your next read.
            </p>
            <button
              onClick={() => navigate('/books')}
              className="btn-primary mt-4 text-sm flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Book
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Issue Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {borrowedBooks.map((transaction) => {
                  const isOverdue = new Date(transaction.dueDate) < new Date();
                  const isDueSoon =
                    !isOverdue &&
                    new Date(transaction.dueDate) <=
                      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.book?.title || 'Unknown Book'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {transaction.book?.author || 'Unknown Author'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(new Date(transaction.issueDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-sm font-medium ${
                            isOverdue
                              ? 'text-red-600'
                              : isDueSoon
                                ? 'text-amber-600'
                                : 'text-gray-600'
                          }`}
                        >
                          {format(new Date(transaction.dueDate), 'MMM d, yyyy')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isOverdue ? (
                          <StatusBadge status="overdue" />
                        ) : isDueSoon ? (
                          <span className="badge badge-yellow">Due Soon</span>
                        ) : (
                          <StatusBadge status="issued" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function RecentActivityTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <BookOpen className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium text-gray-500">
          No recent activity
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Transaction activity will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Member
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Book
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {transactions.slice(0, 10).map((transaction) => (
            <tr
              key={transaction.id}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-700">
                      {getInitials(transaction.member?.fullName || 'N/A')}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                    {transaction.member?.fullName || 'Unknown Member'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-3.5">
                <span className="text-sm text-gray-700 truncate max-w-[200px] block">
                  {transaction.book?.title || 'Unknown Book'}
                </span>
              </td>
              <td className="px-6 py-3.5">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    transaction.returnDate
                      ? 'text-green-700'
                      : 'text-blue-700'
                  }`}
                >
                  {transaction.returnDate ? (
                    <>
                      <ArrowDownRight className="h-3 w-3" />
                      Return
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="h-3 w-3" />
                      Issue
                    </>
                  )}
                </span>
              </td>
              <td className="px-6 py-3.5 text-sm text-gray-500">
                {format(
                  new Date(transaction.returnDate || transaction.issueDate),
                  'MMM d, yyyy'
                )}
              </td>
              <td className="px-6 py-3.5">
                <StatusBadge status={transaction.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
