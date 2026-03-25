import { Link } from "wouter";
import { Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(255,72,30,0.2)]">
        <Zap className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-6xl font-display font-bold text-foreground mb-4 tracking-tighter">404</h1>
      <p className="text-xl text-muted-foreground mb-8 text-center max-w-md">
        Parece que nos perdemos na rede elétrica. A página que você tentou acessar não existe.
      </p>
      <Link href="/">
        <button className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
          Voltar ao Dashboard
        </button>
      </Link>
    </div>
  );
}
