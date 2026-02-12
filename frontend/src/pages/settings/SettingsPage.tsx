import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Settings,
  Users,
  FolderTree,
  Save,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import {
  User,
  UserRole,
  Category,
  SystemSetting,
  MemberType,
} from '@/types';
import DataTable, { Column } from '@/components/common/DataTable';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import api from '@/services/api';

type SettingsSection = 'system' | 'users' | 'categories';

interface UserFormData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

interface CategoryFormData {
  name: string;
  description: string;
}

interface SettingEditState {
  [memberType: string]: {
    maxBooksAllowed: number;
    loanDurationDays: number;
    renewalLimit: number;
    finePerDay: number;
    gracePeriodDays: number;
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Active section
  const [activeSection, setActiveSection] = useState<SettingsSection>('system');

  // System settings
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [editedSettings, setEditedSettings] = useState<SettingEditState>({});
  const [savingSettings, setSavingSettings] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deletingCategoryLoading, setDeletingCategoryLoading] = useState(false);

  // Forms
  const {
    register: registerUser,
    handleSubmit: handleSubmitUser,
    reset: resetUserForm,
    formState: { errors: userErrors },
  } = useForm<UserFormData>();

  const {
    register: registerCategory,
    handleSubmit: handleSubmitCategory,
    reset: resetCategoryForm,
    setValue: setCategoryValue,
    formState: { errors: categoryErrors },
  } = useForm<CategoryFormData>();

  // ---- Fetch Functions ----

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await api.get('/settings');
      const data = response.data.data ?? response.data;
      const settingsArray = Array.isArray(data) ? data : [data];
      setSettings(settingsArray);

