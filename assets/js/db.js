(function () {
const STORAGE_KEY = "elERP.v2.local";

const err = (key, ...args) => {
  const catalog = window.elERPLocale?.t?.errors || {};
  const value = catalog[key];
  if (typeof value === "function") return value(...args);
  return value || key;
};

function newId() {
  return crypto.randomUUID();
}

function todayISO() {
  return new Date().toISOString();
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function roundQty(n, unit = "g") {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (unit === "kg" || unit === "un") {
    return Math.round((x + Number.EPSILON) * 1000) / 1000;
  }
  return Math.round(x + Number.EPSILON);
}

function lineTotal(qty, unit, pricePerUnitOrKg) {
  const q = Number(qty) || 0;
  const p = Number(pricePerUnitOrKg) || 0;
  if (unit === "g") return roundMoney((q / 1000) * p);
  return roundMoney(q * p);
}

function normalizeUnit(unit) {
  if (unit === "un") return "un";
  if (unit === "kg") return "kg";
  return "g";
}

function emptyState() {
  return {
    products: [],
    sessions: [],
    sales: [],
    stockMovements: [],
    suppliers: [],
    purchaseOrders: [],
    cart: [],
    settings: null,
    members: [],
    addons: [],
    role: "owner",
  };
}

function defaultSettings(userId) {
  return {
    userId,
    tradeName: "Minha loja",
    legalName: "",
    cnpj: "",
    ie: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    receiptMessage: "Obrigado pela preferência!",
    fiscalMode: "nao_fiscal",
    cscId: "",
    cscToken: "",
  };
}

function mapSettings(row, userId) {
  if (!row) return defaultSettings(userId);
  return {
    userId: row.user_id || userId,
    tradeName: row.trade_name || "Minha loja",
    legalName: row.legal_name || "",
    cnpj: row.cnpj || "",
    ie: row.ie || "",
    phone: row.phone || "",
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    zip: row.zip || "",
    receiptMessage: row.receipt_message || "Obrigado pela preferência!",
    fiscalMode: row.fiscal_mode || "nao_fiscal",
    cscId: row.csc_id || "",
    cscToken: row.csc_token || "",
  };
}

function cartLineTotal(item) {
  const base = lineTotal(item.qty, item.unit, item.unitPrice);
  const addons = (item.addons || []).reduce((s, a) => s + roundMoney(a.price || 0), 0);
  return roundMoney(base + addons);
}

function summarizePayments(payments, total) {
  const cleaned = (payments || [])
    .map((p) => ({ method: p.method, amount: roundMoney(p.amount) }))
    .filter((p) => p.amount > 0);
  const payTotal = roundMoney(cleaned.reduce((s, p) => s + p.amount, 0));
  const cash = roundMoney(cleaned.filter((p) => p.method === "dinheiro").reduce((s, p) => s + p.amount, 0));
  const nonCash = roundMoney(payTotal - cash);
  if (nonCash - total > 0.009) throw new Error(err("nonCashOverpay"));
  if (payTotal + 1e-9 < total) throw new Error(err("paymentInsufficient"));
  const change = roundMoney(Math.max(0, payTotal - total));
  if (change > 0.009 && cash + 1e-9 < change) throw new Error(err("changeNeedsCash"));
  return { cleaned, payTotal, change };
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    price: Number(row.price) || 0,
    cost: Number(row.cost) || 0,
    stock: Number(row.stock) || 0,
    minStock: Number(row.min_stock) || 0,
    active: row.active !== false,
    barcode: row.barcode || null,
    sku: row.sku || null,
  };
}

function sb() {
  return window.elERPSb;
}

function throwSb(error, fallbackKey) {
  if (!error) return;
  const msg = `${error.message || ""} ${error.code || ""} ${error.details || ""}`;
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(msg)) {
    const e = new Error("SCHEMA_MISSING");
    e.cause = error;
    throw e;
  }
  throw new Error(error.message || fallbackKey || "Supabase error");
}

const db = {
  state: emptyState(),
  userId: null,
  ready: false,
  onSync: null,
  onChange: null,
  _channel: null,
  _reloadTimer: null,
  _suppressRealtime: false,

  notify() {
    if (typeof this.onChange === "function") this.onChange(this.state);
  },

  localCartKey() {
    return `${STORAGE_KEY}.cart.${this.userId || "anon"}`;
  },

  readLocalCart() {
    try {
      return JSON.parse(localStorage.getItem(this.localCartKey()) || "[]");
    } catch {
      return [];
    }
  },

  writeLocalCart() {
    localStorage.setItem(this.localCartKey(), JSON.stringify(this.state.cart || []));
  },

  async bootstrap(userId) {
    this.userId = userId;
    this.ready = false;
    await this.reload();
    // Migração legada desligada por padrão (evita reidratar seeds antigos).
    if (window.elERPConfig?.migrateLegacy === true) {
      await this.maybeMigrateLegacyAppState();
      await this.reload();
    }
    await this.ensureStoreBootstrap();
    this.subscribeRealtime();
    this.ready = true;
    this.notify();
  },

  async reload() {
    const client = sb();
    if (!client || !this.userId) throw new Error("NO_SESSION");

    const uid = this.userId;
    const [
      productsRes,
      suppliersRes,
      sessionsRes,
      salesRes,
      movementsRes,
      ordersRes,
      settingsRes,
      membersRes,
      addonsRes,
    ] = await Promise.all([
      client.from("store_products").select("*").eq("user_id", uid).order("name"),
      client.from("store_suppliers").select("*").eq("user_id", uid).order("name"),
      client.from("cash_sessions").select("*").eq("user_id", uid).order("opened_at", { ascending: false }),
      client.from("sales").select("*").eq("user_id", uid).order("sold_at", { ascending: false }).limit(2000),
      client.from("stock_movements").select("*").eq("user_id", uid).order("at", { ascending: false }).limit(2000),
      client.from("purchase_orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      client.from("store_settings").select("*").eq("user_id", uid).maybeSingle(),
      client.from("store_members").select("*").eq("user_id", uid).order("created_at"),
      client.from("product_addons").select("*").eq("user_id", uid).order("name"),
    ]);

    // settings/members/addons podem faltar se extend_complete.sql ainda não rodou
    for (const res of [productsRes, suppliersRes, sessionsRes, salesRes, movementsRes, ordersRes]) {
      throwSb(res.error);
    }
    const optionalMissing = (res) =>
      res?.error && /relation .* does not exist|Could not find the table|schema cache/i.test(
        `${res.error.message || ""} ${res.error.code || ""}`
      );
    if (settingsRes.error && !optionalMissing(settingsRes)) throwSb(settingsRes.error);
    if (membersRes.error && !optionalMissing(membersRes)) throwSb(membersRes.error);
    if (addonsRes.error && !optionalMissing(addonsRes)) throwSb(addonsRes.error);

    const sales = salesRes.data || [];
    const saleIds = sales.map((s) => s.id);
    let items = [];
    let payments = [];
    let itemAddons = [];
    if (saleIds.length) {
      const [itemsRes, payRes] = await Promise.all([
        client.from("sale_items").select("*").in("sale_id", saleIds),
        client.from("sale_payments").select("*").in("sale_id", saleIds),
      ]);
      throwSb(itemsRes.error);
      throwSb(payRes.error);
      items = itemsRes.data || [];
      payments = payRes.data || [];
      const itemIds = items.map((i) => i.id);
      if (itemIds.length) {
        const iaRes = await client.from("sale_item_addons").select("*").in("sale_item_id", itemIds);
        if (!(iaRes.error && optionalMissing(iaRes))) {
          if (iaRes.error) throwSb(iaRes.error);
          itemAddons = iaRes.data || [];
        }
      }
    }

    const orderIds = (ordersRes.data || []).map((o) => o.id);
    let orderItems = [];
    if (orderIds.length) {
      const oiRes = await client.from("purchase_order_items").select("*").in("order_id", orderIds);
      throwSb(oiRes.error);
      orderItems = oiRes.data || [];
    }

    const members = optionalMissing(membersRes) ? [] : (membersRes.data || []).map((m) => ({
      id: m.id,
      email: m.email,
      role: m.role,
      active: m.active !== false,
      memberUserId: m.member_user_id,
    }));
    const owner = members.find((m) => m.role === "owner") || { role: "owner" };

    this.state = {
      products: (productsRes.data || []).map(mapProduct),
      settings: optionalMissing(settingsRes) ? defaultSettings(uid) : mapSettings(settingsRes.data, uid),
      members,
      role: owner.role || "owner",
      addons: optionalMissing(addonsRes)
        ? []
        : (addonsRes.data || []).map((a) => ({
            id: a.id,
            productId: a.product_id,
            name: a.name,
            price: Number(a.price) || 0,
            active: a.active !== false,
          })),
      suppliers: (suppliersRes.data || []).map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone || "",
      })),
      sessions: (sessionsRes.data || []).map((s) => ({
        id: s.id,
        status: s.status,
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        openingFloat: Number(s.opening_float) || 0,
        countedCash: s.counted_cash == null ? null : Number(s.counted_cash),
        expectedCash: s.expected_cash == null ? null : Number(s.expected_cash),
        difference: s.difference == null ? null : Number(s.difference),
        note: s.note || "",
        closeNote: s.close_note || "",
      })),
      sales: sales.map((s) => ({
        id: s.id,
        sessionId: s.session_id,
        status: s.status,
        fiscalStatus: s.fiscal_status || "none",
        total: Number(s.total) || 0,
        note: s.note || "",
        soldAt: s.sold_at,
        items: items
          .filter((i) => i.sale_id === s.id)
          .map((i) => ({
            id: i.id,
            productId: i.product_id,
            name: i.name,
            unit: i.unit,
            qty: Number(i.qty) || 0,
            unitPrice: Number(i.unit_price) || 0,
            costSnapshot: Number(i.cost_snapshot) || 0,
            lineTotal: Number(i.line_total) || 0,
            addons: itemAddons
              .filter((a) => a.sale_item_id === i.id)
              .map((a) => ({ id: a.addon_id, name: a.name, price: Number(a.price) || 0 })),
          })),
        payments: payments
          .filter((p) => p.sale_id === s.id)
          .map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })),
        changeAmount: Number(s.change_amount) || 0,
      })),
      stockMovements: (movementsRes.data || []).map((m) => ({
        id: m.id,
        productId: m.product_id,
        qtyDelta: Number(m.qty_delta) || 0,
        type: m.type,
        refId: m.ref_id,
        note: m.note || "",
        at: m.at,
      })),
      purchaseOrders: (ordersRes.data || []).map((o) => ({
        id: o.id,
        supplierId: o.supplier_id,
        supplierName: o.supplier_name,
        status: o.status,
        note: o.note || "",
        createdAt: o.created_at,
        receivedAt: o.received_at,
        items: orderItems
          .filter((i) => i.order_id === o.id)
          .map((i) => ({
            productId: i.product_id,
            name: i.name,
            unit: i.unit,
            qtyOrdered: Number(i.qty_ordered) || 0,
            qtyReceived: Number(i.qty_received) || 0,
            unitCost: Number(i.unit_cost) || 0,
          })),
      })),
      cart: this.readLocalCart(),
    };

    this.notify();
    return this.state;
  },

  scheduleReload() {
    if (this._suppressRealtime) return;
    clearTimeout(this._reloadTimer);
    this._reloadTimer = setTimeout(async () => {
      try {
        if (typeof this.onSync === "function") this.onSync("saving");
        await this.reload();
        if (typeof this.onSync === "function") this.onSync("saved");
      } catch (e) {
        if (typeof this.onSync === "function") this.onSync("error", e);
      }
    }, 250);
  },

  subscribeRealtime() {
    const client = sb();
    if (!client || !this.userId) return;
    if (this._channel) {
      client.removeChannel(this._channel);
      this._channel = null;
    }
    const tables = [
      "store_products",
      "store_suppliers",
      "cash_sessions",
      "sales",
      "sale_items",
      "sale_payments",
      "store_settings",
      "store_members",
      "product_addons",
      "sale_item_addons",
      "stock_movements",
      "purchase_orders",
      "purchase_order_items",
    ];
    let channel = client.channel(`elerp-${this.userId}`);
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => this.scheduleReload()
      );
    }
    this._channel = channel.subscribe();
  },

  async withWrite(fn) {
    this._suppressRealtime = true;
    try {
      if (typeof this.onSync === "function") this.onSync("saving");
      const result = await fn();
      await this.reload();
      if (typeof this.onSync === "function") this.onSync("saved");
      return result;
    } catch (e) {
      if (typeof this.onSync === "function") this.onSync("error", e);
      throw e;
    } finally {
      this._suppressRealtime = false;
    }
  },

  /** Migra blob legado app_state.products → store_products uma vez */
  async maybeMigrateLegacyAppState() {
    const client = sb();
    if (!client || !this.userId) return;
    if ((this.state.products || []).length) return;

    const { data, error } = await client
      .from("app_state")
      .select("data")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error || !data?.data?.products?.length) return;

    const legacy = data.data;
    await this.withWrite(async () => {
      for (const p of legacy.products) {
        const unit = normalizeUnit(p.unit);
        const stock = roundQty(p.stock || 0, unit);
        const minStock = roundQty(p.minStock || 0, unit);
        const { error: upErr } = await client.from("store_products").upsert({
          id: /^[0-9a-f-]{36}$/i.test(p.id) ? p.id : newId(),
          user_id: this.userId,
          name: p.name,
          unit,
          price: Number(p.price) || 0,
          cost: Number(p.cost) || 0,
          stock,
          min_stock: minStock,
          active: p.active !== false,
          barcode: p.barcode || null,
          sku: p.sku || null,
        });
        throwSb(upErr);
      }
      for (const s of legacy.suppliers || []) {
        const { error: sErr } = await client.from("store_suppliers").upsert({
          id: /^[0-9a-f-]{36}$/i.test(s.id) ? s.id : newId(),
          user_id: this.userId,
          name: s.name,
          phone: s.phone || "",
        });
        throwSb(sErr);
      }
      // limpa products do blob para não reimportar
      const next = { ...legacy, products: [], suppliers: [] };
      await client.from("app_state").upsert({ user_id: this.userId, data: next });
    });
  },

  clearSession() {
    if (this._channel && sb()) sb().removeChannel(this._channel);
    this._channel = null;
    this.userId = null;
    this.ready = false;
    this.state = emptyState();
  },

  async reset() {
    return this.withWrite(async () => {
      const client = sb();
      const uid = this.userId;
      // ordem por FKs
      const sales = (await client.from("sales").select("id").eq("user_id", uid)).data || [];
      const saleIds = sales.map((s) => s.id);
      if (saleIds.length) {
        await client.from("sale_payments").delete().in("sale_id", saleIds);
        await client.from("sale_items").delete().in("sale_id", saleIds);
      }
      await client.from("sales").delete().eq("user_id", uid);
      const orders = (await client.from("purchase_orders").select("id").eq("user_id", uid)).data || [];
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length) await client.from("purchase_order_items").delete().in("order_id", orderIds);
      await client.from("purchase_orders").delete().eq("user_id", uid);
      await client.from("stock_movements").delete().eq("user_id", uid);
      await client.from("cash_sessions").delete().eq("user_id", uid);
      await client.from("store_cart_items").delete().eq("user_id", uid);
      await client.from("store_products").delete().eq("user_id", uid);
      await client.from("store_suppliers").delete().eq("user_id", uid);
      this.state.cart = [];
      this.writeLocalCart();
    });
  },

  getOpenSession() {
    return this.state.sessions.find((s) => s.status === "open") || null;
  },

  listProducts({ onlyActive = true } = {}) {
    return this.state.products
      .filter((p) => (onlyActive ? p.active : true))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },

  findByBarcode(code) {
    const digits = String(code || "").replace(/\D/g, "");
    if (!digits) return null;
    return (
      this.state.products.find(
        (p) => p.active !== false && (p.barcode === digits || p.sku === digits)
      ) || null
    );
  },

  async upsertProduct(input) {
    return this.withWrite(async () => {
      const client = sb();
      const id = input.id && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : newId();
      const unit = normalizeUnit(input.unit);
      const payload = {
        id,
        user_id: this.userId,
        name: String(input.name || "").trim(),
        unit,
        price: roundMoney(input.price),
        cost: roundMoney(input.cost || 0),
        stock: roundQty(input.stock || 0, unit),
        min_stock: roundQty(input.minStock || 0, unit),
        active: input.active !== false,
        barcode: String(input.barcode || "").replace(/\D/g, "") || null,
        sku: String(input.sku || input.barcode || "").trim() || null,
      };
      if (!payload.name) throw new Error(err("invalidProductName"));
      if (payload.price < 0) throw new Error(err("invalidPrice"));

      const prev = this.state.products.find((p) => p.id === id);
      const { error } = await client.from("store_products").upsert(payload);
      throwSb(error);

      if (prev && prev.stock !== payload.stock) {
        const { error: mErr } = await client.from("stock_movements").insert({
          id: newId(),
          user_id: this.userId,
          product_id: id,
          qty_delta: payload.stock - prev.stock,
          type: "adjust",
          ref_id: id,
          note: "Ajuste manual",
          at: todayISO(),
        });
        throwSb(mErr);
      }
      return mapProduct({ ...payload, min_stock: payload.min_stock });
    });
  },

  async importCatalogItem(item, { stock = 0 } = {}) {
    if (!item?.name) throw new Error(err("invalidProductName"));
    const barcode = String(item.barcode || "").replace(/\D/g, "");
    const existing = barcode ? this.findByBarcode(barcode) : null;
    return this.upsertProduct({
      id: existing?.id,
      name: item.name,
      unit: normalizeUnit(item.unit),
      price: item.suggested_price ?? item.price ?? 0,
      cost: item.suggested_cost ?? item.cost ?? 0,
      stock: existing ? existing.stock : stock,
      minStock: existing?.minStock ?? 5,
      active: true,
      barcode,
      sku: item.sku || barcode,
    });
  },

  setCart(cart) {
    this.state.cart = cart;
    this.writeLocalCart();
    this.notify();
  },

  clearCart() {
    this.state.cart = [];
    this.writeLocalCart();
    this.notify();
  },

  async openSession(openingFloat, note = "") {
    return this.withWrite(async () => {
      if (this.getOpenSession()) throw new Error(err("alreadyOpen"));
      const row = {
        id: newId(),
        user_id: this.userId,
        status: "open",
        opened_at: todayISO(),
        opening_float: roundMoney(openingFloat),
        note: note || "",
      };
      const { error } = await sb().from("cash_sessions").insert(row);
      throwSb(error);
      return row;
    });
  },

  async closeSession(countedCash, note = "") {
    return this.withWrite(async () => {
      const session = this.getOpenSession();
      if (!session) throw new Error(err("noOpenSession"));
      const sales = this.state.sales.filter(
        (s) => s.sessionId === session.id && s.status === "confirmed"
      );
      const cashSales = sales.reduce((sum, sale) => {
        const cashIn = sale.payments
          .filter((p) => p.method === "dinheiro")
          .reduce((a, p) => a + p.amount, 0);
        return sum + cashIn - (sale.changeAmount || 0);
      }, 0);
      const expected = roundMoney(session.openingFloat + cashSales);
      const counted = roundMoney(countedCash);
      const { error } = await sb()
        .from("cash_sessions")
        .update({
          status: "closed",
          closed_at: todayISO(),
          expected_cash: expected,
          counted_cash: counted,
          difference: roundMoney(counted - expected),
          close_note: note || "",
        })
        .eq("id", session.id)
        .eq("user_id", this.userId);
      throwSb(error);
      this.clearCart();
      return { ...session, status: "closed", expectedCash: expected, countedCash: counted };
    });
  },

  async confirmSale({ payments, note = "", cartOverride = null } = {}) {
    return this.withWrite(async () => {
      const client = sb();
      const session = this.getOpenSession();
      if (!session) throw new Error(err("openBeforeSell"));
      const cart = cartOverride || this.state.cart;
      if (!cart.length) throw new Error(err("emptyCart"));

      for (const item of cart) {
        const product = this.state.products.find((p) => p.id === item.productId);
        if (!product || !product.active) throw new Error(err("invalidCartProduct"));
        if (product.stock + 1e-9 < item.qty) {
          throw new Error(err("stockInsufficientNamed", product.name));
        }
      }

      const saleItems = cart.map((item) => {
        const product = this.state.products.find((p) => p.id === item.productId);
        const unit = normalizeUnit(item.unit || product.unit);
        const addons = (item.addons || []).map((a) => ({
          id: a.id || null,
          name: a.name,
          price: roundMoney(a.price || 0),
        }));
        const base = lineTotal(item.qty, unit, item.unitPrice);
        const addonTotal = roundMoney(addons.reduce((s, a) => s + a.price, 0));
        return {
          id: newId(),
          productId: product.id,
          name: product.name,
          unit,
          qty: roundQty(item.qty, unit),
          unitPrice: roundMoney(item.unitPrice),
          costSnapshot: product.cost,
          lineTotal: roundMoney(base + addonTotal),
          addons,
        };
      });
      const total = roundMoney(saleItems.reduce((s, i) => s + i.lineTotal, 0));
      const { cleaned, change } = summarizePayments(payments, total);
      const fiscalStatus =
        this.state.settings?.fiscalMode === "nfce_futuro" ? "pendente_nfce" : "nao_fiscal";

      const saleId = newId();
      const soldAt = todayISO();
      const { error: sErr } = await client.from("sales").insert({
        id: saleId,
        user_id: this.userId,
        session_id: session.id,
        status: "confirmed",
        fiscal_status: fiscalStatus,
        total,
        change_amount: change,
        note: note || "",
        sold_at: soldAt,
      });
      throwSb(sErr);

      const { error: iErr } = await client.from("sale_items").insert(
        saleItems.map((i) => ({
          id: i.id,
          sale_id: saleId,
          product_id: i.productId,
          name: i.name,
          unit: i.unit,
          qty: i.qty,
          unit_price: i.unitPrice,
          cost_snapshot: i.costSnapshot,
          line_total: i.lineTotal,
        }))
      );
      throwSb(iErr);

      const addonRows = [];
      for (const i of saleItems) {
        for (const a of i.addons) {
          addonRows.push({
            id: newId(),
            sale_item_id: i.id,
            addon_id: a.id,
            name: a.name,
            price: a.price,
          });
        }
      }
      if (addonRows.length) {
        const { error: aErr } = await client.from("sale_item_addons").insert(addonRows);
        if (aErr && !/relation .* does not exist|Could not find the table/i.test(aErr.message || "")) {
          throwSb(aErr);
        }
      }

      const { error: pErr } = await client.from("sale_payments").insert(
        cleaned.map((p) => ({
          id: newId(),
          sale_id: saleId,
          method: p.method,
          amount: p.amount,
        }))
      );
      throwSb(pErr);

      for (const item of saleItems) {
        const product = this.state.products.find((p) => p.id === item.productId);
        const nextStock = roundQty(product.stock - item.qty, item.unit);
        const { error: uErr } = await client
          .from("store_products")
          .update({ stock: nextStock })
          .eq("id", item.productId)
          .eq("user_id", this.userId);
        throwSb(uErr);
        const { error: mErr } = await client.from("stock_movements").insert({
          id: newId(),
          user_id: this.userId,
          product_id: item.productId,
          qty_delta: -item.qty,
          type: "sale",
          ref_id: saleId,
          note: "Venda",
          at: soldAt,
        });
        throwSb(mErr);
      }

      if (!cartOverride) {
        this.state.cart = [];
        this.writeLocalCart();
      }
      return {
        id: saleId,
        total,
        change,
        soldAt,
        fiscalStatus,
        items: saleItems,
        payments: cleaned,
      };
    });
  },

  async cancelSale(saleId) {
    return this.withWrite(async () => {
      const client = sb();
      const sale = this.state.sales.find((s) => s.id === saleId);
      if (!sale) throw new Error(err("saleNotFound"));
      if (sale.status === "cancelled") return sale;
      const session = this.state.sessions.find((s) => s.id === sale.sessionId);
      if (!session || session.status !== "open") throw new Error(err("cancelOnlyOpen"));

      const { error } = await client
        .from("sales")
        .update({ status: "cancelled" })
        .eq("id", saleId)
        .eq("user_id", this.userId);
      throwSb(error);

      for (const item of sale.items) {
        const product = this.state.products.find((p) => p.id === item.productId);
        if (!product) continue;
        const nextStock = roundQty(product.stock + item.qty, item.unit || product.unit);
        await client
          .from("store_products")
          .update({ stock: nextStock })
          .eq("id", item.productId)
          .eq("user_id", this.userId);
        await client.from("stock_movements").insert({
          id: newId(),
          user_id: this.userId,
          product_id: item.productId,
          qty_delta: item.qty,
          type: "sale_cancel",
          ref_id: saleId,
          note: "Cancelamento",
          at: todayISO(),
        });
      }
      return sale;
    });
  },

  async createPurchaseOrder({ supplierId, items, note = "" }) {
    return this.withWrite(async () => {
      if (!items?.length) throw new Error(err("orderNeedsItems"));
      const supplier = this.state.suppliers.find((s) => s.id === supplierId);
      if (!supplier) throw new Error(err("invalidSupplier"));
      const orderId = newId();
      const client = sb();
      const { error } = await client.from("purchase_orders").insert({
        id: orderId,
        user_id: this.userId,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        status: "draft",
        note: note || "",
        created_at: todayISO(),
      });
      throwSb(error);

      const rows = items.map((i) => {
        const product = this.state.products.find((p) => p.id === i.productId);
        if (!product) throw new Error(err("invalidOrderProduct"));
        return {
          id: newId(),
          order_id: orderId,
          product_id: product.id,
          name: product.name,
          unit: product.unit,
          qty_ordered: roundQty(i.qty, product.unit),
          qty_received: 0,
          unit_cost: roundMoney(i.unitCost ?? product.cost),
        };
      });
      const { error: iErr } = await client.from("purchase_order_items").insert(rows);
      throwSb(iErr);
      return { id: orderId };
    });
  },

  async markPurchaseSent(orderId) {
    return this.withWrite(async () => {
      const order = this.state.purchaseOrders.find((o) => o.id === orderId);
      if (!order) throw new Error(err("orderNotFound"));
      if (order.status !== "draft") throw new Error(err("orderAlreadyProcessed"));
      const { error } = await sb()
        .from("purchase_orders")
        .update({ status: "sent" })
        .eq("id", orderId)
        .eq("user_id", this.userId);
      throwSb(error);
    });
  },

  async receivePurchaseOrder(orderId, receipts) {
    return this.withWrite(async () => {
      const client = sb();
      const order = this.state.purchaseOrders.find((o) => o.id === orderId);
      if (!order) throw new Error(err("orderNotFound"));
      if (order.status === "received" || order.status === "cancelled") {
        throw new Error(err("orderCannotReceive"));
      }

      let any = false;
      for (const rec of receipts) {
        const line = order.items.find((i) => i.productId === rec.productId);
        if (!line) continue;
        const unit = normalizeUnit(line.unit);
        const qty = roundQty(rec.qty || 0, unit);
        if (qty <= 0) continue;
        const remaining = roundQty(line.qtyOrdered - line.qtyReceived, unit);
        const apply = Math.min(qty, remaining);
        if (apply <= 0) continue;
        any = true;
        const nextReceived = roundQty(line.qtyReceived + apply, unit);
        await client
          .from("purchase_order_items")
          .update({ qty_received: nextReceived })
          .eq("order_id", orderId)
          .eq("product_id", line.productId);

        const product = this.state.products.find((p) => p.id === line.productId);
        if (product) {
          await client
            .from("store_products")
            .update({
              stock: roundQty(product.stock + apply, product.unit),
              cost: line.unitCost,
            })
            .eq("id", product.id)
            .eq("user_id", this.userId);
          await client.from("stock_movements").insert({
            id: newId(),
            user_id: this.userId,
            product_id: product.id,
            qty_delta: apply,
            type: "purchase_in",
            ref_id: orderId,
            note: "Recebimento",
            at: todayISO(),
          });
        }
      }
      if (!any) throw new Error(err("nothingReceived"));

      // reload mid-transaction state for status calc
      const { data: lines } = await client
        .from("purchase_order_items")
        .select("*")
        .eq("order_id", orderId);
      const complete = (lines || []).every(
        (i) => Number(i.qty_received) + 1e-9 >= Number(i.qty_ordered)
      );
      await client
        .from("purchase_orders")
        .update({
          status: complete ? "received" : "partial",
          received_at: complete ? todayISO() : null,
        })
        .eq("id", orderId)
        .eq("user_id", this.userId);
    });
  },

  // ensure at least empty supplier list can grow from UI later
  async ensureDefaultSupplier() {
    if (this.state.suppliers.length) return;
    await this.withWrite(async () => {
      const { error } = await sb().from("store_suppliers").insert({
        id: newId(),
        user_id: this.userId,
        name: "Fornecedor geral",
        phone: "",
      });
      throwSb(error);
    });
  },


  async ensureStoreBootstrap() {
    const client = sb();
    if (!client || !this.userId) return;
    try {
      const { data } = await client
        .from("store_settings")
        .select("user_id")
        .eq("user_id", this.userId)
        .maybeSingle();
      if (!data) {
        await client.from("store_settings").upsert({
          user_id: this.userId,
          trade_name: "Minha loja",
          receipt_message: "Obrigado pela preferência!",
          fiscal_mode: "nao_fiscal",
        });
      }
      const { data: members } = await client
        .from("store_members")
        .select("id")
        .eq("user_id", this.userId)
        .eq("role", "owner")
        .limit(1);
      if (!(members || []).length) {
        const email = (await client.auth.getUser()).data?.user?.email || "owner@local";
        await client.from("store_members").upsert(
          {
            id: newId(),
            user_id: this.userId,
            member_user_id: this.userId,
            email,
            role: "owner",
            active: true,
          },
          { onConflict: "user_id,email" }
        );
      }
      await this.reload();
    } catch (e) {
      // extend_complete.sql ainda não aplicado
      if (!this.state.settings) this.state.settings = defaultSettings(this.userId);
      if (!this.state.role) this.state.role = "owner";
    }
  },

  canManage() {
    return this.state.role === "owner" || this.state.role === "manager";
  },

  canEditStore() {
    return this.state.role === "owner";
  },

  listAddonsForProduct(productId) {
    return (this.state.addons || []).filter((a) => a.productId === productId && a.active);
  },

  async saveSettings(input) {
    if (!this.canEditStore()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const payload = {
        user_id: this.userId,
        trade_name: String(input.tradeName || "").trim() || "Minha loja",
        legal_name: String(input.legalName || "").trim(),
        cnpj: String(input.cnpj || "").trim(),
        ie: String(input.ie || "").trim(),
        phone: String(input.phone || "").trim(),
        address: String(input.address || "").trim(),
        city: String(input.city || "").trim(),
        state: String(input.state || "").trim().toUpperCase().slice(0, 2),
        zip: String(input.zip || "").trim(),
        receipt_message: String(input.receiptMessage || "").trim(),
        fiscal_mode: input.fiscalMode === "nfce_futuro" ? "nfce_futuro" : "nao_fiscal",
        csc_id: String(input.cscId || "").trim(),
        csc_token: String(input.cscToken || "").trim(),
        updated_at: todayISO(),
      };
      const { error } = await sb().from("store_settings").upsert(payload);
      throwSb(error);
    });
  },

  async upsertMember({ id, email, role }) {
    if (!this.canEditStore()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const cleanEmail = String(email || "").trim().toLowerCase();
      if (!cleanEmail) throw new Error(err("invalidEmail"));
      const r = ["owner", "manager", "cashier"].includes(role) ? role : "cashier";
      if (r === "owner") throw new Error(err("cannotAddOwner"));
      const payload = {
        id: id && /^[0-9a-f-]{36}$/i.test(id) ? id : newId(),
        user_id: this.userId,
        email: cleanEmail,
        role: r,
        active: true,
      };
      const { error } = await sb().from("store_members").upsert(payload, { onConflict: "user_id,email" });
      throwSb(error);
    });
  },

  async removeMember(id) {
    if (!this.canEditStore()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const row = this.state.members.find((m) => m.id === id);
      if (!row) return;
      if (row.role === "owner") throw new Error(err("cannotRemoveOwner"));
      const { error } = await sb().from("store_members").delete().eq("id", id).eq("user_id", this.userId);
      throwSb(error);
    });
  },

  async upsertAddon({ id, productId, name, price, active = true }) {
    if (!this.canManage()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const payload = {
        id: id && /^[0-9a-f-]{36}$/i.test(id) ? id : newId(),
        user_id: this.userId,
        product_id: productId,
        name: String(name || "").trim(),
        price: roundMoney(price || 0),
        active: active !== false,
      };
      if (!payload.name) throw new Error(err("invalidProductName"));
      const { error } = await sb().from("product_addons").upsert(payload);
      throwSb(error);
      return payload;
    });
  },

  async deleteAddon(id) {
    if (!this.canManage()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const { error } = await sb().from("product_addons").delete().eq("id", id).eq("user_id", this.userId);
      throwSb(error);
    });
  },

  async upsertSupplier({ id, name, phone = "" }) {
    if (!this.canManage()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const payload = {
        id: id && /^[0-9a-f-]{36}$/i.test(id) ? id : newId(),
        user_id: this.userId,
        name: String(name || "").trim(),
        phone: String(phone || "").trim(),
      };
      if (!payload.name) throw new Error(err("invalidSupplier"));
      const { error } = await sb().from("store_suppliers").upsert(payload);
      throwSb(error);
      return payload;
    });
  },

  async deleteSupplier(id) {
    if (!this.canManage()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const { error } = await sb().from("store_suppliers").delete().eq("id", id).eq("user_id", this.userId);
      throwSb(error);
    });
  },

  async adjustStock(productId, qtyDelta, note = "") {
    if (!this.canManage()) throw new Error(err("forbidden"));
    return this.withWrite(async () => {
      const product = this.state.products.find((p) => p.id === productId);
      if (!product) throw new Error(err("productNotFound"));
      const delta = roundQty(qtyDelta, product.unit);
      if (!delta) throw new Error(err("nothingReceived"));
      const next = roundQty(product.stock + delta, product.unit);
      if (next < -1e-9) throw new Error(err("stockInsufficientNamed", product.name));
      const client = sb();
      const { error } = await client
        .from("store_products")
        .update({ stock: next })
        .eq("id", productId)
        .eq("user_id", this.userId);
      throwSb(error);
      const { error: mErr } = await client.from("stock_movements").insert({
        id: newId(),
        user_id: this.userId,
        product_id: productId,
        qty_delta: delta,
        type: "adjust",
        ref_id: productId,
        note: note || "Ajuste de inventário",
        at: todayISO(),
      });
      throwSb(mErr);
    });
  },

  reportForPeriod({ fromIso, toIso } = {}) {
    const from = fromIso ? new Date(fromIso).getTime() : 0;
    const to = toIso ? new Date(toIso).getTime() : Date.now();
    const sales = this.state.sales.filter((s) => {
      if (s.status !== "confirmed") return false;
      const t = new Date(s.soldAt).getTime();
      return t >= from && t <= to;
    });
    const byMethod = { dinheiro: 0, pix: 0, cartao: 0 };
    const byProduct = {};
    let total = 0;
    let cost = 0;
    let gramsSold = 0;
    for (const sale of sales) {
      total += sale.total;
      for (const p of sale.payments) {
        byMethod[p.method] = roundMoney((byMethod[p.method] || 0) + p.amount);
      }
      for (const item of sale.items) {
        const key = item.productId || item.name;
        if (!byProduct[key]) {
          byProduct[key] = { name: item.name, unit: item.unit, qty: 0, total: 0, cost: 0 };
        }
        byProduct[key].qty = roundQty(byProduct[key].qty + item.qty, item.unit);
        byProduct[key].total = roundMoney(byProduct[key].total + item.lineTotal);
        const lineCost = roundMoney((item.costSnapshot || 0) * (item.unit === "g" ? item.qty / 1000 : item.qty));
        byProduct[key].cost = roundMoney(byProduct[key].cost + lineCost);
        cost += lineCost;
        if (item.unit === "g") gramsSold += item.qty;
        else if (item.unit === "kg") gramsSold += item.qty * 1000;
      }
    }
    return {
      salesCount: sales.length,
      total: roundMoney(total),
      cost: roundMoney(cost),
      margin: roundMoney(total - cost),
      byMethod,
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      gramsSold: roundQty(gramsSold, "g"),
      sales,
    };
  },

    sessionSales(sessionId) {
    return this.state.sales.filter((s) => s.sessionId === sessionId && s.status === "confirmed");
  },

  reportForSession(sessionId) {
    const sales = this.sessionSales(sessionId);
    const byMethod = { dinheiro: 0, pix: 0, cartao: 0 };
    const byProduct = {};
    let total = 0;
    let gramsSold = 0;

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
        if (item.unit === "g") gramsSold += item.qty;
        else if (item.unit === "kg") gramsSold += item.qty * 1000;
      }
    }

    return {
      salesCount: sales.length,
      total: roundMoney(total),
      byMethod,
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      gramsSold: roundQty(gramsSold, "g"),
      kgSold: roundQty(gramsSold / 1000, "kg"),
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
    return `${n.toLocaleString(locale, { maximumFractionDigits: 3 })} kg`;
  }
  if (unit === "g") {
    return `${Math.round(n).toLocaleString(locale)} g`;
  }
  return `${n.toLocaleString(locale, { maximumFractionDigits: 3 })} un`;
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

window.elERP = {
  db,
  uid: newId,
  roundMoney,
  roundQty,
  lineTotal,
  cartLineTotal,
  formatMoney,
  formatQty,
  formatDateTime,
};
})();
