import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ServiceFile {
  id: number;
  serviceId: number;
  kind: string;
  name: string | null;
  url: string;
  createdAt: string;
}

export interface Service {
  id: number;
  projectId: number | null;
  name: string;
  tipoServico: string | null;
  status: string;
  statusPagamento: string;
  pagamentoRealizado: boolean;
  dataExecucao: string | null;
  dataInicio: string | null;
  dataTermino: string | null;
  equipeExecucao: string | null;
  endereco: string | null;
  responsavelEmail: string | null;
  observacoes: string | null;
  valorFechado: number | null;
  formaPagamento: string | null;
  comprovanteUrl: string | null;
  contratoUrl: string | null;
  contratoStatus: string;
  contratoAceitoEm: string | null;
  contratoAceitoPor: string | null;
  createdAt: string;
  updatedAt: string;
  files: ServiceFile[];
}

export function useInstallerServices() {
  return useQuery<Service[]>({
    queryKey: ['installer', 'services'],
    queryFn: async () => {
      const res = await fetch('/api/installer/services', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
  });
}

export function useInstallerService(id: string | number) {
  return useQuery<Service>({
    queryKey: ['installer', 'services', id],
    queryFn: async () => {
      const res = await fetch(`/api/installer/services/${id}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch service');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateServiceStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: number; status?: string; observacoes?: string }) => {
      const res = await fetch(`/api/installer/services/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, observacoes }),
      });
      if (!res.ok) throw new Error('Failed to update service');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['installer', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['installer', 'services', variables.id] });
    },
  });
}

export function useAcceptContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/installer/services/${id}/contract/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Falha ao aceitar contrato');
      }
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['installer', 'services'] });
      queryClient.invalidateQueries({ queryKey: ['installer', 'services', id] });
    },
  });
}

export function useUploadServicePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, url, name }: { id: number; url: string; name?: string }) => {
      const res = await fetch(`/api/installer/services/${id}/photos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name }),
      });
      if (!res.ok) throw new Error('Failed to upload photo');
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['installer', 'services', variables.id] });
    },
  });
}
