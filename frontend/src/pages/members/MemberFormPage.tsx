import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { memberService } from '@/services/member.service';
import { Gender, MemberType } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface MemberFormData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | '';
  address: string;
  city: string;
  postalCode: string;
  memberType: MemberType;
  department: string;
  studentEmployeeId: string;
  userId: string;
}

const GENDER_OPTIONS: { value: Gender | ''; label: string }[] = [
  { value: '', label: 'Select gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const MEMBER_TYPE_OPTIONS: { value: MemberType; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'public', label: 'Public' },
];

export default function MemberFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [isLoadingMember, setIsLoadingMember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MemberFormData>({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      address: '',
      city: '',
      postalCode: '',
      memberType: 'student',
      department: '',
      studentEmployeeId: '',
      userId: '',
    },
  });

  useEffect(() => {
    if (!id) return;

    const fetchMember = async () => {
      setIsLoadingMember(true);
      try {
        const response = await memberService.getById(id);
        const member = response.data;
        reset({
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          dateOfBirth: member.dateOfBirth
            ? member.dateOfBirth.split('T')[0]
            : '',
          gender: member.gender || '',
          address: member.address,
          city: member.city,
          postalCode: member.postalCode || '',
          memberType: member.memberType,
          department: member.department || '',
          studentEmployeeId: member.studentEmployeeId || '',
          userId: member.userId,
        });
      } catch {
        toast.error('Failed to load member data.');
        navigate('/members');
      } finally {
        setIsLoadingMember(false);
      }
    };

    fetchMember();
  }, [id, reset, navigate]);

  const onSubmit = async (data: MemberFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        memberType: data.memberType,
        userId: data.userId,
      };

      if (data.dateOfBirth) {
        payload.dateOfBirth = data.dateOfBirth;
      }
      if (data.gender) {
        payload.gender = data.gender;
      }
      if (data.postalCode) {
        payload.postalCode = data.postalCode;
      }
      if (data.department) {
        payload.department = data.department;
      }
      if (data.studentEmployeeId) {
        payload.studentEmployeeId = data.studentEmployeeId;
      }

      if (isEditMode && id) {
        const response = await memberService.update(id, payload);
        toast.success('Member updated successfully.');
        navigate(`/members/${response.data.id}`);
      } else {
        const response = await memberService.create(payload);
        toast.success('Member created successfully.');
        navigate(`/members/${response.data.id}`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'An error occurred';
      toast.error(
        isEditMode
          ? `Failed to update member. ${message}`
          : `Failed to create member. ${message}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingMember) {
    return <LoadingSpinner message="Loading member data..." />;
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <Link
          to={isEditMode ? `/members/${id}` : '/members'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {isEditMode ? 'Back to Member' : 'Back to Members'}
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit Member' : 'Add New Member'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEditMode
            ? 'Update the member information below.'
            : 'Fill in the details below to register a new library member. Expiry date will be automatically set to 1 year from now.'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Personal Information */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Full Name */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="fullName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                {...register('fullName', {
                  required: 'Full name is required',
                  minLength: {
                    value: 2,
                    message: 'Name must be at least 2 characters',
                  },
                })}
                className={`input-field ${errors.fullName ? 'input-error' : ''}`}
                placeholder="Enter full name"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                className={`input-field ${errors.email ? 'input-error' : ''}`}
                placeholder="member@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                {...register('phone', {
                  required: 'Phone number is required',
                  minLength: {
                    value: 7,
                    message: 'Phone number must be at least 7 digits',
                  },
                })}
                className={`input-field ${errors.phone ? 'input-error' : ''}`}
                placeholder="Enter phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label
                htmlFor="dateOfBirth"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Date of Birth
              </label>
              <input
                id="dateOfBirth"
                type="date"
                {...register('dateOfBirth')}
                className="input-field"
              />
            </div>

            {/* Gender */}
            <div>
              <label
                htmlFor="gender"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Gender
              </label>
              <select
                id="gender"
                {...register('gender')}
                className="input-field"
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Address */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Address */}
            <div className="sm:col-span-2">
              <label
                htmlFor="address"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                rows={3}
                {...register('address', {
                  required: 'Address is required',
                })}
                className={`input-field resize-none ${errors.address ? 'input-error' : ''}`}
                placeholder="Enter full address"
              />
              {errors.address && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.address.message}
                </p>
              )}
            </div>

            {/* City */}
            <div>
              <label
                htmlFor="city"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                City <span className="text-red-500">*</span>
              </label>
              <input
                id="city"
                type="text"
                {...register('city', {
                  required: 'City is required',
                })}
                className={`input-field ${errors.city ? 'input-error' : ''}`}
                placeholder="Enter city"
              />
              {errors.city && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.city.message}
                </p>
              )}
            </div>

            {/* Postal Code */}
            <div>
              <label
                htmlFor="postalCode"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Postal Code
              </label>
              <input
                id="postalCode"
                type="text"
                {...register('postalCode')}
                className="input-field"
                placeholder="Enter postal code"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Membership */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Membership
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Member Type */}
            <div>
              <label
                htmlFor="memberType"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Member Type <span className="text-red-500">*</span>
              </label>
              <select
                id="memberType"
                {...register('memberType', {
                  required: 'Member type is required',
                })}
                className={`input-field ${errors.memberType ? 'input-error' : ''}`}
              >
                {MEMBER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.memberType && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.memberType.message}
                </p>
              )}
            </div>

            {/* Department */}
            <div>
              <label
                htmlFor="department"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Department
              </label>
              <input
                id="department"
                type="text"
                {...register('department')}
                className="input-field"
                placeholder="e.g., Computer Science"
              />
            </div>

            {/* Student/Employee ID */}
            <div>
              <label
                htmlFor="studentEmployeeId"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Student/Employee ID
              </label>
              <input
                id="studentEmployeeId"
                type="text"
                {...register('studentEmployeeId')}
                className="input-field"
                placeholder="e.g., STU-2024-001"
              />
            </div>

            {/* User ID */}
            <div>
              <label
                htmlFor="userId"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                User Account ID <span className="text-red-500">*</span>
              </label>
              <input
                id="userId"
                type="text"
                {...register('userId', {
                  required: 'User account ID is required',
                })}
                className={`input-field ${errors.userId ? 'input-error' : ''}`}
                placeholder="Enter user account ID to link"
              />
              {errors.userId && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.userId.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Link this member to an existing user account.
              </p>
            </div>
          </div>

          {!isEditMode && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                The membership expiry date will be automatically set to 1 year
                from the registration date.
              </p>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={isEditMode ? `/members/${id}` : '/members'}
            className="btn-secondary text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditMode ? 'Update Member' : 'Create Member'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
