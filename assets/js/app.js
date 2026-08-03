(function () {
const { db, roundMoney, roundQty, lineTotal, cartLineTotal, formatMoney, formatQty, formatDateTime } = window.elERP;
const { t, payMethodLabel, poStatusLabel, roleLabel } = window.elERPLocale;
const scale = window.elERPScale;
const catalog = window.elERPCatalog;
const offline = window.elERPOffline;
const receipt = window.elERPReceipt;

const PANEL_AREA = {
  "panel-pos": "ops",
  "panel-day": "ops",
  "panel-products": "mgmt",
  "panel-inventory": "mgmt",
  "panel-purchases": "mgmt",
  "panel-suppliers": "mgmt",
  "panel-catalog": "mgmt",
  "panel-scale": "mgmt",
  "panel-store": "mgmt",
  "panel-team": "mgmt",
};

const AREA_DEFAULT_PANEL = {
  ops: "panel-pos",
  mgmt: "panel-products",
};

const PAY_METHODS = ["dinheiro", "pix", "cartao"];

let payLines = [{ method: "dinheiro", amount: "" }];

const ui = {
  toastEl: document.getElementById("toast"),
  sessionPill: document.getElementById("sessionPill"),
  panels: [...document.querySelectorAll(".panel")],
  navButtons: [...document.querySelectorAll(".nav-group button[data-panel]")],
  areaButtons: [...document.querySelectorAll(".area-switch button[data-area]")],
  currentArea: "ops",
};

function toast(message, isError = false) {
  if (!ui.toastEl) return;
  ui.toastEl.textContent = message;
  ui.toastEl.classList.toggle("error", isError);
  ui.toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ui.toastEl.classList.remove("show"), 2800);
}

function money(n) {
  return formatMoney(n);
}

function setHidden(el, hide) {
  if (!el) return;
  el.hidden = hide;
  el.classList.toggle("is-hidden", hide);
}

function setAppVisible(loggedIn) {
  setHidden(document.getElementById("loginScreen"), loggedIn);
  setHidden(document.getElementById("appShell"), !loggedIn);
  document.body.classList.toggle("is-logged-in", loggedIn);
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

function applyRoleVisibility() {
  const role = db.state?.role || "owner";
  const isCashier = role === "cashier";
  const isOwner = role === "owner";
  document.body.classList.toggle("role-cashier", isCashier);
  document.body.classList.toggle("role-owner", isOwner);
  document.body.classList.toggle("role-manager", role === "manager");
  document.querySelectorAll(".mgmt-only").forEach((el) => setHidden(el, isCashier));
  document.querySelectorAll(".owner-only").forEach((el) => setHidden(el, !isOwner));
  if (isCashier && ui.currentArea === "mgmt") {
    setArea("ops");
  }
}

function applyStaticLabels() {
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  setText("#appShell .brand p", t.brandSubtitle);
  setText("#btnOpenCash", t.openCash);
  setText("#btnCloseCash", t.closeCash);
  setText("#btnOpenCashFromPos", t.openCashNow);
  setText("#posGate h2", t.cashClosedTitle);
  setText("#posGate .muted", t.cashClosedHelp);

  const navMap = {
    "panel-pos": t.nav.pos,
    "panel-products": t.nav.products,
    "panel-inventory": t.nav.inventory,
    "panel-purchases": t.nav.purchases,
    "panel-suppliers": t.nav.suppliers,
    "panel-day": t.nav.day,
    "panel-scale": t.nav.scale,
    "panel-catalog": t.nav.catalog,
    "panel-store": t.nav.store,
    "panel-team": t.nav.team,
  };
  ui.navButtons.forEach((btn) => {
    btn.textContent = navMap[btn.dataset.panel] || btn.textContent;
  });
  ui.areaButtons.forEach((btn) => {
    btn.textContent = btn.dataset.area === "mgmt" ? t.nav.mgmt : t.nav.ops;
  });

  setText("#labelFlavors", t.flavorsAndItems);
  const search = document.getElementById("productSearch");
  if (search) search.placeholder = t.searchPlaceholder;
  setText("#labelCart", t.cart);
  setText("#btnClearCart", t.clear);
  setText(".cart-total span", t.total);
  setText("#btnAddPay", t.addPayment);
  setText("#btnCheckout", t.finishSale);

  setText("#labelProducts", t.productsTitle);
  setText("#btnNewProduct", t.newProduct);
  const productHeaders = document.querySelectorAll("#panel-products thead th");
  const productHeaderLabels = [t.colName, t.colUnit, t.colPrice, t.colCost, t.colStock, t.colStatus, ""];
  productHeaders.forEach((th, i) => {
    th.textContent = productHeaderLabels[i] ?? "";
  });

  setText("#labelInventory", t.inventoryTitle);
  setText("#inventoryHelp", t.inventoryHelp);
  const invHeaders = document.querySelectorAll("#panel-inventory thead th");
  [t.colName, t.colUnit, t.colStock, t.minStock, ""].forEach((label, i) => {
    if (invHeaders[i]) invHeaders[i].textContent = label;
  });

  setText("#labelPurchases", t.purchasesTitle);
  setText("#btnNewPurchase", t.newPurchase);
  setText("#purchasesHelp", t.purchasesHelp);
  const purchaseHeaders = document.querySelectorAll("#panel-purchases thead th");
  [t.colCreated, t.colSupplier, t.colStatus, t.colItems, t.colCostTotal, ""].forEach((label, i) => {
    if (purchaseHeaders[i]) purchaseHeaders[i].textContent = label;
  });

  setText("#labelSuppliers", t.suppliersTitle);
  setText("#btnNewSupplier", t.newSupplier);
  const supHeaders = document.querySelectorAll("#panel-suppliers thead th");
  [t.colName, t.phone, ""].forEach((label, i) => {
    if (supHeaders[i]) supHeaders[i].textContent = label;
  });

  setText("#dayOpenBox h2", t.dayTitle);
  setText("#labelReports", t.reportsTitle);
  setText("#btnExportCsv", t.exportCsv);
  const periodSel = document.getElementById("reportPeriod");
  if (periodSel) {
    [...periodSel.options].forEach((opt) => {
      const labels = { today: t.periodToday, 7: t.period7, month: t.periodMonth, session: "Turno atual / último" };
      opt.textContent = labels[opt.value] || opt.textContent;
    });
  }

  setText("#labelStore", t.storeTitle);
  setText("#storeHelp", t.storeHelp);
  setText("#btnSaveStore", t.save);
  setText('label[for="stTrade"]', t.tradeName);
  setText('label[for="stLegal"]', t.legalName);
  setText('label[for="stCnpj"]', t.cnpj);
  setText('label[for="stIe"]', t.ie);
  setText('label[for="stPhone"]', t.phone);
  setText('label[for="stAddress"]', t.address);
  setText('label[for="stCity"]', t.city);
  setText('label[for="stState"]', t.state);
  setText('label[for="stZip"]', t.zip);
  setText('label[for="stMsg"]', t.receiptMessage);
  setText('label[for="stFiscal"]', t.fiscalMode);
  setText('label[for="stCscId"]', t.cscId);
  setText('label[for="stCscToken"]', t.cscToken);
  const fiscalSel = document.getElementById("stFiscal");
  if (fiscalSel) {
    [...fiscalSel.options].forEach((opt) => {
      opt.textContent = opt.value === "nfce_futuro" ? t.fiscalNfceFuture : t.fiscalNaoFiscal;
    });
  }

  setText("#labelTeam", t.teamTitle);
  setText("#teamHelp", t.teamHelp);
  setText("#btnNewMember", t.addMember);
  const teamHeaders = document.querySelectorAll("#panel-team thead th");
  [t.email, t.role, ""].forEach((label, i) => {
    if (teamHeaders[i]) teamHeaders[i].textContent = label;
  });

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
  setText("#labelScale", t.scaleTitle);
  setText("#scaleHelp", t.scaleHelp);
  setText("#labelScaleProtocol", t.scaleProtocol);
  setText("#labelScaleBaud", t.scaleBaud);
  setText("#labelScaleStatus", "Situação");
  setText("#btnScaleConnect", t.scaleConnect);
  setText("#btnScaleDisconnect", t.scaleDisconnect);
  setText("#btnScaleSave", t.scaleSave);
  setText("#labelScaleLast", t.scaleLast);
  setText("#labelCatalog", t.catalogTitle);
  setText("#catalogHelp", t.catalogHelp);
  const catalogSearch = document.getElementById("catalogSearch");
  if (catalogSearch) catalogSearch.placeholder = t.catalogSearch;
  const posBarcode = document.getElementById("posBarcode");
  if (posBarcode) posBarcode.placeholder = t.posBarcodeHint;
  const footerText = document.getElementById("footerStorageText");
  if (footerText) footerText.textContent = t.footerStorage;

  fillScaleSelects();
  renderScaleStatus();
  fillCatalogGroups();
}

function setArea(area, { keepPanel = false } = {}) {
  const next = area === "mgmt" ? "mgmt" : "ops";
  if (next === "mgmt" && db.state?.role === "cashier") {
    toast(t.errors.forbidden, true);
    return;
  }
  ui.currentArea = next;
  document.body.dataset.area = next;
  ui.areaButtons.forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.area === next ? "page" : "false");
  });
  setHidden(document.getElementById("navOps"), next !== "ops");
  setHidden(document.getElementById("navMgmt"), next !== "mgmt");
  const activeId = document.querySelector(".panel.active")?.id;
  if (keepPanel && activeId && PANEL_AREA[activeId] === next) {
    switchPanel(activeId);
    return;
  }
  switchPanel(AREA_DEFAULT_PANEL[next]);
}

