interface LoadingSpinnerProps {
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({
  fullPage = false,
  size = 'md',
  message,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`animate-spin rounded-full border-primary-200 border-t-primary-600 ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="text-sm font-medium text-gray-500">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  );
}
