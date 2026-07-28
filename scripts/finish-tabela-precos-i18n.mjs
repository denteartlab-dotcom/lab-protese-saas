import fs from "fs";

const file = "src/app/app/cadastros/tabela-precos/page.tsx";
let c = fs.readFileSync(file, "utf8");

const pairs = [
  ['<label className="block text-[11px] text-slate-600">Selecione uma Tabela</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.selecioneTabela")}</label>'],
  ['+ Adicionar Tabela', '{t("cadastros.tabelaPrecos.adicionarTabela")}'],
  ['<th className="px-3 py-2 text-left font-semibold">DUPLICAR</th>', '<th className="px-3 py-2 text-left font-semibold">{t("cadastros.tabelaPrecos.duplicar").toUpperCase()}</th>'],
  ['title={recolhida ? "Expandir" : "Recolher"}', 'title={recolhida ? t("cadastros.tabelaPrecos.expandir") : t("cadastros.tabelaPrecos.recolher")}'],
  ['<th className="w-28 px-3 py-2 text-center font-semibold uppercase">VALOR</th>', '<th className="w-28 px-3 py-2 text-center font-semibold uppercase">{t("cadastros.tabelaPrecos.valor").toUpperCase()}</th>'],
  ['<th className="w-40 px-3 py-2 text-center font-semibold uppercase">ETAPAS</th>', '<th className="w-40 px-3 py-2 text-center font-semibold uppercase">{t("cadastros.tabelaPrecos.etapas").toUpperCase()}</th>'],
  ['<th className="w-28 px-3 py-2 text-center font-semibold uppercase">OCULTAR</th>', '<th className="w-28 px-3 py-2 text-center font-semibold uppercase">{t("cadastros.tabelaPrecos.ocultar").toUpperCase()}</th>'],
  ['<th className="px-3 py-2 text-left font-semibold uppercase">Nome serviço</th>', '<th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.tabelaPrecos.nomeServicoCurto")}</th>'],
  ['<th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor</th>', '<th className="w-28 px-3 py-2 text-right font-semibold uppercase">{t("cadastros.tabelaPrecos.valor")}</th>'],
  ['<th className="w-40 px-3 py-2 text-center font-semibold uppercase">Etapas</th>', '<th className="w-40 px-3 py-2 text-center font-semibold uppercase">{t("cadastros.tabelaPrecos.etapas")}</th>'],
  ['<th className="w-28 px-3 py-2 text-center font-semibold uppercase">Ocultar</th>', '<th className="w-28 px-3 py-2 text-center font-semibold uppercase">{t("cadastros.tabelaPrecos.ocultar")}</th>'],
  ['title={item.tipo === "servico" ? "Gerenciar custos com produtos do estoque" : "Editar custo do item"}', 'title={item.tipo === "servico" ? t("cadastros.tabelaPrecos.gerenciarCustosEstoque") : t("cadastros.tabelaPrecos.editarCustoItem")}'],
  ['title={item.tipo === "produto" ? "Edite o produto no estoque" : "Editar"}', 'title={item.tipo === "produto" ? t("cadastros.tabelaPrecos.editarProdutoEstoque") : t("cadastros.comum.editar")}'],
  ['<label className="mb-1 block text-[11px] text-slate-600">Qtd (Unid)</label>', '<label className="mb-1 block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.qtdUnid")}</label>'],
  ['<label className="mb-1 block text-[11px] text-slate-600">Custo</label>', '<label className="mb-1 block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.custo")}</label>'],
  ['placeholder="0,00"', 'placeholder={t("cadastros.tabelaPrecos.placeholderValor")}'],
  ['<p className="text-[12px]">Nada adicionado ainda...</p>', '<p className="text-[12px]">{t("cadastros.tabelaPrecos.nadaAdicionado")}</p>'],
  ['<h2 className="text-sm font-semibold text-slate-700">Minhas Tabelas</h2>', '<h2 className="text-sm font-semibold text-slate-700">{t("cadastros.tabelaPrecos.minhasTabelas")}</h2>'],
  ['{item === tabela && <span>Atual</span>}', '{item === tabela && <span>{t("cadastros.tabelaPrecos.atual")}</span>}'],
  ['<h2 className="text-sm font-medium text-slate-700">Cadastrar Tabela</h2>', '<h2 className="text-sm font-medium text-slate-700">{t("cadastros.tabelaPrecos.cadastrarTabela")}</h2>'],
  ['<label className="block text-[11px] font-medium text-slate-600">Nome da Tabela</label>', '<label className="block text-[11px] font-medium text-slate-600">{t("cadastros.tabelaPrecos.nomeTabela")}</label>'],
  ['<span className="font-semibold text-slate-700">Configuração → Tabela de Preço</span>', '<span className="font-semibold text-slate-700">{t("cadastros.tabelaPrecos.configTabelaPreco")}</span>'],
  ['<th className="px-3 py-2 text-left font-semibold uppercase">Cliente</th>', '<th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.tabelaPrecos.colunaCliente")}</th>'],
  ['<th className="px-3 py-2 text-left font-semibold uppercase">Cidade</th>', '<th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.comum.cidade")}</th>'],
  ['<th className="px-3 py-2 text-left font-semibold uppercase">Tabela atual</th>', '<th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.tabelaPrecos.tabelaAtual")}</th>'],
  ['<label className="block text-[11px] text-slate-600">Nome do Serviço</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.nomeServico")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Valor</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.valor")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Desconto Repetição</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.descontoRepeticao")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Prazo Lab</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.prazoLab")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Prazo Dentista</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.prazoDentista")}</label>'],
  ['<option value="">Selecione</option>', '<option value="">{t("cadastros.comum.selecione")}</option>'],
  ['<label className="block text-[11px] text-slate-600">Valor da Comissão</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.comum.valorComissao")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Valor da Comissão (Repetição)</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.comum.valorComissaoRepeticao")}</label>'],
  ['<label className="block text-[11px] text-slate-600">Padrão</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.padraoLabel")}</label>'],
  ['<option>Nao</option>', '<option>{t("cadastros.comum.nao")}</option>'],
  ['<option>Sim</option>', '<option>{t("cadastros.comum.sim")}</option>'],
  ['aria-label="Remover comissão colaborador"', 'aria-label={t("cadastros.tabelaPrecos.removerComissaoColaborador")}'],
  ['aria-label="Remover comissão terceirizado"', 'aria-label={t("cadastros.tabelaPrecos.removerComissaoTerceirizado")}'],
  ['<p className="mb-4 flex items-center gap-2 text-sm text-slate-600">☰ Etapas</p>', '<p className="mb-4 flex items-center gap-2 text-sm text-slate-600">{t("cadastros.tabelaPrecos.menuEtapas")}</p>'],
  ['aria-label="Remover etapa"', 'aria-label={t("cadastros.tabelaPrecos.removerEtapa")}'],
  ['<label className="block text-[11px] text-slate-600">Valor da Etapa</label>', '<label className="block text-[11px] text-slate-600">{t("cadastros.tabelaPrecos.valorEtapa")}</label>'],
  ['<h2 className="text-sm font-semibold text-slate-700">Cadastrar etapas do serviço</h2>', '<h2 className="text-sm font-semibold text-slate-700">{t("cadastros.tabelaPrecos.cadastrarEtapasServico")}</h2>'],
  ['title={jaNaTabela ? "Etapa já adicionada ao serviço" : "Adicionar etapa ao serviço"}', 'title={jaNaTabela ? t("cadastros.tabelaPrecos.etapaJaAdicionada") : t("cadastros.tabelaPrecos.adicionarEtapaServico")}'],
  ['{padrao && <span className="ml-1 text-[10px] text-slate-400">(padrão)</span>}', '{padrao && <span className="ml-1 text-[10px] text-slate-400">{t("cadastros.tabelaPrecos.padrao")}</span>}'],
  ['<h2 className="text-sm font-semibold text-slate-700">Editar Tabela</h2>', '<h2 className="text-sm font-semibold text-slate-700">{t("cadastros.tabelaPrecos.editarTabela")}</h2>'],
  ['<label className="block text-xs font-medium text-slate-600">Nome da Tabela</label>', '<label className="block text-xs font-medium text-slate-600">{t("cadastros.tabelaPrecos.nomeTabela")}</label>'],
  ['<h2 className="text-sm font-semibold text-slate-700">Adicionar Produtos — Tabela de Preços</h2>', '<h2 className="text-sm font-semibold text-slate-700">{t("cadastros.tabelaPrecos.adicionarProdutos")}</h2>'],
  ['<th className="px-3 py-2 text-left font-semibold uppercase">Nome</th>', '<th className="px-3 py-2 text-left font-semibold uppercase">{t("cadastros.comum.nome")}</th>'],
  ['<th className="w-32 px-3 py-2 text-left font-semibold uppercase">Marca</th>', '<th className="w-32 px-3 py-2 text-left font-semibold uppercase">{t("cadastros.tabelaPrecos.marca")}</th>'],
  ['<th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor de custo</th>', '<th className="w-28 px-3 py-2 text-right font-semibold uppercase">{t("cadastros.tabelaPrecos.valorCusto")}</th>'],
  ['<th className="w-28 px-3 py-2 text-right font-semibold uppercase">Valor de venda</th>', '<th className="w-28 px-3 py-2 text-right font-semibold uppercase">{t("cadastros.tabelaPrecos.valorVenda")}</th>'],
  ['<label className="font-medium text-slate-600">Valor</label>', '<label className="font-medium text-slate-600">{t("cadastros.tabelaPrecos.valor")}</label>'],
  ['                  Fechar\n', '                  {t("cadastros.comum.fechar")}\n'],
  ['titulo="Excluir categoria"', 'titulo={t("cadastros.tabelaPrecos.excluirCategoriaTitulo")}'],
  ['mensagem="Deseja realmente remover esta categoria e todos os itens?"', 'mensagem={t("cadastros.tabelaPrecos.excluirCategoriaMensagem")}'],
  ['titulo="Excluir tabela"', 'titulo={t("cadastros.tabelaPrecos.excluirTabelaTitulo")}'],
  ['mensagem="Deseja realmente excluir esta tabela de preços?"', 'mensagem={t("cadastros.tabelaPrecos.excluirTabelaMensagem")}'],
  ['aviso="Atenção!! Esta ação não pode ser desfeita."', 'aviso={t("cadastros.comum.avisoAcaoIrreversivel")}'],
];

let count = 0;
for (const [from, to] of pairs) {
  if (c.includes(from)) {
    c = c.replaceAll(from, to);
    count++;
  } else {
    console.warn("NOT FOUND:", from.slice(0, 60));
  }
}

fs.writeFileSync(file, c);
console.log(`Applied ${count}/${pairs.length} replacements`);
