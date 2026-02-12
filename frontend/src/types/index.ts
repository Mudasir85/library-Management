export type UserRole = 'admin' | 'librarian' | 'member';
export type UserStatus = 'active' | 'inactive';
export type BookCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type Gender = 'male' | 'female' | 'other';
export type MemberType = 'student' | 'faculty' | 'public';
export type MemberStatus = 'active' | 'suspended' | 'expired';
export type TransactionStatus = 'issued' | 'returned' | 'overdue';
export type FineType = 'overdue' | 'lost' | 'damage' | 'membership' | 'reservation_noshow';
export type PaymentMethod = 'cash' | 'card' | 'online';
export type FineStatus = 'pending' | 'paid' | 'waived';
export type ReservationStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string | null;
  status: UserStatus;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string | null;
  publicationYear: number | null;
  edition: string | null;
  category: string;
  language: string;
  pages: number | null;
  shelfLocation: string;
  callNumber: string;
  totalCopies: number;
  availableCopies: number;
  condition: BookCondition;
  purchaseDate: string | null;
  price: number | null;
  description: string | null;
  coverImageUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { transactions: number; reservations: number };
}

export interface Member {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string | null;
  memberType: MemberType;
  department: string | null;
  studentEmployeeId: string | null;
  photoUrl: string | null;
  registrationDate: string;
  expiryDate: string;
  status: MemberStatus;
  booksIssuedCount: number;
  outstandingFines: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface Transaction {
  id: string;
  memberId: string;
  bookId: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  renewalCount: number;
  fineAmount: number;
  finePaid: boolean;
  status: TransactionStatus;
  issuedById: string | null;
  returnedToId: string | null;
  createdAt: string;
  updatedAt: string;
  member?: Member;
  book?: Book;
  issuedBy?: User;
  returnedTo?: User;
  fines?: Fine[];
}

export interface Fine {
  id: string;
  transactionId: string | null;
  memberId: string;
  fineType: FineType;
  amount: number;
  paidAmount: number;
  paymentDate: string | null;
  paymentMethod: PaymentMethod | null;
  status: FineStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  transaction?: Transaction;
  member?: Member;
}

export interface Reservation {
  id: string;
  bookId: string;
  memberId: string;
  reservationDate: string;
  status: ReservationStatus;
  notificationSent: boolean;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  book?: Book;
  member?: Member;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  createdAt: string;
  subCategories?: Category[];
}

export interface SystemSetting {
  id: string;
  memberType: MemberType;
  maxBooksAllowed: number;
  loanDurationDays: number;
  renewalLimit: number;
  finePerDay: number;
  gracePeriodDays: number;
}

export interface DashboardStats {
  totalBooks: number;
  availableBooks: number;
  issuedBooks: number;
  totalMembers: number;
  activeMembers: number;
  overdueBooks: number;
  totalFinesOutstanding: number;
  todayIssues: number;
  todayReturns: number;
  newMembersThisMonth: number;
  popularCategories: { category: string; count: number }[];
  recentActivities: Transaction[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
