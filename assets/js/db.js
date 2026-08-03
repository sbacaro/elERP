(function () {
const STORAGE_KEY = "elERP.v1";

const SEED_PRODUCTS = [
  { name: "Chocolate belga", unit: "kg", price: 89.9, cost: 32, stock: 12, minStock: 3 },
  { name: "Morango", unit: "kg", price: 84.9, cost: 28, minStock: 3, stock: 10 },
  { name: "Napolitano", unit: "kg", price: 79.9, cost: 26, stock: 14, minStock: 3 },
  { name: "Pistache", unit: "kg", price: 109.9, cost: 48, stock: 6, minStock: 2 },
  { name: "Coco", unit: "kg", price: 82.9, cost: 27, stock: 8, minStock: 2 },
  { name: "Pote 500 ml", unit: "un", price: 2.5, cost: 0.8, stock: 120, minStock: 30 },
  { name: "Colher", unit: "un", price: 0.5, cost: 0.1, stock: 200, minStock: 50 },
];

const err = (key, ...args) => {
  const catalog = window.elERPLocale?.t?.errors || {};
  const value = catalog[key];
  if (typeof value === "function") return value(...args);
  return value || key;
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function todayISO() {
  return new Date().toISOString();
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function roundQty(n, unit) {
  const decimals = unit === "kg" ? 3 : 0;
  const f = 10 ** decimals;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

function createSeedState() {
  const products = SEED_PRODUCTS.map((p) => ({
    id: uid("prod"),
    active: true,
    ...p,
  }));
  return {
    products,
    sessions: [],
    sales: [],
    stockMovements: [],
    suppliers: [
      { id: uid("sup"), name: "Distribuidora Gelato Norte", phone: "" },
      { id: uid("sup"), name: "Embalagens Doce Casa", phone: "" },
    ],
    purchaseOrders: [],
    cart: [],
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

const db = {
  state: createSeedState(),
  userId: null,
  ready: false,
  _saveTimer: null,
  onSync: null,

  localKey() {
    return this.userId ? `${STORAGE_KEY}.${this.userId}` : STORAGE_KEY;
  },

  async bootstrap(userId) {
    this.userId = userId;
    this.ready = false;

    let loaded = null;
    try {
      loaded = await this.loadFromCloud();
    } catch (error) {
      const local = this.readLocal();
      if (local) {
        this.state = local;
        this.ready = true;
        throw error;
      }
      throw error;
    }

    if (loaded && typeof loaded === "object") {
      this.state = {
        products: loaded.products || [],
        sessions: loaded.sessions || [],
        sales: loaded.sales || [],
        stockMovements: loaded.stockMovements || [],
        suppliers: loaded.suppliers || [],
        purchaseOrders: loaded.purchaseOrders || [],
        cart: loaded.cart || [],
      };
    } else {
      const local = this.readLocal();
      this.state = local || createSeedState();
      await this.saveToCloud();
    }

    this.writeLocal();
    this.ready = true;
  },

  readLocal() {
    try {
      const raw = localStorage.getItem(this.localKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  writeLocal() {
    localStorage.setItem(this.localKey(), JSON.stringify(this.state));
  },

  async loadFromCloud() {
    const sb = window.elERPSb;
    if (!sb || !this.userId) return null;
    const { data, error } = await sb
      .from("app_state")
      .select("data")
      .eq("user_id", this.userId)
      .maybeSingle();

    if (error) {
      const msg = `${error.message || ""} ${error.code || ""} ${error.details || ""}`;
      if (/relation .* does not exist|Could not find the table|schema cache/i.test(msg)) {
        const e = new Error("SCHEMA_MISSING");
        e.cause = error;
        throw e;
      }
      throw error;
    }
    return data?.data ?? null;
  },

  async saveToCloud() {
    const sb = window.elERPSb;
    if (!sb || !this.userId) return { ok: false };
    if (typeof this.onSync === "function") this.onSync("saving");
    const { error } = await sb.from("app_state").upsert(
      {
        user_id: this.userId,
        data: cloneState(this.state),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      if (typeof this.onSync === "function") this.onSync("error", error);
      return { ok: false, error };
    }
    if (typeof this.onSync === "function") this.onSync("saved");
    return { ok: true };
  },

  persist() {
    if (!this.userId) return;
    this.writeLocal();
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.saveToCloud();
    }, 450);
  },

  async reset() {
    this.state = createSeedState();
    this.writeLocal();
    await this.saveToCloud();
  },

  clearSession() {
    this.userId = null;
    this.ready = false;
    this.state = createSeedState();
  },

  getOpenSession() {
    return this.state.sessions.find((s) => s.status === "open") || null;
  },

  openSession(openingFloat, note = "") {
    if (this.getOpenSession()) throw new Error(err("alreadyOpen"));
    const session = {
      id: uid("sess"),
      status: "open",
      openedAt: todayISO(),
      closedAt: null,
      openingFloat: roundMoney(openingFloat),
      countedCash: null,
      expectedCash: null,
      difference: null,
      note,
    };
    this.state.sessions.unshift(session);
    this.persist();
    return session;
  },

  closeSession(countedCash, note = "") {
    const session = this.getOpenSession();
    if (!session) throw new Error(err("noOpenSession"));
    const sales = this.state.sales.filter(
      (s) => s.sessionId === session.id && s.status === "confirmed"
    );
    const cashSales = sales.reduce((sum, sale) => {
      return (
        sum +
        sale.payments
          .filter((p) => p.method === "dinheiro")
          .reduce((a, p) => a + p.amount, 0)
      );
    }, 0);
    const expected = roundMoney(session.openingFloat + cashSales);
    const counted = roundMoney(countedCash);
    session.status = "closed";
    session.closedAt = todayISO();
    session.expectedCash = expected;
    session.countedCash = counted;
    session.difference = roundMoney(counted - expected);
    session.closeNote = note;
    this.state.cart = [];
    this.persist();
    return session;
  },

  listProducts({ onlyActive = true } = {}) {
    return this.state.products
      .filter((p) => (onlyActive ? p.active : true))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },

  upsertProduct(input) {
    const payload = {
      name: String(input.name || "").trim(),
      unit: input.unit === "un" ? "un" : "kg",
      price: roundMoney(input.price),
      cost: roundMoney(input.cost || 0),
      stock: Number(input.stock || 0),
      minStock: Number(input.minStock || 0),
      active: input.active !== false,
    };
    if (!payload.name) throw new Error(err("invalidProductName"));
    if (payload.price < 0) throw new Error(err("invalidPrice"));

    if (input.id) {
      const idx = this.state.products.findIndex((p) => p.id === input.id);
      if (idx < 0) throw new Error(err("productNotFound"));
      const prev = this.state.products[idx];
      const stockDelta = roundQty(payload.stock - prev.stock, payload.unit);
      const { stock: _ignoredStock, ...rest } = payload;
      this.state.products[idx] = { ...prev, ...rest, id: prev.id, stock: prev.stock };
      if (stockDelta !== 0) {
        this._moveStock(prev.id, stockDelta, "adjust", prev.id, "Ajuste manual");
      } else {
        this.persist();
      }
      return this.state.products[idx];
    }

    const product = { id: uid("prod"), ...payload };
    this.state.products.push(product);
    if (product.stock > 0) {
      this._moveStock(product.id, product.stock, "adjust", product.id, "Estoque inicial", {
        skipPersist: true,
        skipMutate: true,
      });
    }
    this.persist();
    return product;
  },

  _moveStock(productId, qtyDelta, type, refId, note, opts = {}) {
    const product = this.state.products.find((p) => p.id === productId);
    if (!product) throw new Error(err("productNotInStock"));
    if (!opts.skipMutate) {
      const next = roundQty(product.stock + qtyDelta, product.unit);
      if (next < -0.0001) throw new Error(err("stockInsufficientNamed", product.name));
      product.stock = Math.max(0, next);
    }
    this.state.stockMovements.unshift({
      id: uid("mov"),
      productId,
      qtyDelta,
      type,
      refId,
      note,
      at: todayISO(),
    });
    if (!opts.skipPersist) this.persist();
  },

  setCart(cart) {
    this.state.cart = cart;
    this.persist();
  },

  clearCart() {
    this.state.cart = [];
    this.persist();
  },

  confirmSale({ payments, note = "" }) {
    const session = this.getOpenSession();
    if (!session) throw new Error(err("openBeforeSell"));
    const cart = this.state.cart;
    if (!cart.length) throw new Error(err("emptyCart"));

    for (const item of cart) {
      const product = this.state.products.find((p) => p.id === item.productId);
      if (!product || !product.active) throw new Error(err("invalidCartProduct"));
      if (product.stock + 1e-9 < item.qty) {
        throw new Error(err("stockInsufficientNamed", product.name));
      }
    }

    const items = cart.map((item) => {
      const product = this.state.products.find((p) => p.id === item.productId);
      const lineTotal = roundMoney(item.qty * item.unitPrice);
      return {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costSnapshot: product.cost,
        lineTotal,
      };
    });

    const total = roundMoney(items.reduce((s, i) => s + i.lineTotal, 0));
    const payTotal = roundMoney(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
    if (Math.abs(payTotal - total) > 0.009) {
      throw new Error(err("paymentMismatch"));
    }

    const sale = {
      id: uid("sale"),
      sessionId: session.id,
      status: "confirmed",
      fiscalStatus: "none",
      items,
      payments: payments.map((p) => ({
        method: p.method,
        amount: roundMoney(p.amount),
      })),
      total,
      note,
      soldAt: todayISO(),
    };

    for (const item of items) {
      this._moveStock(item.productId, -item.qty, "sale", sale.id, "Venda", {
        skipPersist: true,
      });
    }

    this.state.sales.unshift(sale);
    this.state.cart = [];
    this.persist();
    return sale;
  },

  cancelSale(saleId) {
    const sale = this.state.sales.find((s) => s.id === saleId);
    if (!sale) throw new Error(err("saleNotFound"));
    if (sale.status === "cancelled") return sale;
    const session = this.state.sessions.find((s) => s.id === sale.sessionId);
    if (!session || session.status !== "open") {
      throw new Error(err("cancelOnlyOpen"));
    }
    sale.status = "cancelled";
    for (const item of sale.items) {
      this._moveStock(item.productId, item.qty, "sale_cancel", sale.id, "Cancelamento", {
        skipPersist: true,
      });
    }
    this.persist();
    return sale;
  },

  createPurchaseOrder({ supplierId, items, note = "" }) {
    if (!items?.length) throw new Error(err("orderNeedsItems"));
    const supplier = this.state.suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error(err("invalidSupplier"));
    const order = {
      id: uid("po"),
      supplierId,
      supplierName: supplier.name,
      status: "draft",
      note,
      createdAt: todayISO(),
      receivedAt: null,
      items: items.map((i) => {
        const product = this.state.products.find((p) => p.id === i.productId);
        if (!product) throw new Error(err("invalidOrderProduct"));
        return {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          qtyOrdered: roundQty(i.qty, product.unit),
          qtyReceived: 0,
          unitCost: roundMoney(i.unitCost ?? product.cost),
        };
      }),
    };
    this.state.purchaseOrders.unshift(order);
    this.persist();
    return order;
  },

  markPurchaseSent(orderId) {
    const order = this.state.purchaseOrders.find((o) => o.id === orderId);
    if (!order) throw new Error(err("orderNotFound"));
    if (order.status !== "draft") throw new Error(err("orderAlreadyProcessed"));
    order.status = "sent";
    this.persist();
    return order;
  },

  receivePurchaseOrder(orderId, receipts) {
    const order = this.state.purchaseOrders.find((o) => o.id === orderId);
    if (!order) throw new Error(err("orderNotFound"));
    if (order.status === "received" || order.status === "cancelled") {
      throw new Error(err("orderCannotReceive"));
    }

    let any = false;
    for (const rec of receipts) {
      const line = order.items.find((i) => i.productId === rec.productId);
      if (!line) continue;
      const qty = roundQty(rec.qty || 0, line.unit);
      if (qty <= 0) continue;
      const remaining = roundQty(line.qtyOrdered - line.qtyReceived, line.unit);
      const apply = Math.min(qty, remaining);
      if (apply <= 0) continue;
      any = true;
      line.qtyReceived = roundQty(line.qtyReceived + apply, line.unit);
      const product = this.state.products.find((p) => p.id === line.productId);
      if (product) product.cost = line.unitCost;
      this._moveStock(line.productId, apply, "purchase_in", order.id, "Recebimento", {
        skipPersist: true,
      });
    }

    if (!any) throw new Error(err("nothingReceived"));

    const complete = order.items.every((i) => i.qtyReceived + 1e-9 >= i.qtyOrdered);
    order.status = complete ? "received" : "partial";
    if (complete) order.receivedAt = todayISO();
    this.persist();
    return order;
  },

  sessionSales(sessionId) {
    return this.state.sales.filter((s) => s.sessionId === sessionId && s.status === "confirmed");
  },

  reportForSession(sessionId) {
    const sales = this.sessionSales(sessionId);
    const byMethod = { dinheiro: 0, pix: 0, cartao: 0 };
    const byProduct = {};
    let total = 0;
    let kgSold = 0;

    for (const sale of sales) {
      total += sale.total;
      for (const p of sale.payments) {
        byMethod[p.method] = roundMoney((byMethod[p.method] || 0) + p.amount);
      }
      for (const item of sale.items) {
        if (!byProduct[item.productId]) {
          byProduct[item.productId] = {
            name: item.name,
            unit: item.unit,
            qty: 0,
            total: 0,
          };
        }
        byProduct[item.productId].qty = roundQty(
          byProduct[item.productId].qty + item.qty,
          item.unit
        );
        byProduct[item.productId].total = roundMoney(
          byProduct[item.productId].total + item.lineTotal
        );
        if (item.unit === "kg") kgSold += item.qty;
      }
    }

    return {
      salesCount: sales.length,
      total: roundMoney(total),
      byMethod,
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      kgSold: roundQty(kgSold, "kg"),
      sales,
    };
  },
};

function formatMoney(value) {
  const locale = window.elERPLocale?.LOCALE || "pt-BR";
  return Number(value || 0).toLocaleString(locale, {
    style: "currency",
    currency: "BRL",
  });
}

function formatQty(value, unit) {
  const locale = window.elERPLocale?.LOCALE || "pt-BR";
  const n = Number(value || 0);
  if (unit === "kg") {
    return `${n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;
  }
  return `${n.toLocaleString(locale)} un`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const locale = window.elERPLocale?.LOCALE || "pt-BR";
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

window.elERP = { db, uid, roundMoney, roundQty, formatMoney, formatQty, formatDateTime };
})();
