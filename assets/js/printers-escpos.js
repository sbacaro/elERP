(function () {
  /** Encoder ESC/POS com página de código adequada a PT-BR (CP860). */

  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  // Subconjunto CP860 (PT-BR) para acentuação comum em cupons
  const CP860 = {
    "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85,
    "Å": 0x8f, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b,
    "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "É": 0x90, "æ": 0x91, "Æ": 0x92,
    "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97, "ÿ": 0x98,
    "Ö": 0x99, "Ü": 0x9a, "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3,
    "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7, "¿": 0xa8, "Á": 0xb5,
    "Â": 0xb6, "À": 0xb7, "ã": 0xc6, "Ã": 0xc7, "Õ": 0xe4, "õ": 0xe5,
    "Ê": 0xd2, "Í": 0xd6, "Ó": 0xe0, "ß": 0xe1, "Ô": 0xe2, "Ò": 0xe3,
    "Ú": 0xe9, "Û": 0xea, "Ù": 0xeb, "ý": 0xec, "Ý": 0xed, "´": 0xef,
    "°": 0xf8, "£": 0x9c, "₹": 0x3f, "€": 0x3f, "R$": null,
  };

  function encodeChar(ch) {
    if (ch === "\n") return [LF];
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) return [code];
    if (CP860[ch] != null) return [CP860[ch]];
    // fallback ASCII
    const map = {
      "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...",
    };
    if (map[ch]) return encodeText(map[ch]);
    return [0x3f];
  }

  function encodeText(text) {
    const out = [];
    const s = String(text || "");
    for (const ch of s) {
      if (ch === "R" && s.includes("R$")) {
        /* handled per char */
      }
      out.push(...encodeChar(ch));
    }
    return out;
  }

  function bytes(...arr) {
    const flat = [];
    for (const a of arr) {
      if (a == null) continue;
      if (typeof a === "number") flat.push(a & 0xff);
      else if (a instanceof Uint8Array) flat.push(...a);
      else if (Array.isArray(a)) flat.push(...a);
      else flat.push(...encodeText(a));
    }
    return new Uint8Array(flat);
  }

  function concat(chunks) {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  function init() {
    return bytes(ESC, 0x40); // ESC @
  }

  function codePage860() {
    // ESC t n — CP860 é tipicamente n=3 em muitas Epson/compatíveis BR
    return bytes(ESC, 0x74, 0x03);
  }

  function align(mode) {
    // 0 left, 1 center, 2 right
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    return bytes(ESC, 0x61, n);
  }

  function bold(on) {
    return bytes(ESC, 0x45, on ? 1 : 0);
  }

  function doubleSize(on) {
    return bytes(GS, 0x21, on ? 0x11 : 0x00);
  }

  function textLine(text) {
    return bytes(...encodeText(text), LF);
  }

  function feed(n = 1) {
    return bytes(...Array(n).fill(LF));
  }

  function cut(partial = false) {
    // GS V m
    return bytes(GS, 0x56, partial ? 0x01 : 0x00);
  }

  function drawer() {
    // ESC p m t1 t2 — gaveta pin 2
    return bytes(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  function hr(widthChars = 32) {
    return textLine("-".repeat(Math.max(16, Math.min(48, widthChars))));
  }

  function cols(widthMm) {
    return widthMm <= 58 ? 32 : 48;
  }

  function padRow(left, right, width) {
    const l = String(left || "");
    const r = String(right || "");
    const space = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(space) + r;
  }

  function buildNonFiscalReceipt({ settings, sale, change = 0, paperMm = 80, openDrawer = false }) {
    const width = cols(paperMm);
    const s = settings || {};
    const chunks = [init(), codePage860()];

    chunks.push(align("center"), bold(true), doubleSize(true));
    chunks.push(textLine(s.tradeName || s.trade_name || "elERP"));
    chunks.push(doubleSize(false), bold(false));
    if (s.legalName || s.legal_name) chunks.push(textLine(s.legalName || s.legal_name));
    if (s.cnpj) chunks.push(textLine(`CNPJ ${s.cnpj}`));
    if (s.address) chunks.push(textLine(s.address));
    if (s.city) chunks.push(textLine(`${s.city}${s.state ? " / " + s.state : ""}`));
    chunks.push(bold(true), textLine("CUPOM NAO FISCAL"), bold(false));
    chunks.push(align("left"));
    const when = sale.soldAt ? new Date(sale.soldAt).toLocaleString("pt-BR") : "";
    if (when) chunks.push(textLine(when));
    chunks.push(hr(width));

    for (const item of sale.items || []) {
      const qtyLabel =
        item.unit === "g"
          ? `${Math.round(item.qty)} g`
          : item.unit === "kg"
            ? `${Number(item.qty).toFixed(3)} kg`
            : `${item.qty} un`;
      const price = Number(item.lineTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      chunks.push(textLine(item.name || ""));
      chunks.push(textLine(padRow(qtyLabel, price, width)));
      for (const a of item.addons || []) {
        const ap = Number(a.price || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        chunks.push(textLine(padRow(`+ ${a.name}`, ap, width)));
      }
    }

    chunks.push(hr(width));
    const total = Number(sale.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    chunks.push(bold(true), textLine(padRow("TOTAL", total, width)), bold(false));
    for (const p of sale.payments || []) {
      const label = p.method === "dinheiro" ? "Dinheiro" : p.method === "pix" ? "Pix" : p.method === "cartao" ? "Cartao" : p.method;
      const amt = Number(p.amount || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      chunks.push(textLine(padRow(label, amt, width)));
    }
    if (change > 0) {
      const c = Number(change).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      chunks.push(textLine(padRow("Troco", c, width)));
    }
    chunks.push(hr(width), align("center"));
    if (s.receiptMessage || s.receipt_message) chunks.push(textLine(s.receiptMessage || s.receipt_message));
    chunks.push(feed(3));
    if (openDrawer) chunks.push(drawer());
    chunks.push(cut(false));
    return concat(chunks);
  }

  function buildTestPage({ paperMm = 80, modelLabel = "ESC/POS" }) {
    const width = cols(paperMm);
    return concat([
      init(),
      codePage860(),
      align("center"),
      bold(true),
      textLine("elERP — teste de impressao"),
      bold(false),
      textLine(modelLabel),
      textLine(new Date().toLocaleString("pt-BR")),
      hr(width),
      align("left"),
      textLine("Acentuacao: cao, acai, coracao"),
      textLine(padRow("Item teste", "R$ 1,99", width)),
      feed(3),
      cut(false),
    ]);
  }

  window.elERPEscPos = {
    buildNonFiscalReceipt,
    buildTestPage,
    cols,
    encodeText,
  };
})();
