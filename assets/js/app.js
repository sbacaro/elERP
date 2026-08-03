const { db, roundMoney, roundQty, formatMoney, formatQty, formatDateTime } = window.elERP;

const ui = {
  toastEl: document.getElementById("toast"),
  sessionPill: document.getElementById("sessionPill"),
  panels: [...document.querySelectorAll(".panel")],
  navButtons: [...document.querySelectorAll(".nav button")],
};

function toast(message, isError = false) {
  ui.toastEl.textContent = message;
  ui.toastEl.classList.toggle("error", isError);
  ui.toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ui.toastEl.classList.remove("show"), 2800);
}

function money(n) {
  return formatMoney(n);
}

function switchPanel(id) {
  ui.panels.forEach((p) => p.classList.toggle("active", p.id === id));
  ui.navButtons.forEach((b) => {
    b.setAttribute("aria-current", b.dataset.panel === id ? "page" : "false");
  });
  if (id === "panel-pos") renderPos();
  if (id === "panel-products") renderProducts();
  if (id === "panel-purchases") renderPurchases();
  if (id === "panel-day") renderDay();
}

function refreshSessionPill() {
  const open = db.getOpenSession();
  ui.sessionPill.dataset.open = open ? "true" : "false";
  ui.sessionPill.innerHTML = open
    ? `<span class="dot"></span> Caixa aberto · fundo ${money(open.openingFloat)}`
    : `<span class="dot"></span> Caixa fechado`;
}

/* ---------- Dialogs ---------- */

