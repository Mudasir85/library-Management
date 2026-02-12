import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Auth pages (lazy loaded)
const LoginPage = React.lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = React.lazy(() => import('@/pages/auth/ForgotPasswordPage'));

// Dashboard
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'));

// Books
const BooksListPage = React.lazy(() => import('@/pages/books/BooksListPage'));
const BookFormPage = React.lazy(() => import('@/pages/books/BookFormPage'));
const BookDetailPage = React.lazy(() => import('@/pages/books/BookDetailPage'));
const BulkImportPage = React.lazy(() => import('@/pages/books/BulkImportPage'));

// Members
const MembersListPage = React.lazy(() => import('@/pages/members/MembersListPage'));
const MemberFormPage = React.lazy(() => import('@/pages/members/MemberFormPage'));
const MemberDetailPage = React.lazy(() => import('@/pages/members/MemberDetailPage'));

// Transactions
const TransactionsPage = React.lazy(() => import('@/pages/transactions/TransactionsPage'));
const IssueBookPage = React.lazy(() => import('@/pages/transactions/IssueBookPage'));
const ReturnBookPage = React.lazy(() => import('@/pages/transactions/ReturnBookPage'));

// Other pages
const FinesPage = React.lazy(() => import('@/pages/fines/FinesPage'));
const ReservationsPage = React.lazy(() => import('@/pages/reservations/ReservationsPage'));
const SearchPage = React.lazy(() => import('@/pages/search/SearchPage'));
const ReportsPage = React.lazy(() => import('@/pages/reports/ReportsPage'));
const SettingsPage = React.lazy(() => import('@/pages/settings/SettingsPage'));

function SuspenseFallback() {
  return <LoadingSpinner fullPage message="Loading..." />;
}

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected routes wrapped in DashboardLayout */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />

          {/* Books */}
          <Route path="books" element={<BooksListPage />} />
          <Route path="books/new" element={<BookFormPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="books/:id/edit" element={<BookFormPage />} />
          <Route path="books/import" element={<BulkImportPage />} />

          {/* Members */}
          <Route path="members" element={<MembersListPage />} />
          <Route path="members/new" element={<MemberFormPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="members/:id/edit" element={<MemberFormPage />} />

          {/* Transactions */}
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/issue" element={<IssueBookPage />} />
          <Route path="transactions/return" element={<ReturnBookPage />} />

          {/* Other */}
          <Route path="fines" element={<FinesPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
