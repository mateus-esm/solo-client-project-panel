import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { HardHat, ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useInstallerAuth } from '@/hooks/use-installer-auth';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useInstallerAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const res = await fetch('/api/installer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        throw new Error('Credenciais inválidas');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installer', 'auth'] });
      setLocation('/services');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao fazer login',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (authLoading) return null;
  if (isAuthenticated) {
    setLocation('/services');
    return null;
  }

  function onSubmit(values: LoginFormValues) {
    loginMutation.mutate(values);
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary text-secondary-foreground flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3 font-display font-bold text-3xl">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <HardHat className="w-8 h-8" />
          </div>
          Solo Energia
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Portal da <br/>
            <span className="text-primary">Equipe de Execução</span>
          </h1>
          <p className="text-xl text-secondary-foreground/80 mb-8 leading-relaxed">
            Acompanhe seus serviços, atualize status das obras e envie relatórios fotográficos diretamente do campo.
          </p>
          
          <ul className="space-y-4">
            {[
              'Acesso rápido a todos os serviços agendados',
              'Atualização de status em tempo real',
              'Envio de fotos e comprovantes simplificado'
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-lg font-medium">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-sm text-secondary-foreground/60 font-medium">
          &copy; {new Date().getFullYear()} Solo Energia. Ferramenta exclusiva para equipes parceiras.
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-white">
        
        {/* Mobile Header */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2 font-display font-bold text-2xl">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
            <HardHat className="w-6 h-6" />
          </div>
          Solo Energia
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-display font-bold text-foreground">Acesso ao Portal</h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Entre com suas credenciais de parceiro instalador.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">E-mail</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="seu@email.com" 
                        className="h-12 text-base bg-muted/50 focus:bg-white transition-colors"
                        data-testid="input-email"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Senha</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        className="h-12 text-base bg-muted/50 focus:bg-white transition-colors"
                        data-testid="input-password"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-semibold"
                size="lg"
                data-testid="button-submit-login"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Entrando...' : (
                  <>
                    Entrar <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