function switchPanel(id) {
  const area = PANEL_AREA[id] || "ops";
  if (ui.currentArea !== area) {
    ui.currentArea = area;
    document.body.dataset.area = area;
    ui.areaButtons.forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.area === area ? "page" : "false");
    });
    setHidden(document.getElementById("navOps"), area !== "ops");
    setHidden(document.getElementById("navMgmt"), area !== "mgmt");
  }
  ui.panels.forEach((p) => p.classList.toggle("active", p.id === id));
  ui.navButtons.forEach((b) => {
    b.setAttribute("aria-current", b.dataset.panel === id ? "page" : "false");
  });
  if (id === "panel-pos") renderPos();
  if (id === "panel-products") renderProducts();
  if (id === "panel-inventory") renderInventory();
  if (id === "panel-purchases") renderPurchases();
  if (id === "panel-suppliers") renderSuppliers();
  if (id === "panel-day") renderDay();
  if (id === "panel-scale") renderScaleStatus();
  if (id === "panel-catalog") renderCatalog();
  if (id === "panel-store") renderStoreForm();
  if (id === "panel-team") renderTeam();
}

function refreshSessionPill() {
  const open = db.getOpenSession();
  ui.sessionPill.dataset.open = open ? "true" : "false";
  ui.sessionPill.innerHTML = open
    ? `<span class="dot"></span> ${t.sessionOpen(money(open.openingFloat))}`
    : `<span class="dot"></span> ${t.sessionClosed}`;
}

function openDialog(title, bodyHtml, onConfirm, confirmLabel = t.dialogConfirm, options = {}) {
  return new Promise((resolve, reject) => {
    const backdrop = document.getElementById("dialogBackdrop");
    const panel = document.getElementById("dialogPanel");
    const titleEl = document.getElementById("dialogTitle");
    const bodyEl = document.getElementById("dialogBody");
    const confirmBtn = document.getElementById("dialogConfirm");
    const cancelBtn = document.getElementById("dialogCancel");

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmLabel;
    panel?.classList.toggle("dialog-wide", Boolean(options.wide));
    backdrop.classList.add("open");

    const close = (result) => {
      backdrop.classList.remove("open");
      panel?.classList.remove("dialog-wide");
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      backdrop.onkeydown = null;
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const submit = async () => {
      try {
        const result = await onConfirm(bodyEl);
        close(result);
      } catch (err) {
        toast(err.message || String(err), true);
      }
    };

    cancelBtn.onclick = () => close(null);
    confirmBtn.onclick = submit;
    backdrop.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(null);
      }
      if (e.key === "Enter" && e.target?.tagName !== "TEXTAREA" && e.target?.tagName !== "BUTTON") {
        const tag = e.target?.tagName;
        if (tag === "INPUT" || tag === "SELECT") {
          e.preventDefault();
          submit();
        }
      }
    };

    requestAnimationFrame(() => {
      bodyEl.querySelector("input, select, textarea")?.focus?.();
    });
  });
}

function cartTotalAmount() {
  return roundMoney(db.state.cart.reduce((s, i) => s + cartLineTotal(i), 0));
}

function syncPayLinesFromInputs() {
  document.querySelectorAll("#payLines .pay-method").forEach((sel) => {
    const idx = Number(sel.dataset.idx);
    if (payLines[idx]) payLines[idx].method = sel.value;
  });
  document.querySelectorAll("#payLines .pay-amount").forEach((inp) => {
    const idx = Number(inp.dataset.idx);
    if (payLines[idx]) payLines[idx].amount = inp.value;
  });
}

function syncChangeHint() {
  const hint = document.getElementById("payChangeHint");
  if (!hint) return;
  const total = cartTotalAmount();
  const paid = roundMoney(payLines.reduce((s, p) => s + roundMoney(p.amount || 0), 0));
  const change = roundMoney(Math.max(0, paid - total));
  if (total <= 0) {
    hint.textContent = "";
    return;
  }
  if (paid + 0.009 < total) {
    hint.textContent = `Falta ${money(roundMoney(total - paid))}`;
  } else if (change > 0) {
    hint.textContent = `${t.change}: ${money(change)}`;
  } else {
    hint.textContent = "";
  }
}

function renderPayLines() {
  const container = document.getElementById("payLines");
  if (!container) return;
  const total = cartTotalAmount();
  if (payLines.length && (payLines[0].amount === "" || payLines[0].amount == null)) {
    const otherPaid = payLines.slice(1).reduce((s, p) => s + roundMoney(p.amount || 0), 0);
    const remaining = roundMoney(Math.max(0, total - otherPaid));
    if (total > 0) payLines[0].amount = remaining.toFixed(2);
  }
  container.innerHTML = payLines
    .map((pl, idx) => {
      const methodOpts = PAY_METHODS.map(
        (m) => `<option value="${m}" ${pl.method === m ? "selected" : ""}>${payMethodLabel(m)}</option>`
      ).join("");
      return `
        <div class="field-row pay-line" data-pay-idx="${idx}">
          <div class="field">
            <label>${t.payment}</label>
            <select class="control pay-method" data-idx="${idx}">${methodOpts}</select>
          </div>
          <div class="field">
            <label>${t.amountPaid}</label>
            <input class="control pay-amount" data-idx="${idx}" type="number" min="0" step="0.01" value="${escapeAttr(String(pl.amount ?? ""))}" />
          </div>
          ${idx > 0 ? `<button type="button" class="btn btn-ghost btn-sm pay-remove" data-remove-pay="${idx}">×</button>` : ""}
        </div>`;
    })
    .join("");
  syncChangeHint();
}

function btnAddPay() {
  syncPayLinesFromInputs();
  const total = cartTotalAmount();
  const paid = roundMoney(payLines.reduce((s, p) => s + roundMoney(p.amount || 0), 0));
  const remaining = roundMoney(Math.max(0, total - paid));
  payLines.push({ method: "pix", amount: remaining > 0 ? remaining.toFixed(2) : "" });
  renderPayLines();
}

function priceLabel(unit, price) {
  if (unit === "un") return `${money(price)} / un`;
  return `${money(price)} / kg`;
}

function addonKey(addons) {
  return (addons || [])
    .map((a) => a.id)
    .sort()
    .join(",");
}

