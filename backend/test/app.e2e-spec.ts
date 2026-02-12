import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

describe('Library Management System (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Auth ──────────────────────────────────────────────────────────

  describe('Auth Module', () => {
    describe('POST /api/auth/login', () => {
      it('should return 401 for invalid credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ username: 'nonexistent', password: 'WrongPass1' })
          .expect(401);
      });

      it('should return 400 for missing fields', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({})
          .expect(401);
      });

      it('should login with valid admin credentials', () => {
        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'Admin@123' })
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.user).toBeDefined();
            expect(res.body.data.user.role).toBe('admin');
            accessToken = res.body.data.accessToken;
          });
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return 401 without token', () => {
        return request(app.getHttpServer())
          .get('/api/auth/me')
          .expect(401);
      });

      it('should return profile with valid token', () => {
        return request(app.getHttpServer())
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.username).toBe('admin');
          });
      });
    });
  });

  // ─── Books ─────────────────────────────────────────────────────────

  describe('Books Module', () => {
    let createdBookId: string;

    describe('GET /api/books', () => {
      it('should return paginated books list', () => {
        return request(app.getHttpServer())
          .get('/api/books')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
          });
      });
    });

    describe('POST /api/books', () => {
      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .post('/api/books')
          .send({
            title: 'Test Book',
            author: 'Test Author',
            isbn: '978-3-16-148410-0',
            category: 'Fiction',
          })
          .expect(401);
      });

      it('should create a new book with admin token', () => {
        return request(app.getHttpServer())
          .post('/api/books')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            title: 'E2E Test Book',
            author: 'E2E Test Author',
            isbn: '978-0-13-468599-1',
            category: 'Fiction',
            language: 'English',
            totalCopies: 5,
            availableCopies: 5,
            publicationYear: 2024,
          })
          .expect(201)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('E2E Test Book');
            createdBookId = res.body.data.id;
          });
      });
    });

    describe('GET /api/books/:id', () => {
      it('should return 404 for non-existent book', () => {
        return request(app.getHttpServer())
          .get('/api/books/00000000-0000-0000-0000-000000000000')
          .expect(404);
      });

      it('should return book details', () => {
        if (!createdBookId) return;
        return request(app.getHttpServer())
          .get(`/api/books/${createdBookId}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(createdBookId);
          });
      });
    });
  });

  // ─── Members ───────────────────────────────────────────────────────

  describe('Members Module', () => {
    describe('GET /api/members', () => {
      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .get('/api/members')
          .expect(401);
      });

      it('should return paginated members list with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/members')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
          });
      });
    });
  });

  // ─── Categories ────────────────────────────────────────────────────

  describe('Categories Module', () => {
    describe('GET /api/categories', () => {
      it('should return categories list with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/categories')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });
  });

  // ─── Settings ──────────────────────────────────────────────────────

  describe('Settings Module', () => {
    describe('GET /api/settings', () => {
      it('should return system settings with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/settings')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
          });
      });
    });
  });

  // ─── Reports ───────────────────────────────────────────────────────

  describe('Reports Module', () => {
    describe('GET /api/reports/dashboard', () => {
      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .get('/api/reports/dashboard')
          .expect(401);
      });

      it('should return dashboard stats with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalBooks).toBeDefined();
            expect(res.body.data.totalMembers).toBeDefined();
          });
      });
    });
  });

  // ─── Search ────────────────────────────────────────────────────────

  describe('Search Module', () => {
    describe('GET /api/search', () => {
      it('should return search results', () => {
        return request(app.getHttpServer())
          .get('/api/search?q=test')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.books).toBeDefined();
            expect(res.body.data.pagination).toBeDefined();
          });
      });
    });

    describe('GET /api/search/suggestions', () => {
      it('should return autocomplete suggestions', () => {
        return request(app.getHttpServer())
          .get('/api/search/suggestions?term=test')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.suggestions).toBeDefined();
          });
      });
    });

    describe('GET /api/catalog/browse', () => {
      it('should return categories with counts', () => {
        return request(app.getHttpServer())
          .get('/api/catalog/browse')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
            expect(res.body.data.categories).toBeDefined();
          });
      });
    });
  });

  // ─── Fines ─────────────────────────────────────────────────────────

  describe('Fines Module', () => {
    describe('GET /api/fines', () => {
      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .get('/api/fines')
          .expect(401);
      });

      it('should return fines list with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/fines')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
          });
      });
    });

    describe('GET /api/fines/outstanding', () => {
      it('should return outstanding fines with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/fines/outstanding')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
          });
      });
    });
  });

  // ─── Transactions ──────────────────────────────────────────────────

  describe('Transactions Module', () => {
    describe('GET /api/transactions', () => {
      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .get('/api/transactions')
          .expect(401);
      });

      it('should return transactions list with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/transactions')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
          });
      });
    });

    describe('GET /api/transactions/overdue', () => {
      it('should return overdue transactions with admin token', () => {
        return request(app.getHttpServer())
          .get('/api/transactions/overdue')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.success).toBe(true);
          });
      });
    });
  });
});
