# Library Management System

A comprehensive, full-stack Library Management System built with **NestJS** (backend) and **React** (frontend), designed for managing books, members, transactions, fines, and reservations.

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **Prisma ORM** - Database toolkit with PostgreSQL
- **Passport.js** - JWT-based authentication
- **class-validator** - Request validation
- **Swagger/OpenAPI** - Auto-generated API documentation
- **Multer** - File upload handling (CSV import, member photos)

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router v6** - Client-side routing with lazy loading
- **React Hook Form** - Form handling and validation
- **Axios** - HTTP client with interceptors
- **Lucide React** - Icon library
- **date-fns** - Date utilities

### Database
- **PostgreSQL** - Primary database
- **Prisma** - ORM with migrations and seeding

## Features

### Book Management
- Full CRUD operations for books
- ISBN validation (10/13 digit)
- CSV bulk import with template download
- Soft delete to preserve transaction history
- Availability tracking (total/available copies)
- Category and shelf location management

### Member Management
- Member registration with role-based types (student, faculty, public)
- Profile management with photo upload
- Membership renewal and expiry tracking
- Borrowing history and fine summary
- ID card generation
- Deactivation workflow

### Transaction System
- Step-by-step book issuing with eligibility verification
- Book return with automatic fine calculation
- Renewal support (up to configurable limit)
- Overdue tracking and notifications
- Transaction receipts

### Fine & Penalty System
- Automatic overdue fine calculation
- Lost book and damage fines
- Partial and full payment processing
- Fine waiver (admin only)
- Outstanding fine tracking per member

### Reservation System
- Book reservation queue (FIFO)
- Maximum 3 active reservations per member
- Auto-expiry of stale reservations
- Fulfillment workflow

### Search & Catalog
- Full-text search across books
- Category browsing
- New arrivals and popular books
- Search suggestions/autocomplete

### Reports & Analytics
- Dashboard with role-specific views
- Popular books report
- Inventory status
- Overdue report
- Member statistics
- Transaction and financial reports
- CSV export

### User Roles & Access Control
| Feature | Admin | Librarian | Member |
|---------|-------|-----------|--------|
| Manage Books | Full | Full | View Only |
| Manage Members | Full | Full | Own Profile |
| Issue/Return Books | Yes | Yes | No |
| Manage Fines | Full + Waive | Process Payment | View Own |
| Reports | Full | Full | Limited |
| Settings | Full | View | No |
| User Registration | Yes | No | No |

## Project Structure

```
library-management-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Database seeding
│   ├── src/
│   │   ├── auth/                  # Authentication (JWT, guards, strategies)
│   │   ├── books/                 # Book CRUD, bulk import
│   │   ├── categories/            # Category management
│   │   ├── common/                # Shared DTOs, guards, filters, decorators, utils
│   │   ├── fines/                 # Fine management, payments
│   │   ├── members/               # Member management
│   │   ├── prisma/                # Prisma service (global)
│   │   ├── reports/               # Dashboard, analytics, exports
│   │   ├── reservations/          # Reservation queue
│   │   ├── search/                # Full-text search, catalog
│   │   ├── settings/              # System settings
│   │   ├── transactions/          # Issue, return, renew
│   │   ├── app.module.ts          # Root module
│   │   └── main.ts                # Bootstrap
│   ├── test/                      # E2E and unit tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Reusable UI components
│   │   │   └── layout/            # App shell (Navbar, Sidebar, Layout)
│   │   ├── contexts/              # React Context (Auth)
│   │   ├── pages/
│   │   │   ├── auth/              # Login, Forgot Password
│   │   │   ├── books/             # List, Detail, Form, Bulk Import
│   │   │   ├── dashboard/         # Role-aware dashboard
│   │   │   ├── fines/             # Fine management
│   │   │   ├── members/           # List, Detail, Form
│   │   │   ├── reports/           # Analytics and exports
│   │   │   ├── reservations/      # Reservation management
│   │   │   ├── search/            # Catalog search
│   │   │   ├── settings/          # System settings
│   │   │   └── transactions/      # Transactions, Issue, Return
│   │   ├── services/              # API service layer
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── App.tsx                # Root component with routes
│   │   ├── index.css              # Global styles
│   │   └── main.tsx               # Entry point
│   ├── package.json
│   └── vite.config.ts
├── .env.example
├── .gitignore
├── package.json                   # Root scripts
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **npm** >= 9

### 1. Clone and Install

```bash
# Install all dependencies (backend + frontend)
npm run install:all
```

### 2. Environment Setup

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your database credentials
# Required variables:
#   DATABASE_URL=postgresql://user:password@localhost:5432/library_db
#   JWT_SECRET=your-secret-key
#   JWT_EXPIRATION=24h
```

