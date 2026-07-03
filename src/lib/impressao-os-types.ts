import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { ConfiguracoesOs } from "@/lib/configuracoes-os";
import type {
  ColaboradorOsLinha,
  EtapaOsLinha,
  EtapasPorServicoOs,
} from "@/lib/etapas-os-impressao";
import type { ItemImpressaoOs } from "@/lib/os-itens-impressao";

export type DadosImpressaoOsPdf = {
  numeroOs: number;
  usuarioCriou?: string;
  dataEntrada: string;
  status: string;
  cliente: string;
  dentista: string;
  paciente: string;
  caixa: string;
  telefones: string;
  email: string;
  endereco: string;
  valor: number;
  prazo: string;
  prazoLaboratorio: string;
  prazoDentista: string;
  materiais: string;
  observacoes: string;
  prazoLinhaServico?: string;
  osExterna?: string;
  chavePed?: string;
  finalizado?: string;
  colaborador?: string;
  colaboradoresLista?: ColaboradorOsLinha[];
  etapasLista?: EtapaOsLinha[];
  etapasPorServico?: EtapasPorServicoOs[];
  etapas?: string;
  urgente?: boolean;
  repeticao?: boolean;
  producao?: string;
  pecas?: string;
  obsFicha?: string;
  itens: ItemImpressaoOs[];
  configLaboratorio?: ConfigLaboratorio;
  configuracoesOs?: ConfiguracoesOs;
};

export type OpcoesImpressaoOs = {
  somenteItem: boolean;
  duasVias: boolean;
  formato: string;
  modelo: string;
  segmentoParam: string;
};
