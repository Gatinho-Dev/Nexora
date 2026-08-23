import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { NexoraAppIcon } from "@/components/NexoraBrand";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    navigate(isAuthenticated ? "/channels/@me" : "/login", { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center bg-chat text-white select-none"
      aria-busy="true"
    >
      <NexoraAppIcon className="mb-4 h-14 w-14 animate-pulse" />
      <p className="text-muted2 text-sm" role="status">
        Carregando Nexora...
      </p>
    </main>
  );
}
