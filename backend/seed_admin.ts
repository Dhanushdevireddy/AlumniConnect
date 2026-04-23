import { authService } from './src/services/auth/AuthService';
import prisma from './src/db/prismaClient';

async function seedTestData() {
  try {
    // 1. Seed Admin
    const email = "admin_test@test.com";
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await authService.register(email, "Password123!", "admin" as any, "Test Admin");
      console.log(`   Seeded Admin ${email}`);
    }

    // 2. Approve Alumni
    const alumni = await prisma.user.findUnique({
      where: { email: "alumni_test@test.com" },
      include: { alumniProfile: true }
    });
    if (alumni?.alumniProfile) {
      await prisma.alumniProfile.update({
        where: { id: alumni.alumniProfile.id },
        data: { verificationStatus: 'approved' }
      });
      console.log(`   Approved Alumni`);
    }

    // 3. Create Connection
    const student = await prisma.user.findUnique({ where: { email: "student_test@test.com" } });
    if (student && alumni) {
      const req = await prisma.mentorshipRequest.create({
        data: {
          studentId: student.id,
          alumniId: alumni.id,
          message: "Test request",
          status: 'accepted'
        }
      });
      await prisma.connection.create({
        data: {
          requestId: req.id,
          studentId: student.id,
          alumniId: alumni.id
        }
      });
      console.log(`   Created Connection`);
    }

  } catch (err) {
    console.error("Error seeding data", err);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
