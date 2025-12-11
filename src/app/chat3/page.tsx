// src/app/page.tsx
import AuthPage from "@/components/login/LoginPage";

export default function Home() {
  return (
    // h-[100dvh] = 100% de la hauteur dynamique de l'écran (gère mieux les barres mobiles)
    <main className="flex h-[100dvh] w-full flex-col bg-white dark:bg-black">
      <AuthPage />
    </main>
  );
}