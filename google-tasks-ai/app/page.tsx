import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/SignInButton";
import { Dashboard } from "@/components/Dashboard";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">Google Tasks AI</h1>
        <p className="max-w-md text-gray-600">
          Connecte ton compte Google pour gérer tes tâches avec l&apos;aide de l&apos;IA :
          priorisation automatique, création en langage naturel et planification dans ton
          calendrier.
        </p>
        <SignInButton />
      </main>
    );
  }

  return <Dashboard />;
}
