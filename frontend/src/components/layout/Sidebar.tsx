import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  DollarSign,
  BookMarked,
  Search,
  BarChart3,
  Settings,
  ChevronLeft,
  Library,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const staffNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Books',
    path: '/books',
    icon: <BookOpen size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Members',
    path: '/members',
    icon: <Users size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Transactions',
    path: '/transactions',
    icon: <ArrowLeftRight size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Fines',
    path: '/fines',
    icon: <DollarSign size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Reservations',
    path: '/reservations',
    icon: <BookMarked size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Search',
    path: '/search',
    icon: <Search size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart3 size={20} />,
    roles: ['admin', 'librarian'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings size={20} />,
    roles: ['admin'],
  },
];

const memberNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard size={20} />,
    roles: ['member'],
  },
  {
    label: 'Search',
    path: '/search',
    icon: <Search size={20} />,
    roles: ['member'],
  },
  {
    label: 'My Books',
    path: '/transactions',
    icon: <BookOpen size={20} />,
    roles: ['member'],
  },
  {
    label: 'My Fines',
    path: '/fines',
    icon: <DollarSign size={20} />,
    roles: ['member'],
  },
  {
    label: 'My Reservations',
    path: '/reservations',
    icon: <BookMarked size={20} />,
    roles: ['member'],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const userRole = user?.role ?? 'member';

  const navItems = userRole === 'member' ? memberNavItems : staffNavItems;
  const filteredItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary-900 text-white
          transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center justify-between border-b border-primary-800 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
              <Library size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-wide">LibraryMS</h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-primary-300">
                Management System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary-300 hover:bg-primary-800 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {filteredItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-primary-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-xs font-bold uppercase">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user?.fullName ?? 'User'}</p>
              <p className="truncate text-xs capitalize text-primary-400">{userRole}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
