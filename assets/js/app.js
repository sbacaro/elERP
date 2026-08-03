(function () {
const { db, roundMoney, roundQty, lineTotal, formatMoney, formatQty, formatDateTime } = window.elERP;
const { t, payMethodLabel, poStatusLabel } = window.elERPLocale;
const scale = window.elERPScale;
const catalog = window.elERPCatalog;

const PANEL_AREA = {
  "panel-pos": "ops",
  "panel-day": "ops",
  "panel-products": "mgmt",
  "panel-purchases": "mgmt",
  "panel-catalog": "mgmt",
  "panel-scale": "mgmt",
  "panel-settings": "mgmt",
};

const AREA_DEFAULT_PANEL = {
  ops: "panel-pos",
  mgmt: "panel-products",
};

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
    "panel-purchases": t.nav.purchases,
    "panel-day": t.nav.day,
    "panel-scale": t.nav.scale,
    "panel-catalog": t.nav.catalog,
    "panel-settings": t.nav.settings,
  };
  ui.navButtons.forEach((btn) => {
    btn.textContent = navMap[btn.dataset.panel] || btn.textContent;
  });
  ui.areaButtons.forEach((btn) => {
    btn.textContent = btn.dataset.area === "mgmt" ? t.nav.mgmt : t.nav.ops;
  });

  setText("#labelSettings", t.settingsTitle);
  setText("#settingsHelp", t.settingsHelp);
  setText("#labelSettingsAccount", t.settingsAccount);
  setText("#settingsAccountHint", t.settingsAccountHint);
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
  setText("#labelScale", t.scaleTitle);
  setText("#scaleHelp", t.scaleHelp);
  setText("#labelScaleProtocol", t.scaleProtocol);
  setText("#labelScaleBaud", t.scaleBaud);
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
  ui.currentArea = next;
  document.body.dataset.area = next;

  ui.areaButtons.forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.area === next ? "page" : "false");
  });

  const navOps = document.getElementById("navOps");
  const navMgmt = document.getElementById("navMgmt");
  setHidden(navOps, next !== "ops");
  setHidden(navMgmt, next !== "mgmt");

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
  if (id === "panel-purchases") renderPurchases();
  if (id === "panel-day") renderDay();
  if (id === "panel-scale") renderScaleStatus();
  if (id === "panel-catalog") renderCatalog();
}

function refreshSessionPill() {
  const open = db.getOpenSession();
  ui.sessionPill.dataset.open = open ? "true" : "false";
  ui.sessionPill.innerHTML = open
    ? `<span class="dot"></span> ${t.sessionOpen(money(open.openingFloat))}`
    : `<span class="dot"></span> ${t.sessionClosed}`;
}

function openDialog(title, bodyHtml, onConfirm, confirmLabel = t.dialogConfirm, options = {}) {
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

  const close = () => {
    backdrop.classList.remove("open");
    panel?.classList.remove("dialog-wide");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    backdrop.onkeydown = null;
  };

  const submit = async () => {
    try {
      await onConfirm(bodyEl);
      close();
    } catch (err) {
      toast(err.message || String(err), true);
    }
  };

  cancelBtn.onclick = close;
  confirmBtn.onclick = submit;
  backdrop.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
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
}

function priceLabel(unit, price) {
  if (unit === "un") return `${money(price)} / un`;
  return `${money(price)} / kg`;
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
        const line = lineTotal(item.qty, item.unit, item.unitPrice);
        const priceLabelText =
          item.unit === "g"
            ? `${formatQty(item.qty, "g")} · ${money(item.unitPrice)}/kg`
            : item.unit === "kg"
              ? `${formatQty(item.qty, "kg")} · ${money(item.unitPrice)}/kg`
              : `${formatQty(item.qty, item.unit)} × ${money(item.unitPrice)}`;
        return `
          <li class="cart-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="meta">${priceLabelText}</div>
            </div>
            <div class="cart-item-actions">
              <strong>${money(line)}</strong>
              <div><button type="button" class="btn btn-ghost btn-sm" data-remove-cart="${idx}">${t.remove}</button></div>
            </div>
          </li>`;
      })
      .join("");
  }

  const total = roundMoney(cart.reduce((s, i) => s + lineTotal(i.qty, i.unit, i.unitPrice), 0));
  document.getElementById("cartTotal").textContent = money(total);

  const payInput = document.getElementById("payAmount");
  if (document.activeElement !== payInput) {
    payInput.value = total ? total.toFixed(2) : "";
  }
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
  if (support) {
    support.textContent = st.supported ? "" : t.scaleUnsupported;
  }
  if (statusText) {
    statusText.textContent = st.connected ? t.scaleConnected : t.scaleDisconnected;
  }
  if (lastText) {
    if (!st.last) lastText.textContent = t.scaleNone;
    else {
      const grams = st.last.grams ?? Math.round((st.last.kg || 0) * 1000);
      lastText.textContent = `${formatQty(grams, "g")} · ${
        st.last.stable ? t.scaleStable : t.scaleUnstable
      }`;
    }
  }
  if (rawText) {
    rawText.textContent = st.last?.raw ? String(st.last.raw) : "";
  }
  const connectBtn = document.getElementById("btnScaleConnect");
  const disconnectBtn = document.getElementById("btnScaleDisconnect");
  if (connectBtn) connectBtn.disabled = !st.supported || st.connected;
  if (disconnectBtn) disconnectBtn.disabled = !st.connected;
}

