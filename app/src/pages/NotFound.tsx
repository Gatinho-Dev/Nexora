import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router";
import { Seo } from "@/lib/seo";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-chat p-4 text-white">
      <Seo title="Página não encontrada" canonicalPath="/404" noindex />
      <Card className="w-full max-w-sm border-black/20 bg-sidebar text-center text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted2">
            Esta página não existe ou foi movida.
          </p>
          <Button
            asChild
            className="w-full min-h-11 bg-[#5865F2] hover:bg-[#4752C4]"
          >
            <Link to="/">Voltar ao Nexora</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
