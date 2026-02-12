import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  BarChart3,
  BookOpen,
  Package,
  AlertTriangle,
  Users,
  ArrowLeftRight,
  DollarSign,
  Download,
  FileText,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { reportService } from '@/services/report.service';
import { DashboardStats } from '@/types';
import StatsCard from '@/components/common/StatsCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type ReportType =
  | 'dashboard'
  | 'popular'
  | 'inventory'
  | 'overdue'
  | 'members'
  | 'transactions'
  | 'financial';

interface ReportOption {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  needsDateRange: boolean;
}

const reportOptions: ReportOption[] = [
  {
    id: 'dashboard',
    label: 'Dashboard Overview',
    description: 'Key metrics and statistics',
    icon: <BarChart3 className="h-6 w-6" />,
    color: 'text-primary-600 bg-primary-50',
    needsDateRange: false,
  },
  {
    id: 'popular',
    label: 'Popular Books',
    description: 'Most borrowed books ranking',
    icon: <TrendingUp className="h-6 w-6" />,
    color: 'text-yellow-600 bg-yellow-50',
    needsDateRange: false,
  },
  {
    id: 'inventory',
    label: 'Inventory Status',
    description: 'Books by category and condition',
    icon: <Package className="h-6 w-6" />,
    color: 'text-green-600 bg-green-50',
    needsDateRange: false,
  },
  {
    id: 'overdue',
    label: 'Overdue Books',
    description: 'Currently overdue items',
    icon: <AlertTriangle className="h-6 w-6" />,
    color: 'text-red-600 bg-red-50',
    needsDateRange: false,
  },
  {
    id: 'members',
    label: 'Member Statistics',
    description: 'Membership analytics',
    icon: <Users className="h-6 w-6" />,
    color: 'text-blue-600 bg-blue-50',
    needsDateRange: false,
  },
  {
    id: 'transactions',
    label: 'Transaction Report',
    description: 'Transaction summary for period',
    icon: <ArrowLeftRight className="h-6 w-6" />,
    color: 'text-purple-600 bg-purple-50',
    needsDateRange: true,
  },
  {
    id: 'financial',
    label: 'Financial Report',
    description: 'Fines collection summary',
    icon: <DollarSign className="h-6 w-6" />,
    color: 'text-emerald-600 bg-emerald-50',
    needsDateRange: true,
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('dashboard');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Report data
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [popularData, setPopularData] = useState<
    { bookId: string; title: string; author: string; count: number }[]
  >([]);
  const [inventoryData, setInventoryData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [overdueData, setOverdueData] = useState<Record<string, unknown>[]>([]);
  const [memberData, setMemberData] = useState<Record<string, unknown> | null>(null);
  const [transactionData, setTransactionData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [financialData, setFinancialData] = useState<Record<string, unknown> | null>(
    null,
  );

  const activeOption = reportOptions.find((r) => r.id === selectedReport)!;

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      switch (selectedReport) {
        case 'dashboard': {
          const res = await reportService.getDashboard();
          setDashboardData(res.data);
          break;
        }
        case 'popular': {
          const res = await reportService.getPopularBooks(20);
          setPopularData(res.data);
          break;
        }
        case 'inventory': {
          const res = await reportService.getInventoryStatus();
          setInventoryData(res.data);
          break;
        }
        case 'overdue': {
          const res = await reportService.getOverdueReport();
          setOverdueData(res.data);
          break;
        }
        case 'members': {
          const res = await reportService.getMemberStats();
          setMemberData(res.data);
          break;
        }
        case 'transactions': {
          const res = await reportService.getTransactionReport(
            dateFrom || undefined,
            dateTo || undefined,
          );
          setTransactionData(res.data);
          break;
        }
        case 'financial': {
          const res = await reportService.getFinancialReport(
            dateFrom || undefined,
            dateTo || undefined,
          );
          setFinancialData(res.data);
          break;
        }
      }
    } catch {
      toast.error('Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [selectedReport, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const blob = await reportService.exportReport(selectedReport, 'csv', {
        fromDate: dateFrom,
        toDate: dateTo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report exported as CSV');
    } catch {
      // Fallback: create CSV from current data
      try {
        let csvContent = '';
        switch (selectedReport) {
          case 'popular':
            csvContent = 'Rank,Title,Author,Borrow Count\n';
            popularData.forEach((book, idx) => {
              csvContent += `${idx + 1},"${book.title}","${book.author}",${book.count}\n`;
            });
            break;
          case 'overdue':
            csvContent = 'Book,Member,Due Date,Days Overdue\n';
            overdueData.forEach((item) => {
              csvContent += `"${item.bookTitle ?? ''}","${item.memberName ?? ''}","${item.dueDate ?? ''}",${item.daysOverdue ?? ''}\n`;
            });
            break;
          default:
            csvContent = JSON.stringify(
              dashboardData ?? inventoryData ?? memberData ?? transactionData ?? financialData,
              null,
              2,
            );
        }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedReport}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Report exported as CSV');
      } catch {
        toast.error('Failed to export report');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await reportService.exportReport(selectedReport, 'pdf', {
        fromDate: dateFrom,
        toDate: dateTo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report exported as PDF');
    } catch {
      toast.error('PDF export is not available from the server. Try CSV instead.');
    } finally {
      setExporting(false);
    }
  };

  const renderStatValue = (data: Record<string, unknown> | null, key: string) => {
    if (!data || data[key] == null) return '0';
    const val = data[key];
    if (typeof val === 'number') return val.toLocaleString();
    return String(val);
  };

  const renderDashboardReport = () => {
    if (!dashboardData) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Books"
            value={dashboardData.totalBooks}
            icon={BookOpen}
            iconColor="text-primary-600"
            iconBgColor="bg-primary-50"
          />
          <StatsCard
            title="Available Books"
            value={dashboardData.availableBooks}
            icon={Package}
            iconColor="text-green-600"
            iconBgColor="bg-green-50"
          />
          <StatsCard
            title="Active Members"
            value={dashboardData.activeMembers}
            icon={Users}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-50"
          />
          <StatsCard
            title="Overdue Books"
            value={dashboardData.overdueBooks}
            icon={AlertTriangle}
            iconColor="text-red-600"
            iconBgColor="bg-red-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard
            title="Today's Issues"
            value={dashboardData.todayIssues}
            icon={ArrowLeftRight}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-50"
          />
          <StatsCard
            title="Today's Returns"
            value={dashboardData.todayReturns}
            icon={ArrowLeftRight}
            iconColor="text-emerald-600"
            iconBgColor="bg-emerald-50"
          />
          <StatsCard
            title="Outstanding Fines"
            value={`$${dashboardData.totalFinesOutstanding.toFixed(2)}`}
            icon={DollarSign}
            iconColor="text-yellow-600"
            iconBgColor="bg-yellow-50"
          />
        </div>

        {dashboardData.popularCategories.length > 0 && (
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Popular Categories
            </h3>
            <div className="space-y-3">
              {dashboardData.popularCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width: `${
                            (cat.count /
                              Math.max(
                                ...dashboardData.popularCategories.map((c) => c.count),
                              )) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="min-w-[3rem] text-right text-sm font-medium text-gray-500">
                      {cat.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPopularReport = () => (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Most Borrowed Books
      </h3>
      {popularData.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No data available</p>
      ) : (
        <div className="space-y-3">
          {popularData.map((book, idx) => (
            <div
              key={book.bookId}
              className="flex items-center gap-4 rounded-lg border border-gray-100 p-3"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  idx < 3
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{book.title}</p>
                <p className="text-xs text-gray-500">{book.author}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary-600">{book.count}</p>
                <p className="text-xs text-gray-400">borrows</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderInventoryReport = () => {
    if (!inventoryData) return null;
    const byCategory = (inventoryData.byCategory as Record<string, number>[]) ?? [];
    const byCondition = (inventoryData.byCondition as Record<string, number>[]) ?? [];
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Books by Category
          </h3>
          {Array.isArray(byCategory) && byCategory.length > 0 ? (
            <div className="space-y-2">
              {byCategory.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-700">
                    {(item as Record<string, unknown>).category as string ??
                      (item as Record<string, unknown>).name as string ??
                      `Category ${idx + 1}`}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {(item as Record<string, unknown>).count as number ??
                      (item as Record<string, unknown>)._count as number ??
                      0}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              {renderStatValue(inventoryData, 'totalBooks')} total books in inventory
            </p>
          )}
        </div>
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Books by Condition
          </h3>
          {Array.isArray(byCondition) && byCondition.length > 0 ? (
            <div className="space-y-2">
              {byCondition.map((item, idx) => {
                const conditionColors: Record<string, string> = {
                  excellent: 'bg-green-100 text-green-800',
                  good: 'bg-blue-100 text-blue-800',
                  fair: 'bg-yellow-100 text-yellow-800',
                  poor: 'bg-red-100 text-red-800',
                };
                const condition = ((item as Record<string, unknown>).condition as string) ?? '';
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        conditionColors[condition] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {condition || `Condition ${idx + 1}`}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {(item as Record<string, unknown>).count as number ??
                        (item as Record<string, unknown>)._count as number ??
                        0}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">No condition data</p>
          )}
        </div>
      </div>
    );
  };

  const renderOverdueReport = () => (
    <div className="card">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Overdue Books ({overdueData.length})
      </h3>
      {overdueData.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <AlertTriangle className="mb-2 h-8 w-8 text-green-400" />
          <p className="text-sm text-gray-500">No overdue books -- great job!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overdueData.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {(item.bookTitle as string) ?? (item.title as string) ?? 'Unknown Book'}
                </p>
                <p className="text-xs text-gray-500">
                  Member: {(item.memberName as string) ?? (item.member as string) ?? 'Unknown'}
                </p>
                {item.dueDate != null && (
                  <p className="text-xs text-gray-400">
                    Due: {format(new Date(item.dueDate as string), 'MMM dd, yyyy')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-600">
                  {(item.daysOverdue as number) ?? 0}
                </p>
                <p className="text-xs text-red-500">days overdue</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMemberReport = () => {
    if (!memberData) return null;
    const byType = (memberData.byType as Record<string, unknown>[]) ?? [];
    const topBorrowers = (memberData.topBorrowers as Record<string, unknown>[]) ?? [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard
            title="Total Members"
            value={renderStatValue(memberData, 'totalMembers')}
            icon={Users}
            iconColor="text-primary-600"
            iconBgColor="bg-primary-50"
          />
          <StatsCard
            title="Active Members"
            value={renderStatValue(memberData, 'activeMembers')}
            icon={Users}
            iconColor="text-green-600"
            iconBgColor="bg-green-50"
          />
          <StatsCard
            title="Inactive Members"
            value={renderStatValue(memberData, 'inactiveMembers')}
            icon={Users}
            iconColor="text-gray-600"
            iconBgColor="bg-gray-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Members by Type
            </h3>
            {Array.isArray(byType) && byType.length > 0 ? (
              <div className="space-y-2">
                {byType.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="text-sm capitalize text-gray-700">
                      {(item.memberType as string) ?? (item.type as string) ?? `Type ${idx + 1}`}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {(item.count as number) ?? (item._count as number) ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">No type data</p>
            )}
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Top Borrowers
            </h3>
            {Array.isArray(topBorrowers) && topBorrowers.length > 0 ? (
              <div className="space-y-2">
                {topBorrowers.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700">
                      {(item.fullName as string) ?? (item.name as string) ?? `Member ${idx + 1}`}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {(item.borrowCount as number) ?? (item.count as number) ?? 0} books
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">
                No borrower data
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionReport = () => {
    if (!transactionData) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatsCard
            title="Total"
            value={renderStatValue(transactionData, 'total')}
            icon={ArrowLeftRight}
            iconColor="text-primary-600"
            iconBgColor="bg-primary-50"
          />
          <StatsCard
            title="Issued"
            value={renderStatValue(transactionData, 'issued')}
            icon={BookOpen}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-50"
          />
          <StatsCard
            title="Returned"
            value={renderStatValue(transactionData, 'returned')}
            icon={BookOpen}
            iconColor="text-green-600"
            iconBgColor="bg-green-50"
          />
          <StatsCard
            title="Overdue"
            value={renderStatValue(transactionData, 'overdue')}
            icon={AlertTriangle}
            iconColor="text-red-600"
            iconBgColor="bg-red-50"
          />
        </div>
        {transactionData.renewals != null && (
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Additional Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Renewals</p>
                <p className="text-lg font-bold text-gray-900">
                  {renderStatValue(transactionData, 'renewals')}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400">Average Duration</p>
                <p className="text-lg font-bold text-gray-900">
                  {renderStatValue(transactionData, 'avgDuration')} days
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFinancialReport = () => {
    if (!financialData) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard
            title="Fines Collected"
            value={`$${Number(financialData.collected ?? financialData.totalCollected ?? 0).toFixed(2)}`}
            icon={DollarSign}
            iconColor="text-green-600"
            iconBgColor="bg-green-50"
          />
          <StatsCard
            title="Outstanding"
            value={`$${Number(financialData.outstanding ?? financialData.totalOutstanding ?? 0).toFixed(2)}`}
            icon={DollarSign}
            iconColor="text-red-600"
            iconBgColor="bg-red-50"
          />
          <StatsCard
            title="Waived"
            value={`$${Number(financialData.waived ?? financialData.totalWaived ?? 0).toFixed(2)}`}
            icon={DollarSign}
            iconColor="text-gray-600"
            iconBgColor="bg-gray-50"
          />
        </div>

        {financialData.byType != null && Array.isArray(financialData.byType) && (
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Fines by Type
            </h3>
            <div className="space-y-2">
              {(financialData.byType as Record<string, unknown>[]).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm capitalize text-gray-700">
                    {(item.fineType as string) ?? (item.type as string) ?? `Type ${idx + 1}`}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${Number((item.total as number) ?? (item.amount as number) ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReport = () => {
    switch (selectedReport) {
      case 'dashboard':
        return renderDashboardReport();
      case 'popular':
        return renderPopularReport();
      case 'inventory':
        return renderInventoryReport();
      case 'overdue':
        return renderOverdueReport();
      case 'members':
        return renderMemberReport();
      case 'transactions':
        return renderTransactionReport();
      case 'financial':
        return renderFinancialReport();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and export library reports
        </p>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reportOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelectedReport(option.id)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              selectedReport === option.id
                ? 'border-primary-300 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className={`rounded-lg p-2 ${option.color}`}>{option.icon}</div>
            <div>
              <p
                className={`text-sm font-semibold ${
                  selectedReport === option.id
                    ? 'text-primary-900'
                    : 'text-gray-900'
                }`}
              >
                {option.label}
              </p>
              <p className="text-xs text-gray-500">{option.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Date Range */}
          <div className="flex items-center gap-4">
            {activeOption.needsDateRange && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              </>
            )}
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting || isLoading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || isLoading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {isLoading ? (
        <LoadingSpinner message={`Loading ${activeOption.label}...`} />
      ) : (
        renderReport()
      )}
    </div>
  );
}
