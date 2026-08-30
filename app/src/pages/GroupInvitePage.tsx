import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import { Seo } from "@/lib/seo";

/**
 * Entrada por link de convite de grupo (itens 19-20).
 * Nunca adiciona automaticamente — sempre exige ação explícita.
 */
export function GroupInvitePage() {
  const params = useParams();
  const navigate = useNavigate();
  const code = params.code ?? "";
  const { user, isLoading: authLoading } = useAuth();
  const [joining, setJoining] = useState(false);

  const info = trpc.group.inviteInfo.useQuery(
    { code },
    { enabled: !!code && !!user, retry: false }
  );

  const join = trpc.group.joinByInvite.useMutation({
    onSuccess: ({ conversationId }) => {
      toast.success("Você entrou no grupo!");
      navigate(`/channels/@me/${conversationId}`);
    },
    onError: e => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-chat">
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
      <Seo noindex canonicalPath="/invite/group" />
      <Card className="w-full max-w-sm border-black/20 bg-sidebar text-center text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <CardHeader>
          <div className="mx-auto mb-3">
            <GroupAvatar
              users={[]}
              src={info.data?.avatarUrl}
              name={info.data?.name ?? undefined}
              size="xl"
            />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
            Você foi convidado para
          </p>
          <CardTitle className="mt-1">
            {info.isLoading
              ? "Carregando convite..."
              : info.error
                ? "Convite inválido"
                : (info.data?.name ?? "Grupo")}
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
                <Users className="h-4 w-4" aria-hidden />
                {info.data.memberCount}{" "}
                {info.data.memberCount === 1 ? "participante" : "participantes"}
              </p>
              {info.data.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {info.data.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/80">
                Convidado por {info.data.inviterName}
              </p>
              {info.data.alreadyMember && info.data.conversationId ? (
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate(`/channels/@me/${info.data!.conversationId}`)
                  }
                >
                  Você já participa — abrir grupo
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={joining || join.isPending}
                  onClick={() => {
                    setJoining(true);
                    join.mutate({ code });
                  }}
                >
                  {join.isPending || joining ? "Entrando..." : "Entrar no grupo"}
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
