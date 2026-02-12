import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Eye,
  EyeOff,
  LogIn,
  Library,
  BookMarked,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials } from '@/types';

interface LoginFormValues extends LoginCredentials {
  rememberMe: boolean;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginFormValues>({
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    setFocus('username');
  }, [setFocus]);

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login({ username: data.username, password: data.password });
      toast.success('Welcome back! Login successful.');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const message =
        err?.response?.data?.error?.message ||
        'Invalid credentials. Please check your username and password.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-white rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm">
              <Library className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">LibraryMS</h1>
              <p className="text-xs text-primary-200">Management System</p>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Manage Your Library
              <span className="block text-primary-200">Effortlessly</span>
            </h2>
            <p className="mt-6 text-lg text-primary-100 leading-relaxed">
              A comprehensive library management solution that helps you track
              books, manage members, handle transactions, and generate reports
              with ease.
            </p>

            {/* Feature highlights */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                  <BookMarked className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Book Catalog
                  </p>
                  <p className="text-xs text-primary-200">
                    Complete inventory
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Member Mgmt
                  </p>
                  <p className="text-xs text-primary-200">Full lifecycle</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Transactions
                  </p>
                  <p className="text-xs text-primary-200">Issue & return</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Role-Based
                  </p>
                  <p className="text-xs text-primary-200">Secure access</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-primary-300">
            &copy; {new Date().getFullYear()} LibraryMS. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="mb-8 lg:hidden flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600">
              <Library className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">LibraryMS</h1>
              <p className="text-xs text-gray-500">Management System</p>
            </div>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Sign in to your account to continue managing the library.
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                className={`input-field ${errors.username ? 'input-error' : ''}`}
                {...register('username', {
                  required: 'Username is required',
                })}
              />
              {errors.username && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`input-field pr-10 ${errors.password ? 'input-error' : ''}`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors"
                  {...register('rememberMe')}
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Help text */}
          <div className="mt-8 rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs text-gray-500 text-center">
              Having trouble signing in? Contact your library administrator for
              assistance with account access or password resets.
            </p>
          </div>

          {/* Mobile footer */}
          <p className="mt-8 text-center text-xs text-gray-400 lg:hidden">
            &copy; {new Date().getFullYear()} LibraryMS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
