type BadgeType = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface StatusBadgeProps {
  status: string;
  type?: BadgeType;
  /** Alias for type (backward compatibility) */
  variant?: BadgeType;
  size?: 'sm' | 'md';
}

const statusTypeMap: Record<string, BadgeType> = {
  // Success statuses
  active: 'success',
  available: 'success',
  returned: 'success',
  paid: 'success',
  fulfilled: 'success',
  excellent: 'success',
  good: 'success',

  // Warning statuses
  issued: 'warning',
  pending: 'warning',
  fair: 'warning',

  // Danger statuses
  overdue: 'danger',
  suspended: 'danger',
  expired: 'danger',
  lost: 'danger',
  poor: 'danger',
  inactive: 'danger',
  cancelled: 'danger',

  // Info statuses
  reserved: 'info',
  waived: 'info',
};

const typeStyles: Record<BadgeType, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-800',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
};

export default function StatusBadge({ status, type, variant, size = 'md' }: StatusBadgeProps) {
  const resolvedType = type ?? variant ?? statusTypeMap[status.toLowerCase()] ?? 'default';
  const styles = typeStyles[resolvedType];

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold capitalize ${styles} ${sizeStyles[size]}`}
    >
      {status}
    </span>
  );
}