### 3. Database Setup

```bash
# Create the database
createdb library_db

# Run Prisma migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed default data (admin user, settings, categories)
npm run db:seed
```

### 4. Start Development Servers

```bash
# Start both backend and frontend concurrently
npm run dev

# Or start individually:
npm run dev:backend    # Backend on http://localhost:3000
npm run dev:frontend   # Frontend on http://localhost:5173
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs

### Default Users (after seeding)

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | Admin@123 |
| Librarian | librarian | Librarian@123 |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Register user (admin only) |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/change-password` | Change password |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Books
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books` | List books (paginated, searchable) |
| GET | `/api/books/:id` | Get book details |
| POST | `/api/books` | Create book |
| PUT | `/api/books/:id` | Update book |
| DELETE | `/api/books/:id` | Soft-delete book |
| POST | `/api/books/bulk-import` | CSV bulk import |

### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/members` | List members |
| GET | `/api/members/:id` | Get member details |
| POST | `/api/members` | Create member |
| PUT | `/api/members/:id` | Update member |
| POST | `/api/members/:id/renew` | Renew membership |
| GET | `/api/members/:id/history` | Borrowing history |
| GET | `/api/members/:id/fines` | Member fines |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions/issue` | Issue a book |
| POST | `/api/transactions/return` | Return a book |
| POST | `/api/transactions/renew` | Renew a book |
| GET | `/api/transactions/overdue` | Get overdue list |

### Fines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fines` | List all fines |
| GET | `/api/fines/member/:memberId` | Member fines |
| POST | `/api/fines/:id/pay` | Process payment |
| POST | `/api/fines/:id/waive` | Waive fine (admin) |

### Reservations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reservations` | Create reservation |
| POST | `/api/reservations/:id/cancel` | Cancel reservation |
| GET | `/api/reservations/member/:memberId` | Member reservations |
| GET | `/api/reservations/book/:bookId` | Book reservation queue |

### Search & Catalog
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Full-text search |
| GET | `/api/search/suggestions` | Autocomplete |
| GET | `/api/catalog/categories` | Browse by category |
| GET | `/api/catalog/new-arrivals` | New books |
| GET | `/api/catalog/popular` | Popular books |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Dashboard statistics |
| GET | `/api/reports/popular-books` | Popular books report |
| GET | `/api/reports/inventory` | Inventory status |
| GET | `/api/reports/overdue` | Overdue report |
| GET | `/api/reports/members` | Member statistics |
| GET | `/api/reports/transactions` | Transaction report |
| GET | `/api/reports/financial` | Financial report |
| GET | `/api/reports/export/:type` | Export to CSV |

## Scripts

```bash
# Development
npm run dev              # Start both servers
npm run dev:backend      # Start backend only
npm run dev:frontend     # Start frontend only

# Build
npm run build            # Build both
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend

# Database
npm run db:migrate       # Run migrations
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed default data
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run all tests
npm run test:backend     # Run backend tests
npm run test:e2e         # Run E2E tests
npm run test:cov         # Test coverage

# Production
npm run start:prod       # Start production server
```

## Fine Calculation

Fines are calculated based on system settings per member type:

| Member Type | Loan Duration | Fine/Day | Grace Period | Max Renewals |
|-------------|---------------|----------|--------------|--------------|
| Student | 14 days | $0.50 | 1 day | 2 |
| Faculty | 30 days | $0.25 | 3 days | 3 |
| Public | 14 days | $1.00 | 0 days | 1 |

**Fine Formula**: `fine = max(0, overdueDays - gracePeriod) * finePerDay`

Additional fines:
- **Lost Book**: Book price + $5.00 processing fee
- **Damage**: 25% / 50% / 100% of book price based on severity

## License

This project is for educational purposes.
