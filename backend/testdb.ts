import prisma from './src/db/prismaClient';
async function run() {
  const sp = await prisma.studentProfile.findMany();
  const ap = await prisma.alumniProfile.findMany();
  const u = await prisma.user.findMany();
  require('fs').writeFileSync('db_dump.json', JSON.stringify({sp, ap, u}, null, 2));
}
run().catch(console.error);
