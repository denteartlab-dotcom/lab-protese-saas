import fs from "fs";

const replacements = [
  // prestadores / fornecedores / entregadores / colaboradores shared
  ['label: "E-mail"', 'label: t("cadastros.comum.email")'],
  ['label: "E-mail",', 'label: t("cadastros.comum.email"),'],
  ['label: "Setor"', 'label: t("cadastros.comum.setor")'],
  ['label: "Email"', 'label: t("cadastros.comum.email")'],
  ['label: "Celular"', 'label: t("cadastros.comum.celular")'],
  ['label: "WhatsApp"', 'label: t("cadastros.comum.whatsapp")'],
  ['label: "CPF"', 'label: t("cadastros.comum.cpf")'],
  ['label: "CNPJ"', 'label: t("cadastros.comum.cnpj")'],
  ['label: "CEP"', 'label: t("cadastros.comum.cep")'],
  ['label: "Rua"', 'label: t("cadastros.comum.rua")'],
  ['label: "Número"', 'label: t("cadastros.comum.numero")'],
  ['label: "Cidade"', 'label: t("cadastros.comum.cidade")'],
  ['label: "UF"', 'label: t("cadastros.comum.uf")'],
  ['label: "Bairro"', 'label: t("cadastros.comum.bairro")'],
  ['label: "Complemento"', 'label: t("cadastros.comum.complemento")'],
  ['label: "Telefone Residencial"', 'label: t("cadastros.comum.telefoneResidencial")'],
  ['label: "Telefone Comercial"', 'label: t("cadastros.comum.telefoneComercial")'],
  ['label: "Contato"', 'label: t("cadastros.comum.contato")'],
  ['label: "Categoria"', 'label: t("cadastros.comum.categoria")'],
  ['label: "Valor da Comissão"', 'label: t("cadastros.comum.valorComissao")'],
  ['label: "Valor da Comissão (Repetição)"', 'label: t("cadastros.comum.valorComissaoRepeticao")'],
  ['label: "Desconto na comissão"', 'label: t("cadastros.comum.descontoComissao")'],
  ['title="Visualizar"', 'title={t("cadastros.comum.visualizar")}'],
  ['title="Editar"', 'title={t("cadastros.comum.editar")}'],
  ['title="Excluir"', 'title={t("cadastros.comum.excluir")}'],
  ['title="Remover definitivamente"', 'title={t("cadastros.comum.removerDefinitivo")}'],
  ['aria-label="Visualizar"', 'aria-label={t("cadastros.comum.visualizar")}'],
  ['aria-label="Editar"', 'aria-label={t("cadastros.comum.editar")}'],
  ['aria-label="Excluir"', 'aria-label={t("cadastros.comum.excluir")}'],
  ['aria-label="Fechar"', 'aria-label={t("cadastros.comum.fechar")}'],
  ['aria-label="Exportar"', 'aria-label={t("cadastros.comum.exportarAria")}'],
  ['>Restaurar<', '>{t("cadastros.comum.restaurar")}<'],
  ['>Fechar Detalhes<', '>{t("cadastros.comum.fecharDetalhes")}<'],
  ['{buscandoCep ? "Buscando..." : "Buscar Endereço"}', '{buscandoCep ? t("cadastros.comum.buscando") : t("cadastros.comum.buscarEndereco")}'],
  ['<option>Não</option>', '<option>{t("cadastros.comum.nao")}</option>'],
  ['<option>Sim</option>', '<option>{t("cadastros.comum.sim")}</option>'],
  ['> Endereço\n', '> {t("cadastros.comum.secaoEndereco")}\n'],
  ['> Endereço<', '>{t("cadastros.comum.secaoEndereco")}<'],
  ['> Comissão<', '>{t("cadastros.comum.secaoComissao")}<'],
];

const files = process.argv.slice(2);
for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let changed = 0;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed++;
    }
  }
  if (changed) fs.writeFileSync(file, content);
  console.log(file, changed, "patterns");
}
