const { db, roundMoney, roundQty, formatMoney, formatQty, formatDateTime } = window.elERP;
const { t, payMethodLabel, poStatusLabel } = window.elERPLocale;

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

function applyStaticLabels() {
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  setText(".brand p", t.brandSubtitle);
  setText("#btnOpenCash", t.openCash);
  setText("#btnCloseCash", t.closeCash);
  setText("#btnOpenCashFromPos", t.openCashNow);
  setText("#posGate h2", t.cashClosedTitle);
  setText("#posGate .muted", t.cashClosedHelp);

  const navMap = {
    "panel-pos": t.nav.pos,
    "panel-products": t.nav.products,
    "panel-purchases": t.nav.purchases,
    "panel-day": t.nav.day,
  };
  ui.navButtons.forEach((btn) => {
    btn.textContent = navMap[btn.dataset.panel] || btn.textContent;
  });

  setText("#labelFlavors", t.flavorsAndItems);
  const search = document.getElementById("productSearch");
  if (search) search.placeholder = t.searchPlaceholder;
  setText("#labelCart", t.cart);
  setText("#btnClearCart", t.clear);
  setText(".cart-total span", t.total);
  setText('label[for="payMethod"]', t.payment);
  setText('label[for="payAmount"]', t.amountPaid);
  setText("#btnCheckout", t.finishSale);

  const paySelect = document.getElementById("payMethod");
  if (paySelect) {
    [...paySelect.options].forEach((opt) => {
      opt.textContent = payMethodLabel(opt.value);
    });
  }

  setText("#labelProducts", t.productsTitle);
  setText("#btnNewProduct", t.newProduct);
  const productHeaders = document.querySelectorAll("#panel-products thead th");
  const productHeaderLabels = [
    t.colName,
    t.colUnit,
    t.colPrice,
    t.colCost,
    t.colStock,
    t.colStatus,
    "",
  ];
  productHeaders.forEach((th, i) => {
    th.textContent = productHeaderLabels[i] ?? "";
  });

  setText("#labelPurchases", t.purchasesTitle);
  setText("#btnNewPurchase", t.newPurchase);
  setText("#purchasesHelp", t.purchasesHelp);
  const purchaseHeaders = document.querySelectorAll("#panel-purchases thead th");
  const purchaseHeaderLabels = [
    t.colCreated,
    t.colSupplier,
    t.colStatus,
    t.colItems,
    t.colCostTotal,
    "",
  ];
  purchaseHeaders.forEach((th, i) => {
    th.textContent = purchaseHeaderLabels[i] ?? "";
  });

  setText("#dayOpenBox h2", t.dayTitle);
  setText("#btnResetDemo", t.resetDemo);
  setText("#dialogCancel", t.dialogCancel);
  setText("#dialogConfirm", t.dialogConfirm);
  setText("#btnLogout", t.logout);
  setText("#loginTitle", t.loginTitle);
  setText("#loginSubtitle", t.loginSubtitle);
  setText("#labelEmail", t.email);
  setText("#labelPassword", t.password);
  setText("#btnLogin", t.login);
  setText("#btnSignup", t.signup);
  setText("#loginHint", t.orCreateAccount);

  const footerText = document.getElementById("footerStorageText");
  if (footerText) footerText.textContent = `${t.footerStorage} · `;
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
    ? `<span class="dot"></span> ${t.sessionOpen(money(open.openingFloat))}`
    : `<span class="dot"></span> ${t.sessionClosed}`;
}

