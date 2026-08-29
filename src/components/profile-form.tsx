"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, Camera, Download, KeyRound, Loader2, User as UserIcon } from "lucide-react";
import { fetcher, patchJSON, postJSON } from "@/lib/api-client";
import { fileToSquareDataUrl } from "@/lib/image-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const RESET_PHRASE = "APAGAR TUDO";

type ProfileDTO = { id: string; name: string | null; email: string; image: string | null };

function initials(name?: string | null, email?: string | null) {
  const base = name || email || "?";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function ProfileForm() {
  const { data: profile } = useSWR<ProfileDTO>("/api/profile", fetcher);
  const { update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!profile || loaded.current) return;
    loaded.current = true;
    setName(profile.name ?? "");
    setEmail(profile.email);
    setImage(profile.image);
  }, [profile]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setImage(dataUrl);
    } catch {
      toast.error("Não foi possível processar essa imagem.");
    } finally {
      e.target.value = "";
    }
  }

  async function saveProfile() {
    if (!name.trim() || !email.trim()) {
      toast.error("Nome e usuário/email são obrigatórios.");
      return;
    }
    setSavingProfile(true);
    try {
      await patchJSON("/api/profile", { name: name.trim(), email: email.trim(), image });
      await update({ name: name.trim(), email: email.trim(), image });
      router.refresh();
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não bate com a nova senha.");
      return;
    }
    setSavingPassword(true);
    try {
      await postJSON("/api/profile/password", { currentPassword, newPassword });
      toast.success("Senha atualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao trocar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  async function resetAccount() {
    setResetting(true);
    try {
      await postJSON("/api/reset", {});
      await mutate(
        (key) =>
          typeof key === "string" &&
          (key.startsWith("/api/notes") || key.startsWith("/api/folders") || key.startsWith("/api/tags") || key.startsWith("/api/flashcards"))
      );
      toast.success("Conta zerada. Notas, pastas e tags apagadas.");
      setResetOpen(false);
      setResetConfirmText("");
      router.push("/notes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao zerar a conta.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="size-4" /> Dados da conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative"
              title="Trocar foto"
            >
              <Avatar className="size-16">
                {image && <AvatarImage src={image} alt={name} />}
                <AvatarFallback className="text-lg">{initials(name, email)}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="size-3.5" /> Trocar foto
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG ou PNG.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Usuário / email</Label>
            <Input id="profile-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> Trocar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={savePassword}
            disabled={savingPassword || !currentPassword || !newPassword}
          >
            {savingPassword && <Loader2 className="size-4 animate-spin" />}
            Atualizar senha
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" /> Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixe todas as suas notas, pastas e tags num arquivo JSON — pra não depender só do banco em produção.
          </p>
          <Button variant="outline" render={<a href="/api/export" download />}>
            <Download className="size-4" /> Baixar backup completo
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" /> Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Apaga todas as suas notas, pastas, tags e flashcards. A conta (login e senha) continua a
            mesma. Essa ação não pode ser desfeita — baixe um backup antes, se quiser guardar algo.
          </p>
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            <AlertTriangle className="size-4" /> Zerar conta
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setResetConfirmText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Zerar a conta?</DialogTitle>
            <DialogDescription>
              Isso apaga <strong>todas</strong> as notas, pastas, tags e flashcards, sem volta.
              Digite <strong>{RESET_PHRASE}</strong> pra confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder={RESET_PHRASE}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={resetting || resetConfirmText.trim() !== RESET_PHRASE}
              onClick={resetAccount}
            >
              {resetting && <Loader2 className="size-4 animate-spin" />}
              Apagar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
