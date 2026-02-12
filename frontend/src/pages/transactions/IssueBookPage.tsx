import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  BookOpen,
  User,
  Loader2,
} from 'lucide-react';
import { transactionService } from '@/services/transaction.service';
import { memberService } from '@/services/member.service';
import { bookService } from '@/services/book.service';
import { Member, Book, Transaction } from '@/types';
import StatusBadge from '@/components/common/StatusBadge';

interface EligibilityCheck {
  label: string;
  passed: boolean;
  message: string;
}

export default function IssueBookPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);

  // Member search
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Book search
  const [bookQuery, setBookQuery] = useState('');
  const [bookSearching, setBookSearching] = useState(false);
  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Issue state
  const [issuing, setIssuing] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  // Eligibility
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);

  const searchMember = async () => {
    if (!memberQuery.trim()) return;
    setMemberSearching(true);
    setMemberResults([]);
    try {
      const response = await memberService.getAll({ search: memberQuery, limit: 5 });
      setMemberResults(response.data);
      if (response.data.length === 0) {
        toast.error('No members found');
      }
    } catch {
      toast.error('Failed to search members');
    } finally {
      setMemberSearching(false);
    }
  };

  const selectMember = (member: Member) => {
    setSelectedMember(member);
    setMemberResults([]);
    setStep(2);
  };

  const searchBook = async () => {
    if (!bookQuery.trim()) return;
    setBookSearching(true);
    setBookResults([]);
    try {
      const response = await bookService.getAll({ search: bookQuery, limit: 5 });
      setBookResults(response.data);
      if (response.data.length === 0) {
        toast.error('No books found');
      }
    } catch {
      toast.error('Failed to search books');
    } finally {
      setBookSearching(false);
    }
  };

  const selectBook = (book: Book) => {
    setSelectedBook(book);
    setBookResults([]);
    runEligibilityChecks(book);
  };

  const runEligibilityChecks = (book: Book) => {
    if (!selectedMember) return;
    const checks: EligibilityCheck[] = [
      {
        label: 'Member is active',
        passed: selectedMember.status === 'active',
        message:
          selectedMember.status === 'active'
            ? 'Member account is active'
            : `Member account is ${selectedMember.status}`,
      },
      {
        label: 'Under borrowing limit',
        passed: selectedMember.booksIssuedCount < 10,
        message:
          selectedMember.booksIssuedCount < 10
            ? `${selectedMember.booksIssuedCount} books issued (within limit)`
            : 'Maximum borrowing limit reached',
      },
      {
        label: 'No excessive fines',
        passed: selectedMember.outstandingFines < 50,
        message:
          selectedMember.outstandingFines < 50
            ? selectedMember.outstandingFines > 0
              ? `$${selectedMember.outstandingFines.toFixed(2)} outstanding (acceptable)`
              : 'No outstanding fines'
            : `$${selectedMember.outstandingFines.toFixed(2)} outstanding fines (exceeds limit)`,
      },
      {
        label: 'Book is available',
        passed: book.availableCopies > 0,
        message:
          book.availableCopies > 0
            ? `${book.availableCopies} of ${book.totalCopies} copies available`
            : 'No copies available',
      },
    ];
    setEligibilityChecks(checks);
  };

  const allChecksPassed =
    eligibilityChecks.length > 0 && eligibilityChecks.every((c) => c.passed);

  const handleIssueBook = async () => {
    if (!selectedMember || !selectedBook) return;
    setIssuing(true);
    try {
      const response = await transactionService.issueBook(
        selectedMember.id,
        selectedBook.id,
      );
      setReceipt(response.data);
      toast.success('Book issued successfully!');
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: { message?: string } } };
      };
      toast.error(error.response?.data?.error?.message ?? 'Failed to issue book');
    } finally {
      setIssuing(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setMemberQuery('');
    setSelectedMember(null);
    setBookQuery('');
    setSelectedBook(null);
    setEligibilityChecks([]);
    setReceipt(null);
    setMemberResults([]);
    setBookResults([]);
  };

  // Receipt view
  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/transactions')}
            className="btn-secondary p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Issue Receipt</h1>
        </div>

        <div className="card">
          <div className="mb-6 flex items-center justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
            Book Issued Successfully
          </h2>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">
                  Transaction ID
                </p>
                <p className="mt-1 font-mono text-sm text-gray-900">{receipt.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Issue Date</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {format(new Date(receipt.issueDate), 'MMMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Book</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {receipt.book?.title ?? selectedBook?.title}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Member</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {receipt.member?.fullName ?? selectedMember?.fullName}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium uppercase text-gray-400">Due Date</p>
                <p className="mt-1 text-lg font-bold text-primary-600">
                  {format(new Date(receipt.dueDate), 'MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button onClick={resetForm} className="btn-primary">
              Issue Another Book
            </button>
            <button
              onClick={() => navigate('/transactions')}
              className="btn-secondary"
            >
              Back to Transactions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/transactions')}
          className="btn-secondary p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Issue Book</h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue a book to a library member
          </p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            step >= 1
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <User className="h-4 w-4" />
          Step 1: Select Member
        </div>
        <div className="h-px flex-1 bg-gray-200" />
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            step >= 2
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Step 2: Select Book
        </div>
      </div>

      {/* Step 1: Member Selection */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {step === 1 ? 'Search Member' : 'Selected Member'}
        </h2>

        {step === 1 && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchMember()}
                  placeholder="Enter member ID, name, or email..."
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={searchMember}
                disabled={memberSearching || !memberQuery.trim()}
                className="btn-primary flex items-center gap-2"
              >
                {memberSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>

            {memberResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {memberResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => selectMember(member)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{member.fullName}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={member.memberType} />
                      <StatusBadge status={member.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedMember && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedMember.fullName}
                </p>
                <p className="text-sm text-gray-600">{selectedMember.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={selectedMember.memberType} />
                  <StatusBadge status={selectedMember.status} />
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">
                  Books Issued:{' '}
                  <span className="font-semibold text-gray-900">
                    {selectedMember.booksIssuedCount}
                  </span>
                </p>
                <p className="text-gray-500">
                  Outstanding Fines:{' '}
                  <span
                    className={`font-semibold ${
                      selectedMember.outstandingFines > 0
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}
                  >
                    ${selectedMember.outstandingFines.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
            {step === 2 && (
              <button
                onClick={() => {
                  setStep(1);
                  setSelectedMember(null);
                  setSelectedBook(null);
                  setEligibilityChecks([]);
                }}
                className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-800"
              >
                Change Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Book Selection */}
      {step === 2 && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Search Book</h2>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBook()}
                placeholder="Enter book ID, title, or ISBN..."
                className="input-field pl-10"
              />
            </div>
            <button
              onClick={searchBook}
              disabled={bookSearching || !bookQuery.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {bookSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </div>

          {bookResults.length > 0 && !selectedBook && (
            <div className="mt-4 space-y-2">
              {bookResults.map((book) => (
                <button
                  key={book.id}
                  onClick={() => selectBook(book)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{book.title}</p>
                    <p className="text-sm text-gray-500">
                      by {book.author} | ISBN: {book.isbn}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        book.availableCopies > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {book.availableCopies} / {book.totalCopies} available
                    </span>
                    <StatusBadge status={book.condition} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedBook && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedBook.title}
                  </p>
                  <p className="text-sm text-gray-600">by {selectedBook.author}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    ISBN: {selectedBook.isbn} | {selectedBook.category}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">
                    Available:{' '}
                    <span className="font-semibold text-gray-900">
                      {selectedBook.availableCopies} / {selectedBook.totalCopies}
                    </span>
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={selectedBook.condition} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBook(null);
                  setEligibilityChecks([]);
                }}
                className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-800"
              >
                Change Book
              </button>
            </div>
          )}
        </div>
      )}

      {/* Eligibility Checks */}
      {eligibilityChecks.length > 0 && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Eligibility Verification
          </h2>
          <div className="space-y-3">
            {eligibilityChecks.map((check, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  check.passed
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                {check.passed ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      check.passed ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {check.label}
                  </p>
                  <p
                    className={`text-xs ${
                      check.passed ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {check.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {allChecksPassed && (
            <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-4 text-center">
              <p className="text-sm text-gray-600">Expected Due Date</p>
              <p className="text-lg font-bold text-primary-700">
                {format(addDays(new Date(), 14), 'MMMM dd, yyyy')}
              </p>
              <p className="mt-1 text-xs text-gray-400">14-day default loan period</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => navigate('/transactions')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleIssueBook}
              disabled={!allChecksPassed || issuing}
              className="btn-primary flex items-center gap-2"
            >
              {issuing && <Loader2 className="h-4 w-4 animate-spin" />}
              {issuing ? 'Issuing...' : 'Issue Book'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
