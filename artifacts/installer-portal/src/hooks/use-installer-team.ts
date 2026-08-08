import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamMember } from '@/hooks/use-installer-services';

export interface InstallerCompany {
  id: number;
  name: string;
  email: string;
  teamName: string;
  razaoSocial: string | null;
  cnpj: string | null;
  responsavelNome: string | null;
  responsavelTelefone: string | null;
  pixKey: string | null;
  formaPagamento: string | null;
  createdAt: string;
}

export interface FinanceiroService {
  id: number;
  name: string;
  tipoServico: string | null;
  status: string;
  statusPagamento: string;
  pagamentoRealizado: boolean;
  dataExecucao: string | null;
  valorFechado: number | null;
  formaPagamento: string | null;
  comprovanteUrl: string | null;
}

export interface FinanceiroResponse {
  services: FinanceiroService[];
  totals: { recebido: number; aReceber: number };
}

async function jsonOrThrow(res: Response, fallback: string) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? fallback);
  }
  return res.json();
}

export function useInstallerCompany() {
  return useQuery<InstallerCompany>({
    queryKey: ['installer', 'me'],
    queryFn: async () =>
      jsonOrThrow(
        await fetch('/api/installer/me', { credentials: 'include' }),
        'Falha ao carregar dados da empresa'
      ),
  });
}

export function useInstallerFinanceiro() {
  return useQuery<FinanceiroResponse>({
    queryKey: ['installer', 'financeiro'],
    queryFn: async () =>
      jsonOrThrow(
        await fetch('/api/installer/financeiro', { credentials: 'include' }),
        'Falha ao carregar financeiro'
      ),
  });
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['installer', 'team-members'],
    queryFn: async () =>
      jsonOrThrow(
        await fetch('/api/installer/team/members', { credentials: 'include' }),
        'Falha ao carregar membros'
      ),
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; documento?: string | null }) =>
      jsonOrThrow(
        await fetch('/api/installer/team/members', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        'Falha ao cadastrar membro'
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installer', 'team-members'] }),
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; name?: string; documento?: string | null }) =>
      jsonOrThrow(
        await fetch(`/api/installer/team/members/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        'Falha ao atualizar membro'
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installer', 'team-members'] }),
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/installer/team/members/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? 'Falha ao remover membro');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installer', 'team-members'] }),
  });
}

export function useUploadMemberFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, kind, file }: { id: number; kind: 'photo' | 'doc'; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return jsonOrThrow(
        await fetch(`/api/installer/team/members/${id}/upload?kind=${kind}`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }),
        'Falha ao enviar arquivo'
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installer', 'team-members'] }),
  });
}

export function useProposeServiceMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, memberIds }: { serviceId: number; memberIds: number[] }) =>
      jsonOrThrow(
        await fetch(`/api/installer/services/${serviceId}/members`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberIds }),
        }),
        'Falha ao enviar escalação'
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['installer', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['installer', 'services', String(variables.serviceId)] });
    },
  });
}
