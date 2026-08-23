import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#313338] p-4 text-white">
      <Card className="w-full max-w-sm border-black/20 bg-[#2B2D31] text-center text-white shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[#B5BAC1]">
            Esta página não existe ou foi movida.
          </p>
          <Button
            asChild
            className="w-full min-h-11 bg-[#4654D8] hover:bg-[#3D49BF]"
          >
            <Link to="/">Voltar ao Nexora</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