function buildAddonsHtml(addons, selected = []) {
  if (!addons.length) return "";
  const selIds = new Set(selected.map((a) => a.id));
  const boxes = addons
    .map(
      (a) => `
      <label class="checkbox-row">
        <input type="checkbox" class="addon-cb" value="${escapeAttr(a.id)}" data-name="${escapeAttr(a.name)}" data-price="${a.price}" ${selIds.has(a.id) ? "checked" : ""} />
        ${escapeHtml(a.name)} · ${money(a.price)}
      </label>`
    )
    .join("");
  return `
    <div class="field">
      <label>${t.selectAddons}</label>
      <div class="form-stack">${boxes}</div>
    </div>`;
}

function readSelectedAddons(body) {
  return [...body.querySelectorAll(".addon-cb:checked")].map((cb) => ({
    id: cb.value,
    name: cb.dataset.name,
    price: roundMoney(cb.dataset.price),
  }));
}

function pushCartItem(product, unit, qty, addons) {
  const cart = db.state.cart.slice();
  cart.push({
    productId: product.id,
    name: product.name,
    unit,
    qty,
    unitPrice: product.price,
    addons: addons || [],
  });
  db.setCart(cart);
  renderCart();
}

function addUnToCart(product, addons = []) {
  const cart = db.state.cart.slice();
  const key = addonKey(addons);
  const existing = cart.find(
    (c) => c.productId === product.id && c.unit === "un" && addonKey(c.addons) === key
  );
  const nextQty = roundQty((existing?.qty || 0) + 1, "un");
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
      addons,
    });
  }
  db.setCart(cart);
  renderCart();
}

function syncProductFormLabels(root = document) {
  const unit = root.querySelector("#pUnit")?.value || "g";
  const priceLab = root.querySelector("#pPriceLabel");
  const costLab = root.querySelector("#pCostLabel");
  const stockLab = root.querySelector("#pStockLabel");
  const minLab = root.querySelector("#pMinLabel");
  const stock = root.querySelector("#pStock");
  const min = root.querySelector("#pMin");
  const suffix = unit === "un" ? t.pricePerUn : t.pricePerKg;
  if (priceLab) priceLab.textContent = `${t.colPrice}${suffix}`;
  if (costLab) costLab.textContent = `${t.colCost}${suffix}`;
  if (stockLab) stockLab.textContent = t.stockIn(unit);
  if (minLab) minLab.textContent = t.minStockIn(unit);
  const step = unit === "g" ? "1" : unit === "kg" ? "0.001" : "1";
  if (stock) stock.step = step;
  if (min) min.step = step;
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
          <span>${priceLabel(p.unit, p.price)}</span>
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
        const line = cartLineTotal(item);
        const priceLabelText =
          item.unit === "g"
            ? `${formatQty(item.qty, "g")} · ${money(item.unitPrice)}/kg`
            : item.unit === "kg"
              ? `${formatQty(item.qty, "kg")} · ${money(item.unitPrice)}/kg`
              : `${formatQty(item.qty, item.unit)} × ${money(item.unitPrice)}`;
        const addonHtml = (item.addons || [])
          .map((a) => `<div class="meta">+ ${escapeHtml(a.name)} ${money(a.price)}</div>`)
          .join("");
        return `
          <li class="cart-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="meta">${priceLabelText}</div>
              ${addonHtml}
            </div>
            <div class="cart-item-actions">
              <strong>${money(line)}</strong>
              <div><button type="button" class="btn btn-ghost btn-sm" data-remove-cart="${idx}">${t.remove}</button></div>
            </div>
          </li>`;
      })
      .join("");
  }
  document.getElementById("cartTotal").textContent = money(cartTotalAmount());
  renderPayLines();
}

function fillScaleSelects() {
  if (!scale) return;
  const protoSel = document.getElementById("scaleProtocol");
  const baudSel = document.getElementById("scaleBaud");
  if (!protoSel || !baudSel) return;
  const cfg = scale.getConfig();
  protoSel.innerHTML = scale
    .protocols()
    .map((p) => `<option value="${p.id}" ${p.id === cfg.protocolId ? "selected" : ""}>${p.label}</option>`)
    .join("");
  baudSel.innerHTML = scale
    .baudRates()
    .map((b) => `<option value="${b}" ${Number(cfg.baudRate) === b ? "selected" : ""}>${b}</option>`)
    .join("");
}

function renderScaleStatus() {
  if (!scale) return;
  const st = scale.status();
  const support = document.getElementById("scaleSupportNote");
  const statusText = document.getElementById("scaleStatusText");
  const lastText = document.getElementById("scaleLastText");
  const rawText = document.getElementById("scaleRawText");
  if (support) support.textContent = st.supported ? "" : t.scaleUnsupported;
  if (statusText) statusText.textContent = st.connected ? t.scaleConnected : t.scaleDisconnected;
  if (lastText) {
    if (!st.last) lastText.textContent = t.scaleNone;
    else {
      const grams = st.last.grams ?? Math.round((st.last.kg || 0) * 1000);
      lastText.textContent = `${formatQty(grams, "g")} · ${st.last.stable ? t.scaleStable : t.scaleUnstable}`;
    }
  }
  if (rawText) rawText.textContent = st.last?.raw ? String(st.last.raw) : "";
  const connectBtn = document.getElementById("btnScaleConnect");
  const disconnectBtn = document.getElementById("btnScaleDisconnect");
  if (connectBtn) connectBtn.disabled = !st.supported || st.connected;
  if (disconnectBtn) disconnectBtn.disabled = !st.connected;
}

function addProductToCart(productId) {
  const product = db.state.products.find((p) => p.id === productId);
  if (!product) return;
  const addons = db.listAddonsForProduct(productId);

  if (product.unit === "un") {
    if (!addons.length) {
      addUnToCart(product);
      return;
    }
    openDialog(
      t.add,
      `<div class="form-stack"><p class="field-hint">${escapeHtml(product.name)} · ${priceLabel(product.unit, product.price)}</p>${buildAddonsHtml(addons)}</div>`,
      (body) => {
        const selected = readSelectedAddons(body);
        addUnToCart(product, selected);
        toast(`${product.name}: 1 un`);
      },
      t.add
    );
    return;
  }

  const sellUnit = product.unit === "kg" ? "kg" : "g";
  const weightLabel = sellUnit === "kg" ? t.weightKg : t.weightG;
  const placeholder = sellUnit === "kg" ? t.weightPlaceholderKg : t.weightPlaceholder;
  const step = sellUnit === "kg" ? "0.001" : "1";
  const min = sellUnit === "kg" ? "0.001" : "1";

  openDialog(
    t.weightTitle(product.name),
    `
      <div class="form-stack">
        <p class="field-hint">${t.priceStock(priceLabel(product.unit, product.price), formatQty(product.stock, product.unit))}</p>
        <div class="field">
          <label for="dlgWeight">${weightLabel}</label>
          <input id="dlgWeight" class="control" type="number" min="${min}" step="${step}" placeholder="${placeholder}" autofocus />
        </div>
        ${buildAddonsHtml(addons)}
        <div class="scale-live">
          <div class="card-head">
            <strong>${t.scaleLive}</strong>
            <span id="dlgScaleBadge" class="badge">${t.scaleDisconnected}</span>
          </div>
          <div id="dlgScaleReading" class="muted">${t.scaleNone}</div>
          <div class="toolbar">
            <button type="button" class="btn btn-secondary btn-sm" id="dlgScaleUse">${t.useScaleWeight}</button>
            <button type="button" class="btn btn-ghost btn-sm" id="dlgScaleConnect">${t.scaleConnect}</button>
          </div>
          <p class="field-hint">${t.scaleHintBarcode}</p>
        </div>
      </div>
    `,
    (body) => {
      const qty = roundQty(body.querySelector("#dlgWeight").value, sellUnit);
      if (!(qty > 0)) throw new Error(t.errors.invalidWeight);
      if (qty > product.stock) throw new Error(t.stockInsufficient);
      const selected = readSelectedAddons(body);
      pushCartItem(product, sellUnit, qty, selected);
      toast(`${product.name}: ${formatQty(qty, sellUnit)}`);
    },
    t.add
  );

  requestAnimationFrame(() => {
    const weightInput = document.getElementById("dlgWeight");
    weightInput?.focus();
    wireWeightDialogScale(weightInput, sellUnit);
  });
}

