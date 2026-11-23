import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

// Shared frame for the login and register pages (no sidebar).
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-6 px-4 py-10 sm:justify-center">
      <title>{`${title} | Kuryenta`}</title>
      <Logo />
      <Link
        to="/"
        className="flex items-center gap-1.5 rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        Back to app
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{footer}</p>
    </main>
  );
}