function openDialog(title, bodyHtml, onConfirm, confirmLabel = t.dialogConfirm) {
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
          <span class="stock ${low ? "low" : ""}">${formatQty(p.stock, p.unit)}${low ? ` · ${t.stockLowShort}` : ""}</span>
        </button>`;
    })
    .join("");

  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  const cart = db.state.cart;
  if (!cart.length) {
    list.innerHTML = `<li class="empty">${t.cartEmpty}</li>`;
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
              <div><button type="button" class="btn btn-ghost btn-sm" data-remove-cart="${idx}">${t.remove}</button></div>
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
      toast(t.stockInsufficient, true);
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
    t.weightTitle(product.name),
    `
      <p class="muted">${t.priceStock(money(product.price), formatQty(product.stock, "kg"))}</p>
      <div class="field">
        <label for="dlgWeight">${t.weightKg}</label>
        <input id="dlgWeight" type="number" min="0.001" step="0.001" placeholder="${t.weightPlaceholder}" autofocus />
      </div>
    `,
    (body) => {
      const qty = roundQty(body.querySelector("#dlgWeight").value, "kg");
      if (!(qty > 0)) throw new Error(t.errors.invalidWeight);
      if (qty > product.stock) throw new Error(t.stockInsufficient);
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
    t.add
  );

  requestAnimationFrame(() => {
    document.getElementById("dlgWeight")?.focus();
  });
}

function checkout() {
  try {
    if (!db.getOpenSession()) throw new Error(t.errors.openBeforeSell);
    if (!db.state.cart.length) throw new Error(t.errors.emptyCart);
    const method = document.getElementById("payMethod").value;
    const amount = roundMoney(document.getElementById("payAmount").value);
    const total = roundMoney(db.state.cart.reduce((s, i) => s + i.qty * i.unitPrice, 0));
    if (Math.abs(amount - total) > 0.009) {
      throw new Error(t.errors.payMustMatchTotal);
    }
    const sale = db.confirmSale({ payments: [{ method, amount }] });
    toast(t.saleRegistered(money(sale.total)));
    renderPos();
    refreshSessionPill();
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

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
          <td>${formatQty(p.stock, p.unit)} ${low ? `<span class="badge warn">${t.lowStock}</span>` : ""}</td>
          <td>${p.active ? `<span class="badge ok">${t.active}</span>` : `<span class="badge">${t.inactive}</span>`}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}">${t.edit}</button></td>
        </tr>`;
    })
    .join("");
}