function readingGrams(reading) {
  if (!reading) return null;
  if (reading.grams != null) return Math.round(reading.grams);
  if (reading.kg != null) return Math.round(Number(reading.kg) * 1000);
  return null;
}

function wireWeightDialogScale(weightInput, sellUnit = "g") {
  if (!scale) return;
  const badge = document.getElementById("dlgScaleBadge");
  const reading = document.getElementById("dlgScaleReading");
  const useBtn = document.getElementById("dlgScaleUse");
  const connectBtn = document.getElementById("dlgScaleConnect");
  const backdrop = document.getElementById("dialogBackdrop");

  const toInputQty = (grams) => {
    if (grams == null) return null;
    return sellUnit === "kg" ? roundQty(grams / 1000, "kg") : roundQty(grams, "g");
  };

  const refresh = () => {
    const st = scale.status();
    if (badge) {
      badge.textContent = st.connected ? t.scaleConnected : t.scaleDisconnected;
      badge.className = `badge ${st.connected ? "ok" : ""}`;
    }
    if (reading) {
      const g = readingGrams(st.last);
      if (!g) reading.textContent = t.scaleNone;
      else {
        const shown = sellUnit === "kg" ? formatQty(g / 1000, "kg") : formatQty(g, "g");
        reading.textContent = `${shown} · ${st.last.stable ? t.scaleStable : t.scaleUnstable}`;
      }
    }
    if (useBtn) useBtn.disabled = !readingGrams(st.last);
  };

  const applyReading = (rec, force = false) => {
    const g = readingGrams(rec);
    const qty = toInputQty(g);
    if (qty == null || !weightInput) return;
    if (force || !weightInput.value || document.activeElement !== weightInput) {
      if (rec.stable || force || !weightInput.value) weightInput.value = String(qty);
    }
  };

  const onScale = (ev) => {
    if (ev.type === "weight" || ev.type === "connected" || ev.type === "disconnected") {
      refresh();
      if (ev.type === "weight" && ev.reading) applyReading(ev.reading);
    }
  };

  const unsub = scale.on(onScale);
  scale.armBarcodeCapture(true);
  refresh();

  useBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    applyReading(scale.status().last, true);
    weightInput?.focus();
  });

  connectBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await scale.connect();
      refresh();
      toast(t.scaleConnected);
    } catch (err) {
      if (err?.message === "UNSUPPORTED") toast(t.scaleUnsupported, true);
      else toast(t.scalePermissionDenied, true);
    }
  });

  const finish = () => {
    scale.armBarcodeCapture(false);
    unsub();
    observer.disconnect();
  };

  const observer = new MutationObserver(() => {
    if (!backdrop.classList.contains("open")) finish();
  });
  observer.observe(backdrop, { attributes: true, attributeFilter: ["class"] });
}

function isNetworkError(err) {
  if (!navigator.onLine) return true;
  const msg = String(err?.message || err || "");
  return /fetch|network|Failed to fetch|Load failed|NetworkError/i.test(msg);
}

async function checkout() {
  try {
    if (!db.getOpenSession()) throw new Error(t.errors.openBeforeSell);
    if (!db.state.cart.length) throw new Error(t.errors.emptyCart);
    syncPayLinesFromInputs();
    const payments = payLines
      .map((p) => ({ method: p.method, amount: roundMoney(p.amount) }))
      .filter((p) => p.amount > 0);
    if (!payments.length) throw new Error(t.errors.paymentInsufficient);

    const sale = await db.confirmSale({ payments });
    toast(t.saleRegistered(money(sale.total)));
    try {
      receipt?.printReceipt({ settings: db.state.settings, sale, change: sale.change });
    } catch (e) {
      if (e?.message === "POPUP_BLOCKED") toast(t.errors.popupBlocked, true);
    }
    payLines = [{ method: "dinheiro", amount: "" }];
    renderPos();
    renderProducts();
    refreshSessionPill();
  } catch (err) {
    if (isNetworkError(err)) {
      syncPayLinesFromInputs();
      const payments = payLines
        .map((p) => ({ method: p.method, amount: roundMoney(p.amount) }))
        .filter((p) => p.amount > 0);
      if (!payments.length) {
        toast(t.errors.paymentInsufficient, true);
        return;
      }
      try {
        await offline.enqueue({
          id: crypto.randomUUID(),
          cart: JSON.parse(JSON.stringify(db.state.cart)),
          payments,
        });
        db.clearCart();
        payLines = [{ method: "dinheiro", amount: "" }];
        toast(t.offlineQueued);
        renderPos();
        updateOfflineBanner();
      } catch (qErr) {
        toast(qErr.message || String(qErr), true);
      }
      return;
    }
    toast(err.message || String(err), true);
  }
}

