import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    navigate(isAuthenticated ? "/channels/@me" : "/login", { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#313338] text-white select-none"
      aria-busy="true"
    >
      <div className="nexora-mark h-14 w-14 rounded-[16px] flex items-center justify-center mb-4 animate-pulse">
        <span className="font-black text-xl text-white">N</span>
      </div>
      <p className="text-[#B5BAC1] text-sm" role="status">
        Carregando Nexora...
      </p>
    </main>
  );
}
