import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, Library, CheckCircle, Send } from 'lucide-react';
import { authService } from '@/services/auth.service';

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast.success('Password reset instructions sent to your email.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const message =
        err?.response?.data?.error?.message ||
        'Something went wrong. Please try again later.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link to="/login" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary-600 shadow-lg shadow-primary-600/20">
              <Library className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">LibraryMS</h1>
              <p className="text-xs text-gray-500">Management System</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {isSubmitted ? (
            /* Success State */
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-5">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Check your email
              </h2>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">
                We have sent password reset instructions to{' '}
                <span className="font-medium text-gray-700">
                  {submittedEmail}
                </span>
                . Please check your inbox and follow the link to reset your
                password.
              </p>
              <div className="mt-6 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs text-blue-700">
                  Did not receive the email? Check your spam folder, or make
                  sure the email address you entered is correct. The link will
                  expire in 1 hour.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setSubmittedEmail('');
                  }}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Try a different email
                </button>
                <Link
                  to="/login"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            /* Form State */
            <>
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-5">
                  <Mail className="h-8 w-8 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Forgot your password?
                </h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  No worries. Enter the email address associated with your
                  account and we will send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Email field */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`input-field ${errors.email ? 'input-error' : ''}`}
                    {...register('email', {
                      required: 'Email address is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="mt-1.5 text-sm text-red-600" role="alert">
                      {errors.email.message}
                    </p>
                  )}
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
                      Sending instructions...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send reset instructions
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back to login link (shown below card in form state) */}
        {!isSubmitted && (
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} LibraryMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
