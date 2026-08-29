import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PARA_CATEGORIES = [
  { category: "PROJECTS" as const, name: "Projetos" },
  { category: "AREAS" as const, name: "Áreas" },
  { category: "RESOURCES" as const, name: "Recursos" },
  { category: "ARCHIVE" as const, name: "Arquivo" },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL e ADMIN_PASSWORD precisam estar definidos no .env.local para rodar o seed."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Usuário pronto: ${user.email} (id: ${user.id})`);

  // Garante as 4 pastas-raiz do PARA (Projetos/Áreas/Recursos/Arquivo): adota
  // pasta solta com o mesmo nome se já existir, em vez de duplicar.
  const existing = await prisma.folder.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, parentId: true, paraCategory: true },
  });
  for (const c of PARA_CATEGORIES) {
    if (existing.some((f) => f.paraCategory === c.category)) continue;
    const loose = existing.find(
      (f) => !f.paraCategory && f.parentId === null && f.name.trim().toLowerCase() === c.name.toLowerCase()
    );
    if (loose) {
      await prisma.folder.update({ where: { id: loose.id }, data: { paraCategory: c.category } });
    } else {
      await prisma.folder.create({ data: { userId: user.id, name: c.name, paraCategory: c.category } });
    }
    console.log(`Pasta do PARA pronta: ${c.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
