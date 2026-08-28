import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { Seo } from "@/lib/seo";

export function InvitePage() {
  const params = useParams();
  const navigate = useNavigate();
  const code = params.code ?? "";
  const { user, isLoading: authLoading } = useAuth();

  const info = trpc.server.getInviteInfo.useQuery(
    { code },
    { enabled: !!code && !!user, retry: false }
  );

  const infoError = info.error;
  const byVanity = trpc.server.byVanity.useQuery(
    { slug: code },
    { enabled: !!code && !!user && !!infoError, retry: false }
  );

  // Vanity link: entra direto no servidor apontado pelo slug.
  useEffect(() => {
    if (byVanity.data && user) {
      toast.success(`Você entrou em ${byVanity.data.name}!`);
      navigate(`/channels/${byVanity.data.serverId}/first`);
    }
  }, [byVanity.data, user, navigate]);

  const join = trpc.server.joinByCode.useMutation({
    onSuccess: ({ serverId }) => {
      toast.success("Você entrou no servidor!");
      navigate(`/channels/${serverId}/first`);
    },
    onError: e => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--chat-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <main className="flex h-[100dvh] items-center justify-center bg-chat p-4 text-white">
      <Seo noindex canonicalPath="/invite" />
      <Card className="w-full max-w-sm border-black/20 bg-sidebar text-center text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#5865F2] text-2xl font-bold text-white">
            {info.data?.server.name?.slice(0, 2).toUpperCase() ?? "?"}
          </div>
          <CardTitle>
            {info.isLoading
              ? "Carregando convite..."
              : info.error
                ? "Convite inválido"
                : `Entrar em ${info.data?.server.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {info.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : info.error ? (
            <>
              <p className="text-sm text-muted-foreground">
                {info.error.message ?? "Este convite expirou ou não existe."}
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/channels/@me")}
              >
                Voltar ao início
              </Button>
            </>
          ) : info.data ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {info.data.memberCount}{" "}
                {info.data.memberCount === 1 ? "membro" : "membros"}
              </p>
              {info.data.server.description && (
                <p className="text-sm text-muted-foreground">
                  {info.data.server.description}
                </p>
              )}
              {info.data.alreadyMember ? (
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate(`/channels/${info.data!.server.id}/first`)
                  }
                >
                  Você já é membro - abrir servidor
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => join.mutate({ code })}
                  disabled={join.isPending}
                >
                  {join.isPending ? "Entrando..." : "Aceitar convite"}
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
