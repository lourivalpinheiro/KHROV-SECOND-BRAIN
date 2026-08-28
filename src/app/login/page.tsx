import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BrainCircuit } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: params.callbackUrl || "/notes",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/login?error=1${params.callbackUrl ? `&callbackUrl=${encodeURIComponent(params.callbackUrl)}` : ""}`);
      }
      throw error;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Thought Chain</h1>
          <p className="text-sm text-muted-foreground">
            Seu second brain pessoal. Entre para continuar.
          </p>
        </div>

        <form action={authenticate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Usuário</Label>
            <Input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {params.error && (
            <p className="text-sm text-destructive">
              Usuário ou senha inválidos.
            </p>
          )}

          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
