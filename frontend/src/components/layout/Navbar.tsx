import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, LogOut, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavbarProps {
  onMenuToggle: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const handleSearchClick = () => {
    navigate('/search');
  };

  const roleColorMap: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    librarian: 'bg-blue-100 text-blue-700',
    member: 'bg-green-100 text-green-700',
  };

  const roleBadgeClass = roleColorMap[user?.role ?? 'member'] ?? 'bg-gray-100 text-gray-700';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        <button
          onClick={handleSearchClick}
          className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 sm:flex"
        >
          <Search size={16} />
          <span>Search books, members...</span>
          <kbd className="ml-4 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-400">
            /
          </kbd>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search icon for mobile */}
        <button
          onClick={handleSearchClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:hidden"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <UserIcon size={16} />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-700">
                {user?.fullName ?? 'User'}
              </p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
              >
                {user?.role ?? 'member'}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`hidden text-gray-400 transition-transform sm:block ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.fullName ?? 'User'}
                </p>
                <p className="truncate text-xs text-gray-500">{user?.email ?? ''}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
