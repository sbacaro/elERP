(function () {
/** Textos da interface — idioma padrão: pt-BR */
const LOCALE = "pt-BR";

const t = {
  locale: LOCALE,

  brandSubtitle: "PDV para açaí e sorvete por grama · estoque · caixa · compras",

  loginTitle: "Entrar no elERP",
  loginSubtitle: "Use seu e-mail e senha para acessar o PDV na nuvem.",
  email: "E-mail",
  password: "Senha",
  login: "Entrar",
  signup: "Criar conta",
  logout: "Sair",
  orCreateAccount: "Primeira vez? Crie uma conta com o mesmo formulário.",
  loginLoading: "Entrando...",
  signupLoading: "Criando conta...",
  signupOk: "Conta criada. Se pedir confirmação, verifique o e-mail e depois entre.",
  loginRequired: "Faça login para usar o sistema.",
  syncSaving: "Salvando na nuvem...",
  syncSaved: "Salvo na nuvem",
  syncError: "Não foi possível salvar na nuvem.",
  loadError: "Não foi possível carregar seus dados.",
  schemaMissing:
    "Tabela ainda não criada no Supabase. Rode o arquivo supabase/schema.sql no SQL Editor.",

  nav: {
    pos: "Caixa",
    products: "Produtos",
    purchases: "Compras",
    day: "Dia",
    scale: "Balança",
  },

  sessionOpen: (floatLabel) => `Caixa aberto · fundo ${floatLabel}`,
  sessionClosed: "Caixa fechado",
  openCash: "Abrir caixa",
  closeCash: "Fechar caixa",
  openCashNow: "Abrir caixa agora",
  cashClosedTitle: "Caixa fechado",
  cashClosedHelp: "Abra o turno para registrar vendas em gramas e controlar o fundo de troco.",

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
  kgSold: "Peso vendido",
  gramsSold: "Gramas vendidas",
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
  weightG: "Peso (g)",
  weightKg: "Peso (g)",
  weightPlaceholder: "ex.: 385",
  add: "Adicionar",
  stockLowShort: "baixo",
  readScale: "Ler balança",
  useScaleWeight: "Usar peso da balança",
  scaleLive: "Leitura ao vivo",
  scaleStable: "estável",
  scaleUnstable: "instável",
  scaleDisconnected: "Balança não conectada",
  scaleUnsupported:
    "Conexão USB/serial da balança exige Google Chrome ou Microsoft Edge no computador (HTTPS).",
  scaleConnect: "Conectar balança (USB)",
  scaleDisconnect: "Desconectar",
  scaleConnected: "Balança conectada",
  scaleTitle: "Balança de balcão",
  scaleHelp:
    "A venda é sempre em gramas. O preço do sabor continua cadastrado por kg. A balança USB costuma enviar kg e o PDV converte para g.",
  scaleProtocol: "Protocolo",
  scaleBaud: "Velocidade (baud)",
  scaleSave: "Salvar configuração",
  scaleSaved: "Configuração da balança salva",
  scaleLast: "Última leitura",
  scaleNone: "Nenhuma leitura ainda",
  scaleHintBarcode: "Se a balança imprime etiqueta com código, leia com o scanner neste diálogo (peso em g).",
  scaleError: "Erro na balança",
  scalePermissionDenied: "Permissão da porta USB negada ou cancelada.",

  dialogCancel: "Cancelar",
  dialogConfirm: "Confirmar",

  footerStorage: "Dados na sua conta Supabase",
  resetDemo: "Restaurar demonstração",
  resetConfirm: "Zerar dados desta conta e recarregar a demonstração?",

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
    invalidWeight: "Informe o peso em gramas (ex.: 385).",
  },
};

function payMethodLabel(method) {
  return t.payMethods[method] || method;
}

function poStatusLabel(status) {
  return t.poStatus[status] || status;
}

window.elERPLocale = { t, payMethodLabel, poStatusLabel, LOCALE };

})();
