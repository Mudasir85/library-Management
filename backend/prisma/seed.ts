import { PrismaClient, UserRole, MemberType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create default system settings
  const settings = [
    {
      memberType: MemberType.student,
      maxBooksAllowed: 3,
      loanDurationDays: 14,
      renewalLimit: 2,
      finePerDay: 0.5,
      gracePeriodDays: 1,
    },
    {
      memberType: MemberType.faculty,
      maxBooksAllowed: 5,
      loanDurationDays: 30,
      renewalLimit: 3,
      finePerDay: 0.25,
      gracePeriodDays: 2,
    },
    {
      memberType: MemberType.public,
      maxBooksAllowed: 2,
      loanDurationDays: 14,
      renewalLimit: 1,
      finePerDay: 1.0,
      gracePeriodDays: 0,
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { memberType: setting.memberType },
      update: setting,
      create: setting,
    });
  }
  console.log('System settings seeded.');

  // Create default categories
  const categories = [
    { name: 'Fiction', description: 'Fictional works including novels and short stories' },
    { name: 'Non-Fiction', description: 'Factual and informational works' },
    { name: 'Science', description: 'Scientific literature and textbooks' },
    { name: 'Technology', description: 'Computer science, engineering, and technology' },
    { name: 'History', description: 'Historical works and biographies' },
    { name: 'Literature', description: 'Classic and modern literature' },
    { name: 'Mathematics', description: 'Mathematics textbooks and references' },
    { name: 'Arts', description: 'Art, music, and creative works' },
    { name: 'Philosophy', description: 'Philosophy and ethics' },
    { name: 'Reference', description: 'Encyclopedias, dictionaries, and reference materials' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
  }
  console.log('Categories seeded.');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@library.com',
      passwordHash: adminPasswordHash,
      fullName: 'System Administrator',
      role: UserRole.admin,
      status: 'active',
    },
  });
  console.log(`Admin user created: ${admin.username}`);

  // Create librarian user
  const librarianPasswordHash = await bcrypt.hash('Librarian@123', 10);
  const librarian = await prisma.user.upsert({
    where: { username: 'librarian' },
    update: {},
    create: {
      username: 'librarian',
      email: 'librarian@library.com',
      passwordHash: librarianPasswordHash,
      fullName: 'Head Librarian',
      role: UserRole.librarian,
      status: 'active',
    },
  });
  console.log(`Librarian user created: ${librarian.username}`);

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
