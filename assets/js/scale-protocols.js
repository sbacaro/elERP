(function () {
  /** Extrai kg a partir de textos comuns de balanças BR / genéricas. */

  function toKg(value, unitHint) {
    const n = Number(String(value).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (unitHint === "g" || (unitHint == null && n >= 20 && Number.isInteger(n))) {
      // números grandes inteiros costumam ser gramas em alguns frames
      if (unitHint === "g" || n > 10) return Math.round((n / 1000) * 1000) / 1000;
    }
    if (n > 100) return null; // evita interpretar preço como peso
    return Math.round(n * 1000) / 1000;
  }

  function pickNumber(text) {
    const cleaned = String(text).replace(/[^\d.,+\-kgKG\s]/g, " ");
    const matches = [...cleaned.matchAll(/([+-]?\d+[.,]\d+|[+-]?\d+)/g)].map((m) => m[1]);
    if (!matches.length) return null;
    // prioriza casas decimais
    const decimal = matches.find((m) => /[.,]/.test(m));
    return decimal || matches[matches.length - 1];
  }

  const protocols = {
    auto: {
      id: "auto",
      label: "Automático (detectar)",
      baudRate: 9600,
      parse(chunk) {
        for (const key of ["toledo", "filizola", "urano", "elgin", "ascii_kg", "generic"]) {
          if (key === "auto") continue;
          const r = protocols[key].parse(chunk);
          if (r) return { ...r, protocol: key };
        }
        return null;
      },
    },

    generic: {
      id: "generic",
      label: "Genérico (número no fluxo)",
      baudRate: 9600,
      parse(chunk) {
        const raw = String(chunk);
        const hasKg = /kg/i.test(raw);
        const hasG = /\bg\b/i.test(raw) && !hasKg;
        const num = pickNumber(raw);
        if (!num) return null;
        const kg = toKg(num, hasG ? "g" : hasKg ? "kg" : null);
        if (!kg) return null;
        const stable = /ST|ESTAV|ESTÁV|STABLE|^\s*S\b/i.test(raw) || !/US|UNST|INSTAV/i.test(raw);
        return { kg, stable, raw };
      },
    },

    ascii_kg: {
      id: "ascii_kg",
      label: "ASCII com kg (0.385kg / 0,385 kg)",
      baudRate: 9600,
      parse(chunk) {
        const m = String(chunk).match(/([+-]?\d+[.,]\d+)\s*kg/i);
        if (!m) return null;
        const kg = toKg(m[1], "kg");
        if (!kg) return null;
        return { kg, stable: !/US|UNST|INSTAV/i.test(chunk), raw: chunk };
      },
    },

    toledo: {
      id: "toledo",
      label: "Toledo / Prix (ST,GS / contínuo)",
      baudRate: 9600,
      // vários firmwares Toledo enviam linhas tipo ST,GS,+  0.385kg
      parse(chunk) {
        const raw = String(chunk);
        let m =
          raw.match(/(ST|US)\s*,\s*(GS|NT)\s*,\s*([+-]?\s*\d+[.,]\d+)\s*kg/i) ||
          raw.match(/(ST|US).*?([+-]?\s*\d+[.,]\d+)\s*kg/i);
        if (m) {
          const kg = toKg(m[m.length - 1], "kg");
          if (!kg) return null;
          return { kg, stable: /^ST/i.test(m[1]), raw };
        }
        m = raw.match(/([+-]?\d{1,3}[.,]\d{3})\s*(kg)?/i);
        if (!m) return null;
        const kg = toKg(m[1], "kg");
        if (!kg) return null;
        return { kg, stable: !/US/i.test(raw), raw };
      },
      // alguns modelos respondem a ENQ
      pollCommand: Uint8Array.from([0x05]),
    },

    filizola: {
      id: "filizola",
      label: "Filizola (contínuo / ENQ)",
      baudRate: 9600,
      parse(chunk) {
        const raw = String(chunk);
        // exemplos comuns: linhas com peso e status
        let m = raw.match(/(?:PESO|P)\s*[:=]?\s*([+-]?\d+[.,]\d+)/i);
        if (!m) m = raw.match(/([+-]?\d+[.,]\d{3})/);
        if (!m) return null;
        const kg = toKg(m[1], "kg");
        if (!kg) return null;
        const stable = /ESTAV|ST|OK/i.test(raw) || !/INSTAV|US/i.test(raw);
        return { kg, stable, raw };
      },
      pollCommand: Uint8Array.from([0x05]),
    },

    urano: {
      id: "urano",
      label: "Urano (ASCII / ENQ)",
      baudRate: 9600,
      parse(chunk) {
        const raw = String(chunk);
        const m =
          raw.match(/([+-]?\d+[.,]\d+)\s*kg/i) ||
          raw.match(/\b([+-]?\d{1,3}[.,]\d{3})\b/);
        if (!m) return null;
        const kg = toKg(m[1], "kg");
        if (!kg) return null;
        return { kg, stable: !/US|INST/i.test(raw), raw };
      },
      pollCommand: Uint8Array.from([0x05]),
    },

    elgin: {
      id: "elgin",
      label: "Elgin / genérico ENQ",
      baudRate: 9600,
      parse(chunk) {
        const raw = String(chunk);
        const m =
          raw.match(/([+-]?\d+[.,]\d+)\s*kg/i) ||
          raw.match(/([+-]?\d+[.,]\d+)/);
        if (!m) return null;
        const kg = toKg(m[1], /,\d{3}$|\.\d{3}$/.test(m[1]) ? "kg" : null);
        if (!kg) return null;
        return { kg, stable: !/US|INST/i.test(raw), raw };
      },
      pollCommand: Uint8Array.from([0x05]),
    },

    welmy: {
      id: "welmy",
      label: "Welmy / Ramuza (ASCII)",
      baudRate: 9600,
      parse(chunk) {
        return protocols.ascii_kg.parse(chunk) || protocols.generic.parse(chunk);
      },
      pollCommand: Uint8Array.from([0x05]),
    },

    request_p: {
      id: "request_p",
      label: "Pedido com 'P' (vários modelos)",
      baudRate: 9600,
      parse(chunk) {
        return protocols.generic.parse(chunk);
      },
      pollCommand: new TextEncoder().encode("P\r\n"),
    },
  };

  /**
   * Códigos de barras de peso variável (comuns em balanças etiquetadoras BR).
   * Formatos frequentes EAN-13:
   * - 2 + PLU(5) + peso em gramas(5) + DV
   * - 2 + PLU(4/5) + preço(5) — neste caso não há peso; ignoramos
   */
  function parseWeightBarcode(code) {
    const digits = String(code || "").replace(/\D/g, "");
    if (digits.length !== 13) return null;
    if (!digits.startsWith("2")) return null;
    // tenta peso em gramas nos dígitos 8-12 (1-based: positions 8-12)
    const grams = Number(digits.slice(7, 12));
    if (!Number.isFinite(grams) || grams <= 0 || grams > 99999) return null;
    const kg = Math.round((grams / 1000) * 1000) / 1000;
    if (kg <= 0 || kg > 100) return null;
    return { kg, grams, stable: true, raw: digits, source: "barcode" };
  }

  window.elERPScaleProtocols = {
    list: Object.values(protocols),
    get: (id) => protocols[id] || protocols.auto,
    parseWeightBarcode,
    baudRates: [2400, 4800, 9600, 19200, 38400, 115200],
  };
})();