function openProductForm(product = null) {
  openDialog(
    product ? t.editProduct : t.newProduct,
    `
      <div class="field">
        <label>${t.colName}</label>
        <input id="pName" value="${escapeAttr(product?.name || "")}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>${t.unit}</label>
          <select id="pUnit">
            <option value="kg" ${!product || product.unit === "kg" ? "selected" : ""}>kg</option>
            <option value="un" ${product?.unit === "un" ? "selected" : ""}>un</option>
          </select>
        </div>
        <div class="field">
          <label>${t.colPrice}</label>
          <input id="pPrice" type="number" min="0" step="0.01" value="${product?.price ?? ""}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>${t.colCost}</label>
          <input id="pCost" type="number" min="0" step="0.01" value="${product?.cost ?? 0}" />
        </div>
        <div class="field">
          <label>${t.colStock}</label>
          <input id="pStock" type="number" min="0" step="0.001" value="${product?.stock ?? 0}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>${t.minStock}</label>
          <input id="pMin" type="number" min="0" step="0.001" value="${product?.minStock ?? 0}" />
        </div>
        <div class="field">
          <label>${t.status}</label>
          <select id="pActive">
            <option value="1" ${product?.active !== false ? "selected" : ""}>${t.active}</option>
            <option value="0" ${product?.active === false ? "selected" : ""}>${t.inactive}</option>
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
      toast(t.productSaved);
      renderProducts();
      renderPos();
    },
    t.save
  );
}

function renderPurchases() {
  const tbody = document.getElementById("purchasesBody");
  const orders = db.state.purchaseOrders;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${t.noOrders}</td></tr>`;
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
          <td><span class="badge ${statusBadge}">${poStatusLabel(o.status)}</span></td>
          <td>${t.itemsCount(o.items.length)}</td>
          <td>${money(total)}</td>
          <td>
            ${o.status === "draft" ? `<button class="btn btn-secondary btn-sm" data-po-send="${o.id}">${t.send}</button>` : ""}
            ${o.status === "sent" || o.status === "partial" ? `<button class="btn btn-sm" data-po-receive="${o.id}">${t.receive}</button>` : ""}
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
    t.newPurchase,
    `
      <div class="field">
        <label>${t.supplier}</label>
        <select id="poSupplier">${supplierOptions}</select>
      </div>
      <div class="field">
        <label>${t.product}</label>
        <select id="poProduct">${options}</select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>${t.qty}</label>
          <input id="poQty" type="number" min="0.001" step="0.001" value="5" />
        </div>
        <div class="field">
          <label>${t.unitCost}</label>
          <input id="poCost" type="number" min="0" step="0.01" />
        </div>
      </div>
      <div class="field">
        <label>${t.note}</label>
        <input id="poNote" placeholder="${t.optional}" />
      </div>
      <p class="muted">${t.purchaseHint}</p>
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
      toast(t.orderCreated);
      renderPurchases();
    },
    t.newPurchase
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
          <label>${escapeHtml(i.name)} (${t.remaining(formatQty(remaining, i.unit))})</label>
          <input data-rec="${i.productId}" type="number" min="0" step="0.001" value="${remaining}" />
        </div>`;
    })
    .join("");

  openDialog(
    t.receiveOrder,
    fields,
    (body) => {
      const receipts = [...body.querySelectorAll("[data-rec]")].map((el) => ({
        productId: el.dataset.rec,
        qty: el.value,
      }));
      db.receivePurchaseOrder(orderId, receipts);
      toast(t.receiptDone);
      renderPurchases();
      renderProducts();
      renderPos();
    },
    t.confirmReceive
  );
}

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
      ? t.lastClose(money(last.expectedCash), money(last.countedCash), money(last.difference))
      : t.noSessionYet;
    reportEl.innerHTML = last
      ? renderReportHtml(db.reportForSession(last.id), last)
      : `<p class="empty">${t.noSessionData}</p>`;
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
        <td>${s.payments.map((p) => payMethodLabel(p.method)).join(", ")}</td>
        <td><button class="btn btn-ghost btn-sm" data-cancel-sale="${s.id}" ${session.status !== "open" ? "disabled" : ""}>${t.cancel}</button></td>
      </tr>`
    )
    .join("");

  return `
    <div class="stats">
      <div class="stat"><label>${t.sales}</label><strong>${report.salesCount}</strong></div>
      <div class="stat"><label>${t.total}</label><strong>${money(report.total)}</strong></div>
      <div class="stat"><label>${t.kgSold}</label><strong>${formatQty(report.kgSold, "kg")}</strong></div>
      <div class="stat"><label>${t.cashFloat}</label><strong>${money(session.openingFloat)}</strong></div>
    </div>
    <div class="card" style="margin-bottom:1rem">
      <h3>${t.byPayment}</h3>
      <div class="stats">
        <div class="stat"><label>${payMethodLabel("dinheiro")}</label><strong>${money(report.byMethod.dinheiro || 0)}</strong></div>
        <div class="stat"><label>${payMethodLabel("pix")}</label><strong>${money(report.byMethod.pix || 0)}</strong></div>
        <div class="stat"><label>${payMethodLabel("cartao")}</label><strong>${money(report.byMethod.cartao || 0)}</strong></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>${t.byProduct}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${t.item}</th><th>${t.qtyShort}</th><th>${t.total}</th></tr></thead>
            <tbody>${productRows || `<tr><td colspan="3" class="empty">${t.noSales}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3>${t.sessionSales}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${t.when}</th><th>${t.total}</th><th>${t.payment}</th><th></th></tr></thead>
            <tbody>${saleRows || `<tr><td colspan="4" class="empty">${t.noSales}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function openCashSession() {
  openDialog(
    t.openCashTitle,
    `
      <div class="field">
        <label>${t.openingFloat}</label>
        <input id="openFloat" type="number" min="0" step="0.01" value="100" />
      </div>
      <div class="field">
        <label>${t.note}</label>
        <input id="openNote" placeholder="${t.optional}" />
      </div>
    `,
    (body) => {
      db.openSession(body.querySelector("#openFloat").value, body.querySelector("#openNote").value);
      toast(t.cashOpened);
      refreshSessionPill();
      renderPos();
      renderDay();
      switchPanel("panel-pos");
    },
    t.open
  );
}

function closeCashSession() {
  const open = db.getOpenSession();
  if (!open) {
    toast(t.noOpenCash, true);
    return;
  }
  const report = db.reportForSession(open.id);
  const expected = roundMoney(open.openingFloat + (report.byMethod.dinheiro || 0));
  openDialog(
    t.closeCashTitle,
    `
      <p class="muted">${t.expectedCash(`<strong>${money(expected)}</strong>`)}</p>
      <div class="field">
        <label>${t.countedCash}</label>
        <input id="closeCounted" type="number" min="0" step="0.01" value="${expected.toFixed(2)}" />
      </div>
      <div class="field">
        <label>${t.note}</label>
        <input id="closeNote" placeholder="${t.optional}" />
      </div>
    `,
    (body) => {
      const session = db.closeSession(
        body.querySelector("#closeCounted").value,
        body.querySelector("#closeNote").value
      );
      toast(t.cashClosedToast(money(session.difference)));
      refreshSessionPill();
      renderPos();
      renderDay();
      switchPanel("panel-day");
    },
    t.closeConfirm
  );
}

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
  document.getElementById("btnResetDemo").addEventListener("click", async () => {
    if (confirm(t.resetConfirm)) {
      await db.reset();
      refreshSessionPill();
      switchPanel("panel-pos");
      toast(t.syncSaved);
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
        toast(t.orderMarkedSent);
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
    if (!confirm(t.cancelSaleConfirm)) return;
    try {
      db.cancelSale(btn.dataset.cancelSale);
      toast(t.saleCancelled);
      renderDay();
      renderPos();
      renderProducts();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function init() {
  document.documentElement.lang = "pt-BR";
  applyStaticLabels();
  bindEvents();
  bindAuth();
  bootAuth();
}

function setAppVisible(loggedIn) {
  document.getElementById("loginScreen").hidden = loggedIn;
  document.getElementById("appShell").hidden = !loggedIn;
}

function setLoginMessage(msg, isError = false) {
  const el = document.getElementById("loginMessage");
  el.textContent = msg || "";
  el.classList.toggle("error", Boolean(isError && msg));
}

async function bootAuth() {
  const sb = window.elERPSb;
  if (!sb) {
    setLoginMessage("Supabase não carregou. Verifique a conexão.", true);
    setAppVisible(false);
    return;
  }

  db.onSync = (status) => {
    if (status === "error") toast(t.syncError, true);
  };

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session?.user) {
    await enterApp(session.user);
  } else {
    setAppVisible(false);
  }

  sb.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === "SIGNED_OUT") {
      db.clearSession();
      setAppVisible(false);
      return;
    }
    if (event === "SIGNED_IN" && nextSession?.user) {
      if (!db.ready || db.userId !== nextSession.user.id) {
        await enterApp(nextSession.user);
      }
    }
  });
}

async function enterApp(user) {
  try {
    setLoginMessage(t.loginLoading);
    await db.bootstrap(user.id);
    document.getElementById("userEmailLabel").textContent = user.email || "";
    setAppVisible(true);
    setLoginMessage("");
    refreshSessionPill();
    switchPanel("panel-pos");
  } catch (error) {
    setAppVisible(false);
    if (error?.message === "SCHEMA_MISSING") {
      setLoginMessage(t.schemaMissing, true);
    } else {
      setLoginMessage(t.loadError + (error?.message ? ` (${error.message})` : ""), true);
    }
  }
}

function bindAuth() {
  const form = document.getElementById("loginForm");
  document.getElementById("btnLogin").addEventListener("click", async (e) => {
    e.preventDefault();
    await handleLogin();
  });
  document.getElementById("btnSignup").addEventListener("click", async (e) => {
    e.preventDefault();
    await handleSignup();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleLogin();
  });
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await window.elERPSb.auth.signOut();
    db.clearSession();
    setAppVisible(false);
  });
}

async function handleLogin() {
  const sb = window.elERPSb;
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    setLoginMessage("Informe e-mail e senha.", true);
    return;
  }
  setLoginMessage(t.loginLoading);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    setLoginMessage(error.message, true);
    return;
  }
  await enterApp(data.user);
}

async function handleSignup() {
  const sb = window.elERPSb;
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    setLoginMessage("Informe e-mail e senha.", true);
    return;
  }
  if (password.length < 6) {
    setLoginMessage("A senha precisa ter pelo menos 6 caracteres.", true);
    return;
  }
  setLoginMessage(t.signupLoading);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) {
    setLoginMessage(error.message, true);
    return;
  }
  if (data.session?.user) {
    await enterApp(data.session.user);
    return;
  }
  setLoginMessage(t.signupOk);
}

init();
