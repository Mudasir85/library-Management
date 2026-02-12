import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  color?: string;
  /** Direct icon color class override (e.g. "text-primary-600") */
  iconColor?: string;
  /** Direct icon background class override (e.g. "bg-primary-50") */
  iconBgColor?: string;
  subtitle?: string;
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
  green: { bg: 'bg-green-50', icon: 'text-green-600' },
  red: { bg: 'bg-red-50', icon: 'text-red-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
  pink: { bg: 'bg-pink-50', icon: 'text-pink-600' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600' },
  primary: { bg: 'bg-primary-50', icon: 'text-primary-600' },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
  iconColor,
  iconBgColor,
  subtitle,
}: StatsCardProps) {
  const mapped = colorMap[color] ?? colorMap.primary;
  const resolvedIconColor = iconColor ?? mapped.icon;
  const resolvedIconBg = iconBgColor ?? mapped.bg;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend !== undefined && trend !== null && (
            <div className="mt-2 flex items-center gap-1">
              {trend >= 0 ? (
                <TrendingUp size={16} className="text-green-500" />
              ) : (
                <TrendingDown size={16} className="text-red-500" />
              )}
              <span
                className={`text-xs font-semibold ${
                  trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend >= 0 ? '+' : ''}
                {trend}%
              </span>
              <span className="text-xs text-gray-400">vs last month</span>
            </div>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-xl p-3 ${resolvedIconBg}`}>
          <Icon size={24} className={resolvedIconColor} />
        </div>
      </div>
    </div>
  );
}
