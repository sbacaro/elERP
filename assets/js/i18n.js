/** Textos da interface — idioma padrão: pt-BR */
const LOCALE = "pt-BR";

const t = {
  locale: LOCALE,

  brandSubtitle: "PDV para sorvete por quilo · estoque · caixa · compras",

  nav: {
    pos: "Caixa",
    products: "Produtos",
    purchases: "Compras",
    day: "Dia",
  },

  sessionOpen: (floatLabel) => `Caixa aberto · fundo ${floatLabel}`,
  sessionClosed: "Caixa fechado",
  openCash: "Abrir caixa",
  closeCash: "Fechar caixa",
  openCashNow: "Abrir caixa agora",
  cashClosedTitle: "Caixa fechado",
  cashClosedHelp: "Abra o turno para registrar vendas por kg e controlar o fundo de troco.",

  flavorsAndItems: "Sabores e itens",
  searchPlaceholder: "Buscar...",
  cart: "Carrinho",
  clear: "Limpar",
  cartEmpty: "Toque em um sabor ou item para começar.",
  remove: "remover",
  total: "Total",
  payment: "Pagamento",
  amountPaid: "Valor pago",
  finishSale: "Finalizar venda",

  payMethods: {
    dinheiro: "Dinheiro",
    pix: "Pix",
    cartao: "Cartão",
  },

  productsTitle: "Produtos e estoque",
  newProduct: "Novo produto",
  editProduct: "Editar produto",
  colName: "Nome",
  colUnit: "Un.",
  colPrice: "Preço",
  colCost: "Custo",
  colStock: "Estoque",
  colStatus: "Situação",
  edit: "editar",
  active: "ativo",
  inactive: "inativo",
  lowStock: "mín.",
  unit: "Unidade",
  minStock: "Estoque mínimo",
  status: "Situação",
  save: "Salvar",
  productSaved: "Produto salvo",

  purchasesTitle: "Pedidos de compra",
  newPurchase: "Novo pedido",
  purchasesHelp: "Fluxo: criar → marcar como enviado → receber (entra no estoque).",
  colCreated: "Criado",
  colSupplier: "Fornecedor",
  colItems: "Itens",
  colCostTotal: "Total custo",
  noOrders: "Nenhum pedido ainda.",
  itemsCount: (n) => `${n} item(ns)`,
  send: "enviar",
  receive: "receber",
  orderCreated: "Pedido criado",
  orderMarkedSent: "Pedido marcado como enviado",
  receiveOrder: "Receber pedido",
  confirmReceive: "Confirmar recebimento",
  receiptDone: "Recebimento registrado",
  remaining: (qtyLabel) => `falta ${qtyLabel}`,
  purchaseHint: "Por enquanto: um item por pedido. Depois ampliamos para vários itens.",
  qty: "Quantidade",
  unitCost: "Custo unitário",
  note: "Observação",
  optional: "opcional",
  product: "Produto",
  supplier: "Fornecedor",

  poStatus: {
    draft: "rascunho",
    sent: "enviado",
    partial: "parcial",
    received: "recebido",
    cancelled: "cancelado",
  },

  dayTitle: "Turno",
  lastClose: (expected, counted, diff) =>
    `Último fechamento: esperado ${expected}, contado ${counted}, diferença ${diff}.`,
  noSessionYet: "Nenhum caixa aberto. Abra um turno para começar a vender.",
  noSessionData: "Sem dados de turno ainda.",
  sales: "Vendas",
  kgSold: "Kg de sorvete",
  cashFloat: "Fundo de caixa",
  byPayment: "Por pagamento",
  byProduct: "Por produto",
  sessionSales: "Vendas do turno",
  when: "Quando",
  item: "Item",
  qtyShort: "Qtd",
  noSales: "Sem vendas",
  cancel: "cancelar",
  cancelSaleConfirm: "Cancelar esta venda e devolver estoque?",
  saleCancelled: "Venda cancelada",

  openCashTitle: "Abrir caixa",
  openingFloat: "Fundo de troco (R$)",
  open: "Abrir",
  cashOpened: "Caixa aberto",

  closeCashTitle: "Fechar o dia / caixa",
  expectedCash: (value) =>
    `Esperado em dinheiro: ${value} (fundo + vendas em dinheiro).`,
  countedCash: "Valor contado em dinheiro",
  closeConfirm: "Fechar caixa",
  cashClosedToast: (diff) => `Caixa fechado · diferença ${diff}`,
  noOpenCash: "Nenhum caixa aberto.",

  weightTitle: (name) => `Peso · ${name}`,
  priceStock: (price, stock) => `Preço: ${price} / kg · Estoque: ${stock}`,
  weightKg: "Peso (kg)",
  weightPlaceholder: "ex.: 0,385",
  add: "Adicionar",
  stockLowShort: "baixo",

  dialogCancel: "Cancelar",
  dialogConfirm: "Confirmar",

  footerStorage: "Dados neste navegador (armazenamento local)",
  resetDemo: "Restaurar demonstração",
  resetConfirm: "Zerar dados e recarregar a demonstração?",

  saleRegistered: (total) => `Venda ${total} registrada`,
  stockInsufficient: "Estoque insuficiente.",

  errors: {
    alreadyOpen: "Já existe um caixa aberto.",
    noOpenSession: "Nenhum caixa aberto.",
    openBeforeSell: "Abra o caixa antes de vender.",
    emptyCart: "Carrinho vazio.",
    invalidProductName: "Nome do produto é obrigatório.",
    invalidPrice: "Preço inválido.",
    productNotFound: "Produto não encontrado.",
    productNotInStock: "Produto não encontrado no estoque.",
    stockInsufficientNamed: (name) => `Estoque insuficiente: ${name}`,
    invalidCartProduct: "Produto inválido no carrinho.",
    paymentMismatch: "Pagamento diferente do total da venda.",
    payMustMatchTotal: "Ajuste o valor pago para fechar exatamente o total.",
    saleNotFound: "Venda não encontrada.",
    cancelOnlyOpen: "Só é possível cancelar venda do caixa aberto.",
    orderNeedsItems: "Informe itens no pedido.",
    invalidSupplier: "Fornecedor inválido.",
    invalidOrderProduct: "Produto inválido no pedido.",
    orderNotFound: "Pedido não encontrado.",
    orderAlreadyProcessed: "Pedido já foi enviado/recebido.",
    orderCannotReceive: "Pedido não pode ser recebido.",
    nothingReceived: "Nenhuma quantidade recebida.",
    invalidWeight: "Informe um peso válido.",
  },
};

function payMethodLabel(method) {
  return t.payMethods[method] || method;
}

function poStatusLabel(status) {
  return t.poStatus[status] || status;
}

window.elERPLocale = { t, payMethodLabel, poStatusLabel, LOCALE };