function openDialog(title, bodyHtml, onConfirm, confirmLabel = "Confirmar") {
  const backdrop = document.getElementById("dialogBackdrop");
  const titleEl = document.getElementById("dialogTitle");
  const bodyEl = document.getElementById("dialogBody");
  const confirmBtn = document.getElementById("dialogConfirm");
  const cancelBtn = document.getElementById("dialogCancel");

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  confirmBtn.textContent = confirmLabel;
  backdrop.classList.add("open");

  const close = () => {
    backdrop.classList.remove("open");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = close;
  confirmBtn.onclick = () => {
    try {
      onConfirm(bodyEl);
      close();
    } catch (err) {
      toast(err.message || String(err), true);
    }
  };
}

/* ---------- POS ---------- */

function renderPos() {
  const open = db.getOpenSession();
  const gate = document.getElementById("posGate");
  const workspace = document.getElementById("posWorkspace");

  if (!open) {
    gate.hidden = false;
    workspace.hidden = true;
    return;
  }

  gate.hidden = true;
  workspace.hidden = false;

  const q = (document.getElementById("productSearch").value || "").trim().toLowerCase();
  const products = db.listProducts().filter((p) => !q || p.name.toLowerCase().includes(q));
  const grid = document.getElementById("productGrid");
  grid.innerHTML = products
    .map((p) => {
      const low = p.stock <= p.minStock;
      return `
        <button type="button" class="product-tile" data-add="${p.id}">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${money(p.price)} / ${p.unit}</span>
          <span class="stock ${low ? "low" : ""}">${formatQty(p.stock, p.unit)}${low ? " · baixo" : ""}</span>
        </button>`;
    })
    .join("");

  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  const cart = db.state.cart;
  if (!cart.length) {
    list.innerHTML = `<li class="empty">Toque em um sabor ou item para começar.</li>`;
  } else {
    list.innerHTML = cart
      .map((item, idx) => {
        const line = roundMoney(item.qty * item.unitPrice);
        return `
          <li class="cart-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="meta">${formatQty(item.qty, item.unit)} × ${money(item.unitPrice)}</div>
            </div>
            <div style="text-align:right">
              <strong>${money(line)}</strong>
              <div><button type="button" class="btn btn-ghost btn-sm" data-remove-cart="${idx}">remover</button></div>
            </div>
          </li>`;
      })
      .join("");
  }

  const total = roundMoney(cart.reduce((s, i) => s + i.qty * i.unitPrice, 0));
  document.getElementById("cartTotal").textContent = money(total);

  const payInput = document.getElementById("payAmount");
  if (document.activeElement !== payInput) {
    payInput.value = total ? total.toFixed(2) : "";
  }
}

function addProductToCart(productId) {
  const product = db.state.products.find((p) => p.id === productId);
  if (!product) return;

  if (product.unit === "un") {
    const cart = db.state.cart.slice();
    const existing = cart.find((c) => c.productId === product.id && c.unit === "un");
    const nextQty = (existing?.qty || 0) + 1;
    if (nextQty > product.stock) {
      toast("Estoque insuficiente.", true);
      return;
    }
    if (existing) existing.qty = nextQty;
    else {
      cart.push({
        productId: product.id,
        name: product.name,
        unit: "un",
        qty: 1,
        unitPrice: product.price,
      });
    }
    db.setCart(cart);
    renderCart();
    return;
  }

  openDialog(
    `Peso · ${product.name}`,
    `
      <p class="muted">Preço: ${money(product.price)} / kg · Estoque: ${formatQty(product.stock, "kg")}</p>
      <div class="field">
        <label for="dlgWeight">Peso (kg)</label>
        <input id="dlgWeight" type="number" min="0.001" step="0.001" placeholder="ex: 0.385" autofocus />
      </div>
    `,
    (body) => {
      const qty = roundQty(body.querySelector("#dlgWeight").value, "kg");
      if (!(qty > 0)) throw new Error("Informe um peso válido.");
      if (qty > product.stock) throw new Error("Estoque insuficiente.");
      const cart = db.state.cart.slice();
      cart.push({
        productId: product.id,
        name: product.name,
        unit: "kg",
        qty,
        unitPrice: product.price,
      });
      db.setCart(cart);
      renderCart();
      toast(`${product.name}: ${formatQty(qty, "kg")}`);
    },
    "Adicionar"
  );

  requestAnimationFrame(() => {
    document.getElementById("dlgWeight")?.focus();
  });
}

function checkout() {
  try {
    if (!db.getOpenSession()) throw new Error("Abra o caixa antes de vender.");
    if (!db.state.cart.length) throw new Error("Carrinho vazio.");
    const method = document.getElementById("payMethod").value;
    const amount = roundMoney(document.getElementById("payAmount").value);
    const total = roundMoney(db.state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0));
    if (Math.abs(amount - total) > 0.009) {
      throw new Error("Ajuste o valor pago para fechar exatamente o total.");
    }
    const sale = db.confirmSale({ payments: [{ method, amount }] });
    toast(`Venda ${money(sale.total)} registrada`);
    renderPos();
    refreshSessionPill();
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

/* ---------- Products ---------- */

function renderProducts() {
  const tbody = document.getElementById("productsBody");
  const rows = db.listProducts({ onlyActive: false });
  tbody.innerHTML = rows
    .map((p) => {
      const low = p.active && p.stock <= p.minStock;
      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${p.unit}</td>
          <td>${money(p.price)}</td>
          <td>${money(p.cost)}</td>
          <td>${formatQty(p.stock, p.unit)} ${low ? '<span class="badge warn">mín.</span>' : ""}</td>
          <td>${p.active ? '<span class="badge ok">ativo</span>' : '<span class="badge">inativo</span>'}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}">editar</button></td>
        </tr>`;
    })
    .join("");
}

function openProductForm(product = null) {
  openDialog(
    product ? "Editar produto" : "Novo produto",
    `
      <div class="field">
        <label>Nome</label>
        <input id="pName" value="${escapeAttr(product?.name || "")}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Unidade</label>
          <select id="pUnit">
            <option value="kg" ${!product || product.unit === "kg" ? "selected" : ""}>kg</option>
            <option value="un" ${product?.unit === "un" ? "selected" : ""}>un</option>
          </select>
        </div>
        <div class="field">
          <label>Preço</label>
          <input id="pPrice" type="number" min="0" step="0.01" value="${product?.price ?? ""}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Custo</label>
          <input id="pCost" type="number" min="0" step="0.01" value="${product?.cost ?? 0}" />
        </div>
        <div class="field">
          <label>Estoque</label>
          <input id="pStock" type="number" min="0" step="0.001" value="${product?.stock ?? 0}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Estoque mínimo</label>
          <input id="pMin" type="number" min="0" step="0.001" value="${product?.minStock ?? 0}" />
        </div>
        <div class="field">
          <label>Status</label>
          <select id="pActive">
            <option value="1" ${product?.active !== false ? "selected" : ""}>Ativo</option>
            <option value="0" ${product?.active === false ? "selected" : ""}>Inativo</option>
          </select>
        </div>
      </div>
    `,
    (body) => {
      db.upsertProduct({
        id: product?.id,
        name: body.querySelector("#pName").value,
        unit: body.querySelector("#pUnit").value,
        price: body.querySelector("#pPrice").value,
        cost: body.querySelector("#pCost").value,
        stock: body.querySelector("#pStock").value,
        minStock: body.querySelector("#pMin").value,
        active: body.querySelector("#pActive").value === "1",
      });
      toast("Produto salvo");
      renderProducts();
      renderPos();
    },
    "Salvar"
  );
}

/* ---------- Purchases ---------- */

function renderPurchases() {
  const tbody = document.getElementById("purchasesBody");
  const orders = db.state.purchaseOrders;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum pedido ainda.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders
    .map((o) => {
      const total = roundMoney(o.items.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0));
      const statusBadge =
        o.status === "received"
          ? "ok"
          : o.status === "partial"
            ? "warn"
            : o.status === "sent"
              ? ""
              : "";
      return `
        <tr>
          <td>${formatDateTime(o.createdAt)}</td>
          <td>${escapeHtml(o.supplierName)}</td>
          <td><span class="badge ${statusBadge}">${o.status}</span></td>
          <td>${o.items.length} item(ns)</td>
          <td>${money(total)}</td>
          <td>
            ${o.status === "draft" ? `<button class="btn btn-secondary btn-sm" data-po-send="${o.id}">enviar</button>` : ""}
            ${o.status === "sent" || o.status === "partial" ? `<button class="btn btn-sm" data-po-receive="${o.id}">receber</button>` : ""}
          </td>
        </tr>`;
    })
    .join("");
}

function openNewPurchase() {
  const products = db.listProducts();
  const suppliers = db.state.suppliers;
  const options = products
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.unit})</option>`)
    .join("");
  const supplierOptions = suppliers
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");

  openDialog(
    "Novo pedido de compra",
    `
      <div class="field">
        <label>Fornecedor</label>
        <select id="poSupplier">${supplierOptions}</select>
      </div>
      <div class="field">
        <label>Produto</label>
        <select id="poProduct">${options}</select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Quantidade</label>
          <input id="poQty" type="number" min="0.001" step="0.001" value="5" />
        </div>
        <div class="field">
          <label>Custo unitário</label>
          <input id="poCost" type="number" min="0" step="0.01" />
        </div>
      </div>
      <div class="field">
        <label>Observação</label>
        <input id="poNote" placeholder="opcional" />
      </div>
      <p class="muted">MVP: um item por pedido. Depois expandimos para vários itens.</p>
    `,
    (body) => {
      const productId = body.querySelector("#poProduct").value;
      const product = db.state.products.find((p) => p.id === productId);
      const costRaw = body.querySelector("#poCost").value;
      db.createPurchaseOrder({
        supplierId: body.querySelector("#poSupplier").value,
        note: body.querySelector("#poNote").value,
        items: [
          {
            productId,
            qty: body.querySelector("#poQty").value,
            unitCost: costRaw === "" ? product.cost : costRaw,
          },
        ],
      });
      toast("Pedido criado");
      renderPurchases();
    },
    "Criar pedido"
  );

  const productSelect = document.getElementById("poProduct");
  const costInput = document.getElementById("poCost");
  const syncCost = () => {
    const p = db.state.products.find((x) => x.id === productSelect.value);
    if (p) costInput.value = p.cost;
  };
  productSelect.onchange = syncCost;
  syncCost();
}

function receivePurchase(orderId) {
  const order = db.state.purchaseOrders.find((o) => o.id === orderId);
  if (!order) return;
  const fields = order.items
    .map((i) => {
      const remaining = roundQty(i.qtyOrdered - i.qtyReceived, i.unit);
      return `
        <div class="field">
          <label>${escapeHtml(i.name)} (falta ${formatQty(remaining, i.unit)})</label>
          <input data-rec="${i.productId}" type="number" min="0" step="0.001" value="${remaining}" />
        </div>`;
    })
    .join("");

  openDialog(
    "Receber pedido",
    fields,
    (body) => {
      const receipts = [...body.querySelectorAll("[data-rec]")].map((el) => ({
        productId: el.dataset.rec,
        qty: el.value,
      }));
      db.receivePurchaseOrder(orderId, receipts);
      toast("Recebimento registrado");
      renderPurchases();
      renderProducts();
      renderPos();
    },
    "Confirmar recebimento"
  );
}

/* ---------- Day / cash ---------- */

function renderDay() {
  const open = db.getOpenSession();
  const openBox = document.getElementById("dayOpenBox");
  const closedHint = document.getElementById("dayClosedHint");
  const reportEl = document.getElementById("dayReport");

  if (!open) {
    openBox.hidden = false;
    closedHint.hidden = false;
    const last = db.state.sessions.find((s) => s.status === "closed");
    closedHint.textContent = last
      ? `Último fechamento: esperado ${money(last.expectedCash)}, contado ${money(last.countedCash)}, diferença ${money(last.difference)}.`
      : "Nenhum caixa aberto. Abra um turno para começar a vender.";
    reportEl.innerHTML = last
      ? renderReportHtml(db.reportForSession(last.id), last)
      : `<p class="empty">Sem dados de turno ainda.</p>`;
    return;
  }

  openBox.hidden = true;
  closedHint.hidden = true;
  reportEl.innerHTML = renderReportHtml(db.reportForSession(open.id), open);
}

function renderReportHtml(report, session) {
  const productRows = report.byProduct
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${formatQty(p.qty, p.unit)}</td><td>${money(p.total)}</td></tr>`
    )
    .join("");

  const saleRows = report.sales
    .map(
      (s) => `
      <tr>
        <td>${formatDateTime(s.soldAt)}</td>
        <td>${money(s.total)}</td>
        <td>${s.payments.map((p) => p.method).join(", ")}</td>
        <td><button class="btn btn-ghost btn-sm" data-cancel-sale="${s.id}" ${session.status !== "open" ? "disabled" : ""}>cancelar</button></td>
      </tr>`
    )
    .join("");

  return `
    <div class="stats">
      <div class="stat"><label>Vendas</label><strong>${report.salesCount}</strong></div>
      <div class="stat"><label>Total</label><strong>${money(report.total)}</strong></div>
      <div class="stat"><label>Kg de sorvete</label><strong>${formatQty(report.kgSold, "kg")}</strong></div>
      <div class="stat"><label>Fundo de caixa</label><strong>${money(session.openingFloat)}</strong></div>
    </div>
    <div class="card" style="margin-bottom:1rem">
      <h3>Por pagamento</h3>
      <div class="stats">
        <div class="stat"><label>Dinheiro</label><strong>${money(report.byMethod.dinheiro || 0)}</strong></div>
        <div class="stat"><label>Pix</label><strong>${money(report.byMethod.pix || 0)}</strong></div>
        <div class="stat"><label>Cartão</label><strong>${money(report.byMethod.cartao || 0)}</strong></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Por produto</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead>
            <tbody>${productRows || `<tr><td colspan="3" class="empty">Sem vendas</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Vendas do turno</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Total</th><th>Pagamento</th><th></th></tr></thead>
            <tbody>${saleRows || `<tr><td colspan="4" class="empty">Sem vendas</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openCashSession() {
  openDialog(
    "Abrir caixa",
    `
      <div class="field">
        <label>Fundo de troco (R$)</label>
        <input id="openFloat" type="number" min="0" step="0.01" value="100" />
      </div>
      <div class="field">
        <label>Observação</label>
        <input id="openNote" placeholder="opcional" />
      </div>
    `,
    (body) => {
      db.openSession(body.querySelector("#openFloat").value, body.querySelector("#openNote").value);
      toast("Caixa aberto");
      refreshSessionPill();
      renderPos();
      renderDay();
      switchPanel("panel-pos");
    },
    "Abrir"
  );
}

function closeCashSession() {
  const open = db.getOpenSession();
  if (!open) {
    toast("Nenhum caixa aberto.", true);
    return;
  }
  const report = db.reportForSession(open.id);
  const expected = roundMoney(open.openingFloat + (report.byMethod.dinheiro || 0));
  openDialog(
    "Fechar o dia / caixa",
    `
      <p class="muted">Esperado em dinheiro: <strong>${money(expected)}</strong> (fundo + vendas em dinheiro).</p>
      <div class="field">
        <label>Valor contado em dinheiro</label>
        <input id="closeCounted" type="number" min="0" step="0.01" value="${expected.toFixed(2)}" />
      </div>
      <div class="field">
        <label>Observação</label>
        <input id="closeNote" placeholder="opcional" />
      </div>
    `,
    (body) => {
      const session = db.closeSession(
        body.querySelector("#closeCounted").value,
        body.querySelector("#closeNote").value
      );
      toast(`Caixa fechado · diferença ${money(session.difference)}`);
      refreshSessionPill();
      renderPos();
      renderDay();
      switchPanel("panel-day");
    },
    "Fechar caixa"
  );
}

/* ---------- helpers / events ---------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("'", "&#39;");
}

function bindEvents() {
  ui.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  document.getElementById("btnOpenCash").addEventListener("click", openCashSession);
  document.getElementById("btnOpenCashFromPos").addEventListener("click", openCashSession);
  document.getElementById("btnCloseCash").addEventListener("click", closeCashSession);
  document.getElementById("productSearch").addEventListener("input", renderPos);
  document.getElementById("btnCheckout").addEventListener("click", checkout);
  document.getElementById("btnClearCart").addEventListener("click", () => {
    db.clearCart();
    renderCart();
  });
  document.getElementById("btnNewProduct").addEventListener("click", () => openProductForm());
  document.getElementById("btnNewPurchase").addEventListener("click", openNewPurchase);
  document.getElementById("btnResetDemo").addEventListener("click", () => {
    if (confirm("Zerar dados e recarregar demonstração?")) {
      db.reset();
      location.reload();
    }
  });

  document.getElementById("productGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (btn) addProductToCart(btn.dataset.add);
  });

  document.getElementById("cartList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-cart]");
    if (!btn) return;
    const cart = db.state.cart.slice();
    cart.splice(Number(btn.dataset.removeCart), 1);
    db.setCart(cart);
    renderCart();
  });

  document.getElementById("productsBody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-product]");
    if (!btn) return;
    const product = db.state.products.find((p) => p.id === btn.dataset.editProduct);
    if (product) openProductForm(product);
  });

  document.getElementById("purchasesBody").addEventListener("click", (e) => {
    const send = e.target.closest("[data-po-send]");
    const receive = e.target.closest("[data-po-receive]");
    if (send) {
      try {
        db.markPurchaseSent(send.dataset.poSend);
        toast("Pedido marcado como enviado");
        renderPurchases();
      } catch (err) {
        toast(err.message, true);
      }
    }
    if (receive) receivePurchase(receive.dataset.poReceive);
  });

  document.getElementById("dayReport").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cancel-sale]");
    if (!btn) return;
    if (!confirm("Cancelar esta venda e devolver estoque?")) return;
    try {
      db.cancelSale(btn.dataset.cancelSale);
      toast("Venda cancelada");
      renderDay();
      renderPos();
      renderProducts();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function init() {
  bindEvents();
  refreshSessionPill();
  switchPanel("panel-pos");
}

init();