function renderProducts() {
  const tbody = document.getElementById("productsBody");
  const rows = db.listProducts({ onlyActive: false });
  tbody.innerHTML = rows
    .map((p) => {
      const low = p.active && p.stock <= p.minStock;
      const addonCount = db.listAddonsForProduct(p.id).length;
      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong>${addonCount ? `<div class="muted">${addonCount} ${t.addons.toLowerCase()}</div>` : ""}</td>
          <td>${p.unit}</td>
          <td>${priceLabel(p.unit, p.price)}</td>
          <td>${p.unit === "un" ? money(p.cost) : `${money(p.cost)} / kg`}</td>
          <td>${formatQty(p.stock, p.unit)} ${low ? `<span class="badge warn">${t.lowStock}</span>` : ""}</td>
          <td>${p.active ? `<span class="badge ok">${t.active}</span>` : `<span class="badge">${t.inactive}</span>`}</td>
          <td class="toolbar">
            <button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}">${t.edit}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-manage-addons="${p.id}">${t.manageAddons}</button>
          </td>
        </tr>`;
    })
    .join("");
}

function openAddonsManager(productId) {
  const product = db.state.products.find((p) => p.id === productId);
  if (!product) return;

  const renderList = () => {
    const addons = (db.state.addons || []).filter((a) => a.productId === productId);
    if (!addons.length) return `<p class="muted">${t.catalogEmpty}</p>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>${t.addonName}</th><th>${t.addonPrice}</th><th>${t.colStatus}</th><th></th></tr></thead>
          <tbody>
            ${addons
              .map(
                (a) => `
              <tr>
                <td>${escapeHtml(a.name)}</td>
                <td>${money(a.price)}</td>
                <td>${a.active ? `<span class="badge ok">${t.active}</span>` : `<span class="badge">${t.inactive}</span>`}</td>
                <td>
                  <button type="button" class="btn btn-ghost btn-sm" data-edit-addon="${a.id}">${t.edit}</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-del-addon="${a.id}">${t.remove}</button>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  };

  openDialog(
    `${t.manageAddons} · ${product.name}`,
    `
      <div class="form-stack" id="addonsManagerRoot">
        ${renderList()}
        <button type="button" class="btn btn-secondary btn-sm" id="btnAddAddon">${t.addAddon}</button>
      </div>
    `,
    async () => {},
    t.dialogConfirm,
    { wide: true }
  );

  requestAnimationFrame(() => {
    const root = document.getElementById("addonsManagerRoot");
    if (!root) return;

    const refresh = async () => {
      await db.reload?.();
      const listEl = root.querySelector(".table-wrap") || root.querySelector("p.muted");
      const html = renderList();
      if (listEl) listEl.outerHTML = html;
      else root.insertAdjacentHTML("afterbegin", html);
    };

    root.addEventListener("click", async (e) => {
      const addBtn = e.target.closest("#btnAddAddon");
      const editBtn = e.target.closest("[data-edit-addon]");
      const delBtn = e.target.closest("[data-del-addon]");
      if (addBtn) {
        e.preventDefault();
        openAddonForm(productId, null, refresh);
      }
      if (editBtn) {
        e.preventDefault();
        const addon = (db.state.addons || []).find((a) => a.id === editBtn.dataset.editAddon);
        if (addon) openAddonForm(productId, addon, refresh);
      }
      if (delBtn) {
        e.preventDefault();
        if (!confirm("Remover complemento?")) return;
        try {
          await db.deleteAddon(delBtn.dataset.delAddon);
          toast(t.productSaved);
          await refresh();
          renderProducts();
        } catch (err) {
          toast(err.message, true);
        }
      }
    });
  });
}

function openAddonForm(productId, addon, onSaved) {
  openDialog(
    addon ? t.edit : t.addAddon,
    `
      <div class="form-stack">
        <div class="field">
          <label for="addonName">${t.addonName}</label>
          <input id="addonName" class="control" value="${escapeAttr(addon?.name || "")}" />
        </div>
        <div class="field">
          <label for="addonPrice">${t.addonPrice}</label>
          <input id="addonPrice" class="control" type="number" min="0" step="0.01" value="${addon?.price ?? ""}" />
        </div>
        <div class="field">
          <label for="addonActive">${t.status}</label>
          <select id="addonActive" class="control">
            <option value="1" ${addon?.active !== false ? "selected" : ""}>${t.active}</option>
            <option value="0" ${addon?.active === false ? "selected" : ""}>${t.inactive}</option>
          </select>
        </div>
      </div>
    `,
    async (body) => {
      await db.upsertAddon({
        id: addon?.id,
        productId,
        name: body.querySelector("#addonName").value,
        price: body.querySelector("#addonPrice").value,
        active: body.querySelector("#addonActive").value === "1",
      });
      toast(t.productSaved);
      if (typeof onSaved === "function") await onSaved();
      renderProducts();
    },
    t.save
  );
}

function openProductForm(product = null) {
  const unit = product?.unit === "un" ? "un" : product?.unit === "kg" ? "kg" : "g";
  openDialog(
    product ? t.editProduct : t.newProduct,
    `
      <div class="form-stack">
        <div class="field">
          <label for="pName">${t.colName}</label>
          <input id="pName" class="control" value="${escapeAttr(product?.name || "")}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="pBarcode">${t.catalogBarcode}</label>
            <input id="pBarcode" class="control" inputmode="numeric" value="${escapeAttr(product?.barcode || "")}" />
          </div>
          <div class="field">
            <label for="pSku">SKU</label>
            <input id="pSku" class="control" value="${escapeAttr(product?.sku || product?.barcode || "")}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="pUnit">${t.unit}</label>
            <select id="pUnit" class="control">
              <option value="g" ${unit === "g" ? "selected" : ""}>${t.unitG}</option>
              <option value="kg" ${unit === "kg" ? "selected" : ""}>${t.unitKg}</option>
              <option value="un" ${unit === "un" ? "selected" : ""}>${t.unitUn}</option>
            </select>
          </div>
          <div class="field">
            <label id="pPriceLabel" for="pPrice">${t.colPrice}</label>
            <input id="pPrice" class="control" type="number" min="0" step="0.01" value="${product?.price ?? ""}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label id="pCostLabel" for="pCost">${t.colCost}</label>
            <input id="pCost" class="control" type="number" min="0" step="0.01" value="${product?.cost ?? 0}" />
          </div>
          <div class="field">
            <label id="pStockLabel" for="pStock">${t.colStock}</label>
            <input id="pStock" class="control" type="number" min="0" step="0.001" value="${product?.stock ?? 0}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label id="pMinLabel" for="pMin">${t.minStock}</label>
            <input id="pMin" class="control" type="number" min="0" step="0.001" value="${product?.minStock ?? 0}" />
          </div>
          <div class="field">
            <label for="pActive">${t.status}</label>
            <select id="pActive" class="control">
              <option value="1" ${product?.active !== false ? "selected" : ""}>${t.active}</option>
              <option value="0" ${product?.active === false ? "selected" : ""}>${t.inactive}</option>
            </select>
          </div>
        </div>
      </div>
    `,
    (body) =>
      db
        .upsertProduct({
          id: product?.id,
          name: body.querySelector("#pName").value,
          barcode: body.querySelector("#pBarcode").value,
          sku: body.querySelector("#pSku").value,
          unit: body.querySelector("#pUnit").value,
          price: body.querySelector("#pPrice").value,
          cost: body.querySelector("#pCost").value,
          stock: body.querySelector("#pStock").value,
          minStock: body.querySelector("#pMin").value,
          active: body.querySelector("#pActive").value === "1",
        })
        .then(() => {
          toast(t.productSaved);
          renderProducts();
          renderPos();
          renderInventory();
        }),
    t.save,
    { wide: true }
  );

  requestAnimationFrame(() => {
    const body = document.getElementById("dialogBody");
    syncProductFormLabels(body);
    body?.querySelector("#pUnit")?.addEventListener("change", () => syncProductFormLabels(body));
  });
}

function renderInventory() {
  const tbody = document.getElementById("inventoryBody");
  if (!tbody) return;
  const rows = db.listProducts({ onlyActive: false });
  tbody.innerHTML = rows
    .map((p) => {
      const low = p.active && p.stock <= p.minStock;
      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${p.unit}</td>
          <td>${formatQty(p.stock, p.unit)} ${low ? `<span class="badge warn">${t.lowStock}</span>` : ""}</td>
          <td>${formatQty(p.minStock, p.unit)}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-adjust-stock="${p.id}">${t.adjust}</button></td>
        </tr>`;
    })
    .join("");
}

function openAdjustStock(productId) {
  const product = db.state.products.find((p) => p.id === productId);
  if (!product) return;
  const step = product.unit === "g" ? "1" : "0.001";
  openDialog(
    t.adjustStock,
    `
      <div class="form-stack">
        <p class="field-hint">${escapeHtml(product.name)} · ${t.colStock}: ${formatQty(product.stock, product.unit)}</p>
        <div class="field">
          <label for="adjDelta">${t.qtyDelta}</label>
          <input id="adjDelta" class="control" type="number" step="${step}" placeholder="ex.: -50 ou 100" autofocus />
        </div>
        <div class="field">
          <label for="adjNote">${t.note}</label>
          <input id="adjNote" class="control" placeholder="${t.optional}" />
        </div>
      </div>
    `,
    async (body) => {
      await db.adjustStock(productId, body.querySelector("#adjDelta").value, body.querySelector("#adjNote").value);
      toast(t.stockAdjusted);
      renderInventory();
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
      const statusBadge = o.status === "received" ? "ok" : o.status === "partial" ? "warn" : "";
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

function poLineHtml(products, line = {}) {
  const options = products
    .map((p) => `<option value="${p.id}" ${line.productId === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${p.unit})</option>`)
    .join("");
  return `
    <div class="po-line field-stack" data-po-line>
      <div class="field-row">
        <div class="field">
          <label>${t.product}</label>
          <select class="control po-product">${options}</select>
        </div>
        <div class="field">
          <label>${t.qty}</label>
          <input class="control po-qty" type="number" min="0.001" step="0.001" value="${line.qty ?? 5}" />
        </div>
        <div class="field">
          <label>${t.unitCost}</label>
          <input class="control po-cost" type="number" min="0" step="0.01" value="${line.unitCost ?? ""}" />
        </div>
        <button type="button" class="btn btn-ghost btn-sm po-remove">×</button>
      </div>
    </div>`;
}

async function openNewPurchase() {
  await db.ensureDefaultSupplier();
  const products = db.listProducts();
  const suppliers = db.state.suppliers;
  if (!products.length) {
    toast("Cadastre produtos antes de criar pedido de compra.", true);
    return;
  }
  const supplierOptions = suppliers
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");

  openDialog(
    t.newPurchase,
    `
      <div class="form-stack">
        <div class="field">
          <label for="poSupplier">${t.supplier}</label>
          <select id="poSupplier" class="control">${supplierOptions}</select>
        </div>
        <div id="poLines">${poLineHtml(products)}</div>
        <button type="button" class="btn btn-secondary btn-sm" id="poAddLine">${t.addLine}</button>
        <div class="field">
          <label for="poNote">${t.note}</label>
          <input id="poNote" class="control" placeholder="${t.optional}" />
        </div>
        <p class="field-hint">${t.purchaseHint}</p>
      </div>
    `,
    async (body) => {
      const items = [...body.querySelectorAll("[data-po-line]")].map((row) => {
        const productId = row.querySelector(".po-product").value;
        const product = db.state.products.find((p) => p.id === productId);
        const costRaw = row.querySelector(".po-cost").value;
        return {
          productId,
          qty: row.querySelector(".po-qty").value,
          unitCost: costRaw === "" ? product?.cost : costRaw,
        };
      });
      await db.createPurchaseOrder({
        supplierId: body.querySelector("#poSupplier").value,
        note: body.querySelector("#poNote").value,
        items,
      });
      toast(t.orderCreated);
      renderPurchases();
    },
    t.newPurchase,
    { wide: true }
  );

  requestAnimationFrame(() => {
    const linesRoot = document.getElementById("poLines");
    const syncLine = (row) => {
      const productId = row.querySelector(".po-product").value;
      const p = db.state.products.find((x) => x.id === productId);
      if (!p) return;
      const cost = row.querySelector(".po-cost");
      const qty = row.querySelector(".po-qty");
      if (cost && cost.value === "") cost.value = p.cost;
      if (qty) qty.step = p.unit === "g" ? "1" : "0.001";
    };
    linesRoot?.querySelectorAll("[data-po-line]").forEach(syncLine);
    linesRoot?.addEventListener("change", (e) => {
      const row = e.target.closest("[data-po-line]");
      if (row && e.target.classList.contains("po-product")) syncLine(row);
    });
    document.getElementById("poAddLine")?.addEventListener("click", (e) => {
      e.preventDefault();
      linesRoot.insertAdjacentHTML("beforeend", poLineHtml(products));
      const row = linesRoot.lastElementChild;
      syncLine(row);
    });
    linesRoot?.addEventListener("click", (e) => {
      const btn = e.target.closest(".po-remove");
      if (!btn) return;
      const row = btn.closest("[data-po-line]");
      if (linesRoot.querySelectorAll("[data-po-line]").length <= 1) {
        toast("Pedido precisa de ao menos um item.", true);
        return;
      }
      row.remove();
    });
  });
}

function receivePurchase(orderId) {
  const order = db.state.purchaseOrders.find((o) => o.id === orderId);
  if (!order) return;
  const fields = order.items
    .map((i) => {
      const remaining = roundQty(i.qtyOrdered - i.qtyReceived, i.unit);
      const step = i.unit === "g" ? "1" : "0.001";
      return `
        <div class="field">
          <label for="rec-${i.productId}">${escapeHtml(i.name)} (${t.remaining(formatQty(remaining, i.unit))})</label>
          <input id="rec-${i.productId}" data-rec="${i.productId}" class="control" type="number" min="0" step="${step}" value="${remaining}" />
        </div>`;
    })
    .join("");

  openDialog(
    t.receiveOrder,
    `<div class="form-stack">${fields}</div>`,
    async (body) => {
      const receipts = [...body.querySelectorAll("[data-rec]")].map((el) => ({
        productId: el.dataset.rec,
        qty: el.value,
      }));
      await db.receivePurchaseOrder(orderId, receipts);
      toast(t.receiptDone);
      renderPurchases();
      renderProducts();
      renderInventory();
      renderPos();
    },
    t.confirmReceive
  );
}

function renderSuppliers() {
  const tbody = document.getElementById("suppliersBody");
  if (!tbody) return;
  const rows = db.state.suppliers;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">${t.catalogEmpty}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (s) => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.phone || "—")}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm" data-edit-supplier="${s.id}">${t.edit}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-del-supplier="${s.id}">${t.remove}</button>
        </td>
      </tr>`
    )
    .join("");
}

function openSupplierForm(supplier = null) {
  openDialog(
    supplier ? t.edit : t.newSupplier,
    `
      <div class="form-stack">
        <div class="field">
          <label for="supName">${t.colName}</label>
          <input id="supName" class="control" value="${escapeAttr(supplier?.name || "")}" />
        </div>
        <div class="field">
          <label for="supPhone">${t.phone}</label>
          <input id="supPhone" class="control" value="${escapeAttr(supplier?.phone || "")}" />
        </div>
      </div>
    `,
    async (body) => {
      await db.upsertSupplier({
        id: supplier?.id,
        name: body.querySelector("#supName").value,
        phone: body.querySelector("#supPhone").value,
      });
      toast(t.supplierSaved);
      renderSuppliers();
      renderPurchases();
    },
    t.save
  );
}

function periodBounds(period) {
  const now = new Date();
  if (period === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { fromIso: from.toISOString(), toIso: now.toISOString(), session: null };
  }
  if (period === "7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { fromIso: from.toISOString(), toIso: now.toISOString(), session: null };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromIso: from.toISOString(), toIso: now.toISOString(), session: null };
  }
  const open = db.getOpenSession();
  const session = open || db.state.sessions.find((s) => s.status === "closed");
  return { fromIso: null, toIso: null, session };
}

function getPeriodReport(period) {
  const bounds = periodBounds(period);
  if (bounds.session) {
    const report = db.reportForSession(bounds.session.id);
    return { report, session: bounds.session, period };
  }
  const report = db.reportForPeriod({ fromIso: bounds.fromIso, toIso: bounds.toIso });
  return { report, session: null, period };
}

function renderPeriodReport() {
  const el = document.getElementById("periodReport");
  if (!el) return;
  const period = document.getElementById("reportPeriod")?.value || "session";
  const { report, session } = getPeriodReport(period);
  el.innerHTML = renderReportHtml(report, session, { showMargin: period !== "session" || !session });
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
  } else {
    openBox.hidden = true;
    closedHint.hidden = true;
    reportEl.innerHTML = renderReportHtml(db.reportForSession(open.id), open);
  }
  renderPeriodReport();
}

function renderReportHtml(report, session, { showMargin = false } = {}) {
  const productRows = report.byProduct
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${formatQty(p.qty, p.unit)}</td><td>${money(p.total)}</td></tr>`
    )
    .join("");

  const sessionOpen = session?.status === "open";
  const saleRows = report.sales
    .map(
      (s) => `
      <tr>
        <td>${formatDateTime(s.soldAt)}</td>
        <td>${money(s.total)}</td>
        <td>${s.payments.map((p) => payMethodLabel(p.method)).join(", ")}</td>
        <td class="toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-reprint-sale="${s.id}">${t.printReceipt}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-cancel-sale="${s.id}" ${sessionOpen ? "" : "disabled"}>${t.cancel}</button>
        </td>
      </tr>`
    )
    .join("");

  const marginBlock =
    showMargin && report.cost != null
      ? `
      <div class="stat"><label>${t.costTotal}</label><strong>${money(report.cost)}</strong></div>
      <div class="stat"><label>${t.margin}</label><strong>${money(report.margin)}</strong></div>`
      : "";

  return `
    <div class="stats">
      <div class="stat"><label>${t.sales}</label><strong>${report.salesCount}</strong></div>
      <div class="stat"><label>${t.total}</label><strong>${money(report.total)}</strong></div>
      <div class="stat"><label>${t.gramsSold}</label><strong>${formatQty(report.gramsSold || report.kgSold || 0, "g")}</strong></div>
      ${session ? `<div class="stat"><label>${t.cashFloat}</label><strong>${money(session.openingFloat)}</strong></div>` : ""}
      ${marginBlock}
    </div>
    <div class="card stack-gap">
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

function exportPeriodCsv() {
  const period = document.getElementById("reportPeriod")?.value || "session";
  const { report } = getPeriodReport(period);
  const lines = [["Quando", "Total", "Pagamentos", "Itens"]];
  for (const s of report.sales) {
    const pays = s.payments.map((p) => `${payMethodLabel(p.method)} ${money(p.amount)}`).join(" | ");
    const items = (s.items || [])
      .map((i) => `${i.name} ${formatQty(i.qty, i.unit)} ${money(i.lineTotal)}`)
      .join("; ");
    lines.push([formatDateTime(s.soldAt), money(s.total), pays, items]);
  }
  const csv = lines.map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `elerp-vendas-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function reprintSale(saleId) {
  const sale = db.state.sales.find((s) => s.id === saleId);
  if (!sale) return;
  try {
    receipt?.printReceipt({
      settings: db.state.settings,
      sale: {
        ...sale,
        items: sale.items,
        payments: sale.payments,
        total: sale.total,
        soldAt: sale.soldAt,
      },
      change: sale.changeAmount || 0,
    });
  } catch (e) {
    if (e?.message === "POPUP_BLOCKED") toast(t.errors.popupBlocked, true);
    else toast(e.message || String(e), true);
  }
}

function renderStoreForm() {
  const s = db.state.settings || {};
  const map = {
    stTrade: s.tradeName,
    stLegal: s.legalName,
    stCnpj: s.cnpj,
    stIe: s.ie,
    stPhone: s.phone,
    stAddress: s.address,
    stCity: s.city,
    stState: s.state,
    stZip: s.zip,
    stMsg: s.receiptMessage,
    stCscId: s.cscId,
    stCscToken: s.cscToken,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  });
  const fiscal = document.getElementById("stFiscal");
  if (fiscal) fiscal.value = s.fiscalMode === "nfce_futuro" ? "nfce_futuro" : "nao_fiscal";
}

async function saveStoreForm(e) {
  e.preventDefault();
  try {
    await db.saveSettings({
      tradeName: document.getElementById("stTrade").value,
      legalName: document.getElementById("stLegal").value,
      cnpj: document.getElementById("stCnpj").value,
      ie: document.getElementById("stIe").value,
      phone: document.getElementById("stPhone").value,
      address: document.getElementById("stAddress").value,
      city: document.getElementById("stCity").value,
      state: document.getElementById("stState").value,
      zip: document.getElementById("stZip").value,
      receiptMessage: document.getElementById("stMsg").value,
      fiscalMode: document.getElementById("stFiscal").value,
      cscId: document.getElementById("stCscId").value,
      cscToken: document.getElementById("stCscToken").value,
    });
    toast(t.storeSaved);
  } catch (err) {
    toast(err.message || String(err), true);
  }
}

function renderTeam() {
  const tbody = document.getElementById("teamBody");
  if (!tbody) return;
  const rows = db.state.members || [];
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty">${t.catalogEmpty}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.email)}</td>
        <td><span class="badge">${roleLabel(m.role)}</span></td>
        <td>
          ${m.role !== "owner" ? `<button type="button" class="btn btn-secondary btn-sm" data-edit-member="${m.id}">${t.edit}</button>` : ""}
          ${m.role !== "owner" ? `<button type="button" class="btn btn-ghost btn-sm" data-del-member="${m.id}">${t.remove}</button>` : ""}
        </td>
      </tr>`
    )
    .join("");
}

function openMemberForm(member = null) {
  openDialog(
    member ? t.edit : t.addMember,
    `
      <div class="form-stack">
        <div class="field">
          <label for="memEmail">${t.email}</label>
          <input id="memEmail" class="control" type="email" value="${escapeAttr(member?.email || "")}" ${member ? "readonly" : ""} />
        </div>
        <div class="field">
          <label for="memRole">${t.role}</label>
          <select id="memRole" class="control">
            <option value="manager" ${member?.role === "manager" ? "selected" : ""}>${roleLabel("manager")}</option>
            <option value="cashier" ${member?.role === "cashier" ? "selected" : ""}>${roleLabel("cashier")}</option>
          </select>
        </div>
      </div>
    `,
    async (body) => {
      await db.upsertMember({
        id: member?.id,
        email: body.querySelector("#memEmail").value,
        role: body.querySelector("#memRole").value,
      });
      toast(t.memberSaved);
      renderTeam();
    },
    t.save
  );
}

function fillCatalogGroups() {
  const sel = document.getElementById("catalogGroup");
  if (!sel || !catalog) return;
  const groups = ["", "agua", "refrigerante", "suco", "cha", "energetico", "bebida"];
  sel.innerHTML = groups
    .map((g) => {
      const label = g ? catalog.groupLabel(g) : t.catalogAll;
      return `<option value="${g}">${label}</option>`;
    })
    .join("");
}

async function ensureCatalog() {
  if (!catalog) return;
  if (catalog.loaded) return;
  try {
    await catalog.load();
  } catch {
    toast(t.catalogLoadError, true);
  }
}

async function renderCatalog() {
  const body = document.getElementById("catalogBody");
  const meta = document.getElementById("catalogMeta");
  if (!body) return;
  await ensureCatalog();
  if (!catalog?.loaded) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${t.catalogLoadError}</td></tr>`;
    return;
  }
  const q = document.getElementById("catalogSearch")?.value || "";
  const group = document.getElementById("catalogGroup")?.value || "";
  const rows = catalog.search({ q, group, limit: 100 });
  if (meta) meta.textContent = t.catalogCount(catalog.items.length, catalog.source || "—");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${t.catalogEmpty}</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map(
      (p) => `
      <tr>
        <td><code>${escapeHtml(p.barcode)}</code></td>
        <td><strong>${escapeHtml(p.name)}</strong>${p.brand ? `<div class="muted">${escapeHtml(p.brand)}</div>` : ""}</td>
        <td><span class="badge">${escapeHtml(catalog.groupLabel(p.group))}</span></td>
        <td>${escapeHtml(p.quantity || "—")}</td>
        <td>${money(p.suggested_price)}</td>
        <td><button type="button" class="btn btn-sm" data-import-barcode="${escapeAttr(p.barcode)}">${t.catalogImport}</button></td>
      </tr>`
    )
    .join("");
}

async function handlePosBarcode(code) {
  const digits = String(code || "").replace(/\D/g, "");
  if (!digits) return;
  let product = db.findByBarcode(digits);
  if (!product) {
    await ensureCatalog();
    const item = catalog?.findByBarcode(digits);
    if (item) {
      product = await db.importCatalogItem(item, { stock: 20 });
      toast(t.catalogImported);
    }
  }
  if (!product) {
    toast(t.catalogEmpty, true);
    return;
  }
  addProductToCart(product.id);
  renderProducts();
}

async function updateOfflineBanner() {
  const banner = document.getElementById("offlineBanner");
  if (!banner || !offline) return;
  const count = await offline.count();
  if (count > 0) {
    banner.textContent = t.offlinePending(count);
    setHidden(banner, false);
  } else {
    banner.textContent = "";
    setHidden(banner, true);
  }
}

async function flushOfflineQueue() {
  if (!offline || !db.ready) return;
  const rows = await offline.list();
  if (!rows.length) {
    updateOfflineBanner();
    return;
  }
  let synced = 0;
  for (const row of rows) {
    try {
      const payload = row.payload || {};
      await db.confirmSale({
        payments: payload.payments || [],
        cartOverride: payload.cart || payload.cartOverride || [],
      });
      await offline.remove(row.id);
      synced++;
    } catch (err) {
      if (isNetworkError(err)) break;
      console.error("Offline sync item failed", err);
      await offline.remove(row.id);
    }
  }
  if (synced > 0) {
    toast(t.offlineSynced);
    refreshSessionPill();
    const active = document.querySelector(".panel.active")?.id || "panel-pos";
    switchPanel(active);
  }
  updateOfflineBanner();
}

function openCashSession() {
  openDialog(
    t.openCashTitle,
    `
      <div class="form-stack">
        <div class="field">
          <label for="openFloat">${t.openingFloat}</label>
          <input id="openFloat" class="control" type="number" min="0" step="0.01" value="100" />
        </div>
        <div class="field">
          <label for="openNote">${t.note}</label>
          <input id="openNote" class="control" placeholder="${t.optional}" />
        </div>
      </div>
    `,
    async (body) => {
      await db.openSession(body.querySelector("#openFloat").value, body.querySelector("#openNote").value);
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
      <div class="form-stack">
        <p class="field-hint">${t.expectedCash(`<strong>${money(expected)}</strong>`)}</p>
        <div class="field">
          <label for="closeCounted">${t.countedCash}</label>
          <input id="closeCounted" class="control" type="number" min="0" step="0.01" value="${expected.toFixed(2)}" />
        </div>
        <div class="field">
          <label for="closeNote">${t.note}</label>
          <input id="closeNote" class="control" placeholder="${t.optional}" />
        </div>
      </div>
    `,
    async (body) => {
      const session = await db.closeSession(
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

function bindEvents() {
  ui.areaButtons.forEach((btn) => {
    btn.addEventListener("click", () => setArea(btn.dataset.area));
  });
  ui.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  document.getElementById("btnOpenCash").addEventListener("click", openCashSession);
  document.getElementById("btnOpenCashFromPos").addEventListener("click", openCashSession);
  document.getElementById("btnCloseCash").addEventListener("click", closeCashSession);
  document.getElementById("productSearch").addEventListener("input", renderPos);
  document.getElementById("posBarcode")?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const input = e.currentTarget;
    const code = input.value;
    input.value = "";
    await handlePosBarcode(code);
  });
  document.getElementById("catalogSearch")?.addEventListener("input", () => renderCatalog());
  document.getElementById("catalogGroup")?.addEventListener("change", () => renderCatalog());
  document.getElementById("catalogBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-import-barcode]");
    if (!btn) return;
    try {
      const item = catalog.findByBarcode(btn.dataset.importBarcode);
      if (!item) throw new Error(t.catalogEmpty);
      await db.importCatalogItem(item, { stock: 20 });
      toast(t.catalogImported);
      renderProducts();
      renderPos();
    } catch (err) {
      toast(err.message || String(err), true);
    }
  });

  document.getElementById("btnCheckout").addEventListener("click", checkout);
  document.getElementById("btnAddPay").addEventListener("click", btnAddPay);
  document.getElementById("payLines")?.addEventListener("input", () => {
    syncPayLinesFromInputs();
    syncChangeHint();
  });
  document.getElementById("payLines")?.addEventListener("change", () => {
    syncPayLinesFromInputs();
    syncChangeHint();
  });
  document.getElementById("payLines")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-pay]");
    if (!btn) return;
    const idx = Number(btn.dataset.removePay);
    if (idx > 0) {
      payLines.splice(idx, 1);
      renderPayLines();
    }
  });

  document.getElementById("btnClearCart").addEventListener("click", () => {
    db.clearCart();
    payLines = [{ method: "dinheiro", amount: "" }];
    renderCart();
  });
  document.getElementById("btnNewProduct").addEventListener("click", () => openProductForm());
  document.getElementById("btnNewPurchase").addEventListener("click", openNewPurchase);
  document.getElementById("btnNewSupplier")?.addEventListener("click", () => openSupplierForm());
  document.getElementById("btnNewMember")?.addEventListener("click", () => openMemberForm());
  document.getElementById("storeForm")?.addEventListener("submit", saveStoreForm);
  document.getElementById("reportPeriod")?.addEventListener("change", renderPeriodReport);
  document.getElementById("btnExportCsv")?.addEventListener("click", exportPeriodCsv);

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
    const editBtn = e.target.closest("[data-edit-product]");
    const addonBtn = e.target.closest("[data-manage-addons]");
    if (editBtn) {
      const product = db.state.products.find((p) => p.id === editBtn.dataset.editProduct);
      if (product) openProductForm(product);
    }
    if (addonBtn) openAddonsManager(addonBtn.dataset.manageAddons);
  });

  document.getElementById("inventoryBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-adjust-stock]");
    if (btn) openAdjustStock(btn.dataset.adjustStock);
  });

  document.getElementById("suppliersBody")?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-supplier]");
    const delBtn = e.target.closest("[data-del-supplier]");
    if (editBtn) {
      const supplier = db.state.suppliers.find((s) => s.id === editBtn.dataset.editSupplier);
      if (supplier) openSupplierForm(supplier);
    }
    if (delBtn) {
      if (!confirm("Remover fornecedor?")) return;
      try {
        await db.deleteSupplier(delBtn.dataset.delSupplier);
        toast(t.supplierSaved);
        renderSuppliers();
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  document.getElementById("teamBody")?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-member]");
    const delBtn = e.target.closest("[data-del-member]");
    if (editBtn) {
      const member = db.state.members.find((m) => m.id === editBtn.dataset.editMember);
      if (member) openMemberForm(member);
    }
    if (delBtn) {
      if (!confirm("Remover membro da equipe?")) return;
      try {
        await db.removeMember(delBtn.dataset.delMember);
        toast(t.memberRemoved);
        renderTeam();
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  document.getElementById("purchasesBody").addEventListener("click", async (e) => {
    const send = e.target.closest("[data-po-send]");
    const receive = e.target.closest("[data-po-receive]");
    if (send) {
      try {
        await db.markPurchaseSent(send.dataset.poSend);
        toast(t.orderMarkedSent);
        renderPurchases();
      } catch (err) {
        toast(err.message, true);
      }
    }
    if (receive) receivePurchase(receive.dataset.poReceive);
  });

  const dayRoot = document.getElementById("panel-day");
  dayRoot?.addEventListener("click", async (e) => {
    const cancelBtn = e.target.closest("[data-cancel-sale]");
    const reprintBtn = e.target.closest("[data-reprint-sale]");
    if (reprintBtn) {
      reprintSale(reprintBtn.dataset.reprintSale);
      return;
    }
    if (!cancelBtn) return;
    if (!confirm(t.cancelSaleConfirm)) return;
    try {
      await db.cancelSale(cancelBtn.dataset.cancelSale);
      toast(t.saleCancelled);
      renderDay();
      renderPos();
      renderProducts();
      renderInventory();
    } catch (err) {
      toast(err.message, true);
    }
  });

  document.getElementById("btnScaleConnect")?.addEventListener("click", async () => {
    try {
      await scale.connect();
      renderScaleStatus();
      toast(t.scaleConnected);
    } catch (err) {
      if (err?.message === "UNSUPPORTED") toast(t.scaleUnsupported, true);
      else toast(t.scalePermissionDenied, true);
    }
  });

  document.getElementById("btnScaleDisconnect")?.addEventListener("click", async () => {
    await scale.disconnect();
    renderScaleStatus();
  });

  document.getElementById("btnScaleSave")?.addEventListener("click", () => {
    scale.setConfig({
      protocolId: document.getElementById("scaleProtocol").value,
      baudRate: Number(document.getElementById("scaleBaud").value) || 9600,
    });
    if (scale.status().connected) scale.startPolling();
    toast(t.scaleSaved);
    renderScaleStatus();
  });

  scale?.on((ev) => {
    if (["weight", "connected", "disconnected", "config"].includes(ev.type)) renderScaleStatus();
    if (ev.type === "error") toast(t.scaleError, true);
  });

  window.addEventListener("online", () => {
    flushOfflineQueue();
  });
}

function init() {
  document.documentElement.lang = "pt-BR";
  try {
    applyStaticLabels();
    bindEvents();
    bindAuth();
    setAppVisible(false);
    bootAuth();
  } catch (error) {
    console.error(error);
    const msg = document.getElementById("loginMessage");
    if (msg) {
      msg.textContent = "Erro ao iniciar a interface. Atualize a página.";
      msg.classList.add("error");
    }
    setAppVisible(false);
  }
}

function setLoginMessage(msg, isError = false) {
  const el = document.getElementById("loginMessage");
  if (!el) return;
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

  db.onChange = () => {
    if (!db.ready) return;
    applyRoleVisibility();
    refreshSessionPill();
    updateOfflineBanner();
    const active = document.querySelector(".panel.active")?.id || "panel-pos";
    switchPanel(active);
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
    applyRoleVisibility();
    refreshSessionPill();
    ensureCatalog();
    await flushOfflineQueue();
    updateOfflineBanner();
    setArea("ops");
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

})();
