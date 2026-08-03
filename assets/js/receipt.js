(function () {
  const { formatMoney, formatQty, formatDateTime } = window.elERP || {};
  const { payMethodLabel } = window.elERPLocale || {};

  function money(n) {
    return (formatMoney || ((v) => String(v)))(n);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function buildReceiptHtml({ settings, sale, change = 0 }) {
    const s = settings || {};
    const lines = (sale.items || [])
      .map((item) => {
        const addonLines = (item.addons || [])
          .map((a) => `<div class="r-addon">+ ${escapeHtml(a.name)} ${money(a.price)}</div>`)
          .join("");
        return `
          <div class="r-line">
            <div><strong>${escapeHtml(item.name)}</strong></div>
            <div class="r-meta">${formatQty ? formatQty(item.qty, item.unit) : item.qty} · ${money(item.lineTotal)}</div>
            ${addonLines}
          </div>`;
      })
      .join("");

    const pays = (sale.payments || [])
      .map((p) => `<div class="r-row"><span>${escapeHtml((payMethodLabel && payMethodLabel(p.method)) || p.method)}</span><span>${money(p.amount)}</span></div>`)
      .join("");

    return `
      <div class="receipt">
        <div class="r-center">
          <strong>${escapeHtml(s.tradeName || s.trade_name || "elERP")}</strong>
          ${s.legalName || s.legal_name ? `<div>${escapeHtml(s.legalName || s.legal_name)}</div>` : ""}
          ${s.cnpj ? `<div>CNPJ ${escapeHtml(s.cnpj)}</div>` : ""}
          ${s.address ? `<div>${escapeHtml(s.address)}</div>` : ""}
          ${s.city ? `<div>${escapeHtml(s.city)}${s.state ? " / " + escapeHtml(s.state) : ""}</div>` : ""}
          <div class="r-badge">CUPOM NÃO FISCAL</div>
        </div>
        <div class="r-meta">${formatDateTime ? formatDateTime(sale.soldAt) : sale.soldAt || ""}</div>
        <hr />
        ${lines}
        <hr />
        <div class="r-row"><strong>Total</strong><strong>${money(sale.total)}</strong></div>
        ${pays}
        ${change > 0 ? `<div class="r-row"><span>Troco</span><span>${money(change)}</span></div>` : ""}
        <hr />
        <div class="r-center muted">${escapeHtml(s.receiptMessage || s.receipt_message || "")}</div>
      </div>`;
  }

  function printReceipt(opts) {
    const html = buildReceiptHtml(opts);
    const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
    if (!win) throw new Error("POPUP_BLOCKED");
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Cupom</title>
      <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet" />
      <style>
        * { font-family: "Atkinson Hyperlegible", sans-serif !important; font-variant-numeric: tabular-nums; box-sizing: border-box; }
        body { margin: 0; padding: 12px; color: #14212b; }
        .receipt { width: 280px; margin: 0 auto; font-size: 13px; }
        .r-center { text-align: center; }
        .r-badge { margin: 8px 0; font-weight: 700; letter-spacing: 0.04em; }
        .r-line { margin: 8px 0; }
        .r-addon, .r-meta { color: #5c6b76; font-size: 12px; }
        .r-row { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
        hr { border: 0; border-top: 1px dashed #ccc; margin: 10px 0; }
        .muted { color: #5c6b76; }
        @media print { body { padding: 0; } }
      </style></head><body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  }

  window.elERPReceipt = { buildReceiptHtml, printReceipt };
})();
