import { ProfileForm } from "@/components/profile-form";

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Perfil</h1>
      <ProfileForm />
    </div>
  );
}