function addProductToCart(productId) {
  const product = db.state.products.find((p) => p.id === productId);
  if (!product) return;

  if (product.unit === "un") {
    const cart = db.state.cart.slice();
    const existing = cart.find((c) => c.productId === product.id && c.unit === "un");
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
      });
    }
    db.setCart(cart);
    renderCart();
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
      const cart = db.state.cart.slice();
      cart.push({
        productId: product.id,
        name: product.name,
        unit: sellUnit,
        qty,
        unitPrice: product.price,
      });
      db.setCart(cart);
      renderCart();
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
        reading.textContent = `${shown} · ${
          st.last.stable ? t.scaleStable : t.scaleUnstable
        }`;
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

async function checkout() {
  try {
    if (!db.getOpenSession()) throw new Error(t.errors.openBeforeSell);
    if (!db.state.cart.length) throw new Error(t.errors.emptyCart);
    const method = document.getElementById("payMethod").value;
    const amount = roundMoney(document.getElementById("payAmount").value);
    const total = roundMoney(db.state.cart.reduce((s, i) => s + lineTotal(i.qty, i.unit, i.unitPrice), 0));
    if (Math.abs(amount - total) > 0.009) {
      throw new Error(t.errors.payMustMatchTotal);
    }
    const sale = await db.confirmSale({ payments: [{ method, amount }] });
    toast(t.saleRegistered(money(sale.total)));
    renderPos();
    renderProducts();
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
          <td>${priceLabel(p.unit, p.price)}</td>
          <td>${p.unit === "un" ? money(p.cost) : `${money(p.cost)} / kg`}</td>
          <td>${formatQty(p.stock, p.unit)} ${low ? `<span class="badge warn">${t.lowStock}</span>` : ""}</td>
          <td>${p.active ? `<span class="badge ok">${t.active}</span>` : `<span class="badge">${t.inactive}</span>`}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}">${t.edit}</button></td>
        </tr>`;
    })
    .join("");
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
  if (meta) {
    meta.textContent = t.catalogCount(catalog.items.length, catalog.source || "—");
  }
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
    (body) => {
      return db.upsertProduct({
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
      }).then(() => {
        toast(t.productSaved);
        renderProducts();
        renderPos();
      });
    },
    t.save,
    { wide: true }
  );

  requestAnimationFrame(() => {
    const body = document.getElementById("dialogBody");
    syncProductFormLabels(body);
    body?.querySelector("#pUnit")?.addEventListener("change", () => syncProductFormLabels(body));
  });
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

async function openNewPurchase() {
  await db.ensureDefaultSupplier();
  const products = db.listProducts();
  const suppliers = db.state.suppliers;
  if (!products.length) {
    toast("Cadastre produtos antes de criar pedido de compra.", true);
    return;
  }
  const options = products
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.unit})</option>`)
    .join("");
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
        <div class="field">
          <label for="poProduct">${t.product}</label>
          <select id="poProduct" class="control">${options}</select>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="poQty">${t.qty}</label>
            <input id="poQty" class="control" type="number" min="0.001" step="0.001" value="5" />
          </div>
          <div class="field">
            <label for="poCost">${t.unitCost}</label>
            <input id="poCost" class="control" type="number" min="0" step="0.01" />
          </div>
        </div>
        <div class="field">
          <label for="poNote">${t.note}</label>
          <input id="poNote" class="control" placeholder="${t.optional}" />
        </div>
        <p class="field-hint">${t.purchaseHint}</p>
      </div>
    `,
    async (body) => {
      const productId = body.querySelector("#poProduct").value;
      const product = db.state.products.find((p) => p.id === productId);
      const costRaw = body.querySelector("#poCost").value;
      await db.createPurchaseOrder({
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
  const qtyInput = document.getElementById("poQty");
  const syncProductFields = () => {
    const p = db.state.products.find((x) => x.id === productSelect.value);
    if (!p) return;
    costInput.value = p.cost;
    qtyInput.step = p.unit === "g" ? "1" : "0.001";
  };
  productSelect.onchange = syncProductFields;
  syncProductFields();
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
      <div class="stat"><label>${t.gramsSold}</label><strong>${formatQty(report.gramsSold || report.kgSold || 0, "g")}</strong></div>
      <div class="stat"><label>${t.cashFloat}</label><strong>${money(session.openingFloat)}</strong></div>
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

  document.getElementById("dayReport").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cancel-sale]");
    if (!btn) return;
    if (!confirm(t.cancelSaleConfirm)) return;
    try {
      await db.cancelSale(btn.dataset.cancelSale);
      toast(t.saleCancelled);
      renderDay();
      renderPos();
      renderProducts();
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
    if (scale.status().connected) {
      // re-aplica polling com protocolo novo
      scale.startPolling();
    }
    toast(t.scaleSaved);
    renderScaleStatus();
  });

  scale?.on((ev) => {
    if (["weight", "connected", "disconnected", "config"].includes(ev.type)) {
      renderScaleStatus();
    }
    if (ev.type === "error") {
      toast(t.scaleError, true);
    }
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
    refreshSessionPill();
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
    refreshSessionPill();
    ensureCatalog();
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