      // Initialize edit state
      const editState: SettingEditState = {};
      settingsArray.forEach((s: SystemSetting) => {
        editState[s.memberType] = {
          maxBooksAllowed: s.maxBooksAllowed,
          loanDurationDays: s.loanDurationDays,
          renewalLimit: s.renewalLimit,
          finePerDay: s.finePerDay,
          gracePeriodDays: s.gracePeriodDays,
        };
      });
      setEditedSettings(editState);
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await api.get('/users');
      const data = response.data.data ?? response.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await api.get('/categories');
      const data = response.data.data ?? response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers();
    } else if (activeSection === 'categories') {
      fetchCategories();
    }
  }, [activeSection, fetchUsers, fetchCategories]);

  // ---- Setting Handlers ----

  const handleSettingChange = (
    memberType: string,
    field: string,
    value: number,
  ) => {
    setEditedSettings((prev) => ({
      ...prev,
      [memberType]: {
        ...prev[memberType],
        [field]: value,
      },
    }));
  };

  const hasSettingChanged = (setting: SystemSetting): boolean => {
    const edited = editedSettings[setting.memberType];
    if (!edited) return false;
    return (
      edited.maxBooksAllowed !== setting.maxBooksAllowed ||
      edited.loanDurationDays !== setting.loanDurationDays ||
      edited.renewalLimit !== setting.renewalLimit ||
      edited.finePerDay !== setting.finePerDay ||
      edited.gracePeriodDays !== setting.gracePeriodDays
    );
  };

  const handleSaveSetting = async (memberType: MemberType) => {
    const edited = editedSettings[memberType];
    if (!edited) return;

    setSavingSettings(memberType);
    try {
      await api.put(`/settings/${memberType}`, edited);
      toast.success(`Settings for ${memberType} updated successfully`);
      fetchSettings();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to update settings',
      );
    } finally {
      setSavingSettings(null);
    }
  };

  // ---- User Handlers ----

  const handleCreateUser = async (data: UserFormData) => {
    setCreatingUser(true);
    try {
      await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
      });
      toast.success('User created successfully');
      setCreateUserModalOpen(false);
      resetUserForm();
      fetchUsers();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to create user',
      );
    } finally {
      setCreatingUser(false);
    }
  };

  // ---- Category Handlers ----

  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    resetCategoryForm({ name: '', description: '' });
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryValue('name', category.name);
    setCategoryValue('description', category.description ?? '');
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (data: CategoryFormData) => {
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, {
          name: data.name,
          description: data.description || null,
        });
        toast.success('Category updated successfully');
      } else {
        await api.post('/categories', {
          name: data.name,
          description: data.description || null,
        });
        toast.success('Category created successfully');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      resetCategoryForm();
      fetchCategories();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to save category',
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setDeletingCategoryLoading(true);
    try {
      await api.delete(`/categories/${deletingCategory.id}`);
      toast.success('Category deleted successfully');
      setDeleteCategoryDialogOpen(false);
      setDeletingCategory(null);
      fetchCategories();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(
        error.response?.data?.error?.message ?? 'Failed to delete category',
      );
    } finally {
      setDeletingCategoryLoading(false);
    }
  };

  // ---- Columns ----

  const userColumns: Column<User>[] = [
    {
      accessor: 'fullName',
      header: 'Name',
      render: (_val: unknown, row: User) => (
        <span className="font-medium text-gray-900">{row.fullName}</span>
      ),
    },
    {
      accessor: 'username',
      header: 'Username',
    },
    {
      accessor: 'email',
      header: 'Email',
    },
    {
      accessor: 'role',
      header: 'Role',
      render: (_val: unknown, row: User) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            row.role === 'admin'
              ? 'bg-purple-100 text-purple-800'
              : row.role === 'librarian'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
          }`}
        >
          {row.role}
        </span>
      ),
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (_val: unknown, row: User) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            row.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  const categoryColumns: Column<Category>[] = [
    {
      accessor: 'name',
      header: 'Name',
      render: (_val: unknown, row: Category) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      accessor: 'description',
      header: 'Description',
      render: (_val: unknown, row: Category) => (
        <span className="text-gray-500">{row.description ?? '\u2014'}</span>
      ),
    },
    {
      accessor: 'id',
      header: 'Actions',
      render: (_val: unknown, row: Category) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditCategoryModal(row);
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit category"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingCategory(row);
              setDeleteCategoryDialogOpen(true);
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---- Access Check ----
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
        <p className="mt-2 text-gray-500">
          Only administrators can access system settings.
        </p>
      </div>
    );
  }

  // ---- Section Tabs ----
  const sections: { key: SettingsSection; label: string; icon: typeof Settings }[] = [
    { key: 'system', label: 'System Settings', icon: Settings },
    { key: 'users', label: 'User Management', icon: Users },
    { key: 'categories', label: 'Categories', icon: FolderTree },
  ];

  const memberTypeLabels: Record<MemberType, string> = {
    student: 'Student',
    faculty: 'Faculty',
    public: 'Public',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage system configuration, users, and categories
        </p>
      </div>

      {/* Section Tabs */}
      <div className="card">
        <div className="flex gap-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeSection === section.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* System Settings Section */}
      {activeSection === 'system' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Member Type Settings
            </h2>
          </div>

          {settingsLoading ? (
            <div className="card flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : settings.length === 0 ? (
            <div className="card">
              <p className="text-center text-gray-500 py-8">
                No system settings found. Settings may need to be initialized.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Member Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Max Books
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Loan Duration (days)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Renewal Limit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Fine Per Day ($)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Grace Period (days)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settings.map((setting) => {
                    const edited = editedSettings[setting.memberType];
                    const changed = hasSettingChanged(setting);
                    return (
                      <tr key={setting.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              setting.memberType === 'student'
                                ? 'bg-blue-100 text-blue-800'
                                : setting.memberType === 'faculty'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {memberTypeLabels[setting.memberType]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <input
                            type="number"
                            min={1}
                            value={edited?.maxBooksAllowed ?? setting.maxBooksAllowed}
                            onChange={(e) =>
                              handleSettingChange(
                                setting.memberType,
                                'maxBooksAllowed',
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <input
                            type="number"
                            min={1}
                            value={edited?.loanDurationDays ?? setting.loanDurationDays}
                            onChange={(e) =>
                              handleSettingChange(
                                setting.memberType,
                                'loanDurationDays',
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <input
                            type="number"
                            min={0}
                            value={edited?.renewalLimit ?? setting.renewalLimit}
                            onChange={(e) =>
                              handleSettingChange(
                                setting.memberType,
                                'renewalLimit',
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={edited?.finePerDay ?? setting.finePerDay}
                            onChange={(e) =>
                              handleSettingChange(
                                setting.memberType,
                                'finePerDay',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <input
                            type="number"
                            min={0}
                            value={edited?.gracePeriodDays ?? setting.gracePeriodDays}
                            onChange={(e) =>
                              handleSettingChange(
                                setting.memberType,
                                'gracePeriodDays',
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <button
                            onClick={() =>
                              handleSaveSetting(setting.memberType)
                            }
                            disabled={
                              !changed || savingSettings === setting.memberType
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {savingSettings === setting.memberType ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Settings Description */}
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              About Member Type Settings
            </h3>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>
                <strong>Max Books:</strong> Maximum number of books a member of
                this type can borrow at a time.
              </li>
              <li>
                <strong>Loan Duration:</strong> Number of days a book can be
                borrowed before it is due.
              </li>
              <li>
                <strong>Renewal Limit:</strong> Maximum number of times a loan
                can be renewed.
              </li>
              <li>
                <strong>Fine Per Day:</strong> The daily fine amount for overdue
                books.
              </li>
              <li>
                <strong>Grace Period:</strong> Number of days after the due date
                before fines begin accruing.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* User Management Section */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              User Management
            </h2>
            <button
              onClick={() => {
                resetUserForm({
                  username: '',
                  email: '',
                  password: '',
                  fullName: '',
                  role: 'member',
                });
                setCreateUserModalOpen(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create User
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <DataTable
              columns={userColumns}
              data={users}
              loading={usersLoading}
              emptyMessage="No users found."
            />
          </div>
        </div>
      )}

      {/* Category Management Section */}
      {activeSection === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Category Management
            </h2>
            <button
              onClick={openCreateCategoryModal}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <DataTable
              columns={categoryColumns}
              data={categories}
              loading={categoriesLoading}
              emptyMessage="No categories found."
            />
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={createUserModalOpen}
        onClose={() => {
          setCreateUserModalOpen(false);
          resetUserForm();
        }}
        title="Create New User"
        size="md"
      >
        <form onSubmit={handleSubmitUser(handleCreateUser)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              {...registerUser('fullName', {
                required: 'Full name is required',
              })}
              className={`input-field ${userErrors.fullName ? 'input-error' : ''}`}
              placeholder="Enter full name"
            />
            {userErrors.fullName && (
              <p className="mt-1 text-xs text-red-600">
                {userErrors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              {...registerUser('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters',
                },
              })}
              className={`input-field ${userErrors.username ? 'input-error' : ''}`}
              placeholder="Enter username"
            />
            {userErrors.username && (
              <p className="mt-1 text-xs text-red-600">
                {userErrors.username.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              {...registerUser('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
              className={`input-field ${userErrors.email ? 'input-error' : ''}`}
              placeholder="Enter email address"
            />
            {userErrors.email && (
              <p className="mt-1 text-xs text-red-600">
                {userErrors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              {...registerUser('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
              className={`input-field ${userErrors.password ? 'input-error' : ''}`}
              placeholder="Enter password"
            />
            {userErrors.password && (
              <p className="mt-1 text-xs text-red-600">
                {userErrors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              {...registerUser('role', { required: 'Role is required' })}
              className={`input-field ${userErrors.role ? 'input-error' : ''}`}
            >
              <option value="member">Member</option>
              <option value="librarian">Librarian</option>
              <option value="admin">Admin</option>
            </select>
            {userErrors.role && (
              <p className="mt-1 text-xs text-red-600">
                {userErrors.role.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateUserModalOpen(false);
                resetUserForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="btn-primary flex items-center gap-2"
            >
              {creatingUser && <Loader2 className="h-4 w-4 animate-spin" />}
              {creatingUser ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modal (Create/Edit) */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
          resetCategoryForm();
        }}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="sm"
      >
        <form
          onSubmit={handleSubmitCategory(handleSaveCategory)}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Category Name
            </label>
            <input
              type="text"
              {...registerCategory('name', {
                required: 'Category name is required',
              })}
              className={`input-field ${categoryErrors.name ? 'input-error' : ''}`}
              placeholder="Enter category name"
            />
            {categoryErrors.name && (
              <p className="mt-1 text-xs text-red-600">
                {categoryErrors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...registerCategory('description')}
              rows={3}
              className="input-field"
              placeholder="Enter category description (optional)"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCategoryModalOpen(false);
                setEditingCategory(null);
                resetCategoryForm();
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCategory}
              className="btn-primary flex items-center gap-2"
            >
              {savingCategory && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingCategory
                ? 'Saving...'
                : editingCategory
                  ? 'Update Category'
                  : 'Add Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Category Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteCategoryDialogOpen}
        onClose={() => {
          setDeleteCategoryDialogOpen(false);
          setDeletingCategory(null);
        }}
        onConfirm={handleDeleteCategory}
        title="Delete Category"
        message={
          deletingCategory
            ? `Are you sure you want to delete the category "${deletingCategory.name}"? This action cannot be undone. Books in this category may need to be reassigned.`
            : ''
        }
        confirmText="Delete"
        variant="danger"
        isLoading={deletingCategoryLoading}
      />
    </div>
  );
}
