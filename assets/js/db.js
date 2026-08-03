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

function roundQty(n) {
  return Math.round(Number(n) + Number.EPSILON);
}

function lineTotal(qty, unit, pricePerUnitOrKg) {
  const q = Number(qty) || 0;
  const p = Number(pricePerUnitOrKg) || 0;
  if (unit === "g") return roundMoney((q / 1000) * p);
  return roundMoney(q * p);
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
  };
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
    await this.maybeMigrateLegacyAppState();
    await this.reload();
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
    ] = await Promise.all([
      client.from("store_products").select("*").eq("user_id", uid).order("name"),
      client.from("store_suppliers").select("*").eq("user_id", uid).order("name"),
      client.from("cash_sessions").select("*").eq("user_id", uid).order("opened_at", { ascending: false }),
      client.from("sales").select("*").eq("user_id", uid).order("sold_at", { ascending: false }).limit(500),
      client.from("stock_movements").select("*").eq("user_id", uid).order("at", { ascending: false }).limit(500),
      client.from("purchase_orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    ]);

    for (const res of [productsRes, suppliersRes, sessionsRes, salesRes, movementsRes, ordersRes]) {
      throwSb(res.error);
    }

    const sales = salesRes.data || [];
    const saleIds = sales.map((s) => s.id);
    let items = [];
    let payments = [];
    if (saleIds.length) {
      const [itemsRes, payRes] = await Promise.all([
        client.from("sale_items").select("*").in("sale_id", saleIds),
        client.from("sale_payments").select("*").in("sale_id", saleIds),
      ]);
      throwSb(itemsRes.error);
      throwSb(payRes.error);
      items = itemsRes.data || [];
      payments = payRes.data || [];
    }

    const orderIds = (ordersRes.data || []).map((o) => o.id);
    let orderItems = [];
    if (orderIds.length) {
      const oiRes = await client.from("purchase_order_items").select("*").in("order_id", orderIds);
      throwSb(oiRes.error);
      orderItems = oiRes.data || [];
    }

    this.state = {
      products: (productsRes.data || []).map(mapProduct),
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
            productId: i.product_id,
            name: i.name,
            unit: i.unit,
            qty: Number(i.qty) || 0,
            unitPrice: Number(i.unit_price) || 0,
            costSnapshot: Number(i.cost_snapshot) || 0,
            lineTotal: Number(i.line_total) || 0,
          })),
        payments: payments
          .filter((p) => p.sale_id === s.id)
          .map((p) => ({ method: p.method, amount: Number(p.amount) || 0 })),
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
        let unit = p.unit === "un" ? "un" : "g";
        let stock = Number(p.stock) || 0;
        let minStock = Number(p.minStock) || 0;
        if (p.unit === "kg") {
          unit = "g";
          stock = roundQty(stock * 1000);
          minStock = roundQty(minStock * 1000);
        }
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
      const unit = input.unit === "un" ? "un" : "g";
      const payload = {
        id,
        user_id: this.userId,
        name: String(input.name || "").trim(),
        unit,
        price: roundMoney(input.price),
        cost: roundMoney(input.cost || 0),
        stock: roundQty(input.stock || 0),
        min_stock: roundQty(input.minStock || 0),
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
      unit: item.unit === "g" ? "g" : "un",
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
        return (
          sum +
          sale.payments
            .filter((p) => p.method === "dinheiro")
            .reduce((a, p) => a + p.amount, 0)
        );
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

  async confirmSale({ payments, note = "" }) {
    return this.withWrite(async () => {
      const client = sb();
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

      const saleItems = cart.map((item) => {
        const product = this.state.products.find((p) => p.id === item.productId);
        return {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          qty: roundQty(item.qty),
          unitPrice: roundMoney(item.unitPrice),
          costSnapshot: product.cost,
          lineTotal: lineTotal(item.qty, item.unit, item.unitPrice),
        };
      });
      const total = roundMoney(saleItems.reduce((s, i) => s + i.lineTotal, 0));
      const payTotal = roundMoney(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
      if (Math.abs(payTotal - total) > 0.009) throw new Error(err("paymentMismatch"));

      const saleId = newId();
      const { error: sErr } = await client.from("sales").insert({
        id: saleId,
        user_id: this.userId,
        session_id: session.id,
        status: "confirmed",
        fiscal_status: "none",
        total,
        note: note || "",
        sold_at: todayISO(),
      });
      throwSb(sErr);

      const { error: iErr } = await client.from("sale_items").insert(
        saleItems.map((i) => ({
          id: newId(),
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

      const { error: pErr } = await client.from("sale_payments").insert(
        payments.map((p) => ({
          id: newId(),
          sale_id: saleId,
          method: p.method,
          amount: roundMoney(p.amount),
        }))
      );
      throwSb(pErr);

      for (const item of saleItems) {
        const product = this.state.products.find((p) => p.id === item.productId);
        const nextStock = roundQty(product.stock - item.qty);
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
          at: todayISO(),
        });
        throwSb(mErr);
      }

      this.state.cart = [];
      this.writeLocalCart();
      return { id: saleId, total };
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
        const nextStock = roundQty(product.stock + item.qty);
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
          qty_ordered: roundQty(i.qty),
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
        const qty = roundQty(rec.qty || 0);
        if (qty <= 0) continue;
        const remaining = roundQty(line.qtyOrdered - line.qtyReceived);
        const apply = Math.min(qty, remaining);
        if (apply <= 0) continue;
        any = true;
        const nextReceived = roundQty(line.qtyReceived + apply);
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
              stock: roundQty(product.stock + apply),
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
          byProduct[item.productId].qty + item.qty
        );
        byProduct[item.productId].total = roundMoney(
          byProduct[item.productId].total + item.lineTotal
        );
        if (item.unit === "g") gramsSold += item.qty;
      }
    }

    return {
      salesCount: sales.length,
      total: roundMoney(total),
      byMethod,
      byProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
      gramsSold: roundQty(gramsSold),
      kgSold: roundQty(gramsSold),
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
  if (unit === "g" || unit === "kg") {
    const grams = unit === "kg" ? Math.round(n * 1000) : Math.round(n);
    return `${grams.toLocaleString(locale)} g`;
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

window.elERP = {
  db,
  uid: newId,
  roundMoney,
  roundQty,
  lineTotal,
  formatMoney,
  formatQty,
  formatDateTime,
};
})();
