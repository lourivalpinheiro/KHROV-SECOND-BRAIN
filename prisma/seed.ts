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

  // Garante as 4 pastas-raiz do PARA (Projetos/Áreas/Recursos/Arquivo).
  const existing = await prisma.folder.findMany({
    where: { userId: user.id, paraCategory: { not: null } },
    select: { paraCategory: true },
  });
  const existingCategories = new Set(existing.map((f) => f.paraCategory));
  const missing = PARA_CATEGORIES.filter((c) => !existingCategories.has(c.category));
  if (missing.length > 0) {
    await prisma.folder.createMany({
      data: missing.map((c) => ({ userId: user.id, name: c.name, paraCategory: c.category })),
    });
    console.log(`Pastas do PARA criadas: ${missing.map((c) => c.name).join(", ")}`);
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
