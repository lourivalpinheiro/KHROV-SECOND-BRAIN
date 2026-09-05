import { auth } from "@/auth";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { CommandPalette } from "@/components/command-palette";
// A Nane (assistente de voz/IA) foi pausada — componente e rotas
// continuam intactos em src/components/nane e src/app/api/nane, só a
// montagem aqui foi removida. Reativar é só voltar este import e a linha
// <NaneAssistant /> abaixo.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <SidebarProvider>
      <CommandPalette />
      <AppSidebar
        user={{
          name: session?.user?.name,
          email: session?.user?.email,
          image: session?.user?.image,
        }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Second Brain
          </span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
          <HeaderUserMenu
            className="sm:hidden"
            name={session?.user?.name}
            email={session?.user?.email}
            image={session?.user?.image}
          />
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
