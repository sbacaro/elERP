(function () {
  const STORAGE_KEY = "elERP.printer.v1";
  const catalog = () => window.elERPPrinterCatalog;
  const escpos = () => window.elERPEscPos;

  function defaultConfig() {
    return {
      printerId: "generic_escpos",
      connection: "browser",
      paperMm: 80,
      baudRate: 9600,
      bridgeUrl: "http://127.0.0.1:9100/print",
      fiscalBridgeUrl: "http://127.0.0.1:3434/fiscal",
      openDrawer: false,
      autoPrint: true,
    };
  }

  function loadConfig() {
    try {
      return { ...defaultConfig(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {}) };
    } catch {
      return defaultConfig();
    }
  }

  function saveConfig(cfg) {
    const next = { ...defaultConfig(), ...cfg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state.config = next;
    return next;
  }

  const state = {
    config: loadConfig(),
    port: null,
    writer: null,
    connected: false,
    lastError: null,
  };

  function capabilities() {
    return {
      serial: "serial" in navigator,
      bluetooth: "bluetooth" in navigator,
      browser: true,
      network: true,
      fiscal_bridge: true,
    };
  }

  function selectedPrinter() {
    return catalog()?.find(state.config.printerId) || catalog()?.find("generic_escpos");
  }

  async function connectSerial() {
    if (!("serial" in navigator)) throw new Error("SERIAL_UNSUPPORTED");
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: Number(state.config.baudRate) || 9600 });
    state.port = port;
    state.writer = port.writable.getWriter();
    state.connected = true;
    return true;
  }

  async function disconnectSerial() {
    try {
      if (state.writer) {
        try {
          state.writer.releaseLock();
        } catch {
          /* ignore */
        }
      }
      if (state.port) await state.port.close();
    } finally {
      state.writer = null;
      state.port = null;
      state.connected = false;
    }
  }

  async function writeSerial(uint8) {
    if (!state.writer) {
      await connectSerial();
    }
    await state.writer.write(uint8);
  }

  async function writeBluetooth(uint8) {
    if (!("bluetooth" in navigator)) throw new Error("BT_UNSUPPORTED");
    // Perfil serial BLE genérico — muitos módulos CH340/Bluetooth SPP não aparecem no Web Bluetooth.
    // Tentamos UART Nordic (comum em módulos) e fallback erro orientativo.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb", "6e400001-b5a3-f393-e0a9-e50e24dcca9e"],
    });
    const server = await device.gatt.connect();
    let characteristic = null;
    for (const svc of ["6e400001-b5a3-f393-e0a9-e50e24dcca9e", "0000ffe0-0000-1000-8000-00805f9b34fb"]) {
      try {
        const service = await server.getPrimaryService(svc);
        const chars = await service.getCharacteristics();
        characteristic = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) || chars[0];
        if (characteristic) break;
      } catch {
        /* try next */
      }
    }
    if (!characteristic) throw new Error("BT_NO_UART");
    const chunk = 100;
    for (let i = 0; i < uint8.length; i += chunk) {
      await characteristic.writeValue(uint8.slice(i, i + chunk));
    }
  }

  async function writeNetwork(uint8, meta = {}) {
    const url = state.config.bridgeUrl || defaultConfig().bridgeUrl;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-elERP-Job": meta.job || "raw" },
      body: uint8,
    });
    if (!res.ok) throw new Error(`BRIDGE_HTTP_${res.status}`);
  }

  async function writeFiscalBridge(payload) {
    const url = state.config.fiscalBridgeUrl || defaultConfig().fiscalBridgeUrl;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `FISCAL_BRIDGE_HTTP_${res.status}`);
    }
    return res.json().catch(() => ({}));
  }

  function printBrowser(opts) {
    if (window.elERPReceipt?.printViaBrowser) {
      window.elERPReceipt.printViaBrowser(opts);
      return;
    }
    throw new Error("BROWSER_PRINT_MISSING");
  }

  function buildEscPosBytes(opts) {
    const paperMm = Number(opts.paperMm || state.config.paperMm) || 80;
    return escpos().buildNonFiscalReceipt({
      settings: opts.settings,
      sale: opts.sale,
      change: opts.change || 0,
      paperMm,
      openDrawer: Boolean(opts.openDrawer ?? state.config.openDrawer),
    });
  }

  async function sendRaw(uint8, connection = state.config.connection) {
    if (connection === "serial") return writeSerial(uint8);
    if (connection === "bluetooth") return writeBluetooth(uint8);
    if (connection === "network") return writeNetwork(uint8, { job: "escpos" });
    throw new Error("CONN_UNSUPPORTED");
  }

  /**
   * Impressão principal do cupom de venda.
   * Fiscal ECF/SAT: envia job JSON ao bridge local (ACBr/Monitor/DLL wrapper).
   */
  async function printSaleReceipt(opts = {}) {
    const printer = selectedPrinter();
    const connection = state.config.connection;
    const kind = printer?.kind || "nonfiscal";

    try {
      if (connection === "browser" || printer?.protocol === "browser") {
        printBrowser(opts);
        return { ok: true, via: "browser" };
      }

      if (kind === "fiscal_ecf") {
        await writeFiscalBridge({
          type: "ecf_print_nonfiscal_or_sale",
          printerId: printer.id,
          brand: printer.brand,
          model: printer.model,
          sale: opts.sale,
          settings: opts.settings,
          change: opts.change || 0,
          note: "ECF legado: o bridge deve mapear para a DLL do fabricante (BemaFI32, DarumaFramework, etc.).",
        });
        return { ok: true, via: "fiscal_bridge", kind };
      }

      if (kind === "sat") {
        await writeFiscalBridge({
          type: "sat_print_extract",
          printerId: printer.id,
          brand: printer.brand,
          model: printer.model,
          sale: opts.sale,
          settings: opts.settings,
          change: opts.change || 0,
          note: "SAT/MFe: bridge deve emitir/consultar CFe e imprimir extrato.",
        });
        // também tenta extrato térmico local se conexão serial/network
        if (connection === "serial" || connection === "network" || connection === "bluetooth") {
          const bytes = buildEscPosBytes({
            ...opts,
            sale: {
              ...opts.sale,
              // marca no cupom
            },
          });
          try {
            await sendRaw(bytes, connection);
          } catch {
            /* bridge já é a fonte da verdade fiscal */
          }
        }
        return { ok: true, via: "fiscal_bridge", kind };
      }

      // nonfiscal + nfce_printer via ESC/POS
      const bytes = buildEscPosBytes(opts);
      await sendRaw(bytes, connection);
      return { ok: true, via: connection, kind };
    } catch (err) {
      state.lastError = err;
      // fallback navegador para não perder a venda
      if (connection !== "browser") {
        try {
          printBrowser(opts);
          return { ok: true, via: "browser_fallback", error: String(err?.message || err) };
        } catch {
          /* ignore */
        }
      }
      throw err;
    }
  }

  async function printTest() {
    const printer = selectedPrinter();
    const connection = state.config.connection;
    if (connection === "browser") {
      printBrowser({
        settings: { tradeName: "elERP", receiptMessage: "Teste de impressão" },
        sale: {
          soldAt: new Date().toISOString(),
          total: 1.99,
          items: [{ name: "Item teste", qty: 1, unit: "un", lineTotal: 1.99 }],
          payments: [{ method: "dinheiro", amount: 1.99 }],
        },
        change: 0,
      });
      return { ok: true, via: "browser" };
    }
    if (printer?.kind === "fiscal_ecf" || printer?.kind === "sat" || connection === "fiscal_bridge") {
      await writeFiscalBridge({
        type: "test",
        printerId: printer?.id,
        brand: printer?.brand,
        model: printer?.model,
      });
      return { ok: true, via: "fiscal_bridge" };
    }
    const bytes = escpos().buildTestPage({
      paperMm: state.config.paperMm,
      modelLabel: `${printer?.brand || ""} ${printer?.model || ""}`.trim(),
    });
    await sendRaw(bytes, connection);
    return { ok: true, via: connection };
  }

  function status() {
    const printer = selectedPrinter();
    return {
      config: { ...state.config },
      printer,
      connected: state.connected,
      capabilities: capabilities(),
      lastError: state.lastError ? String(state.lastError.message || state.lastError) : null,
    };
  }

  window.elERPPrint = {
    getConfig: () => ({ ...state.config }),
    setConfig: saveConfig,
    status,
    capabilities,
    connectSerial,
    disconnectSerial,
    printSaleReceipt,
    printTest,
    selectedPrinter,
  };
})();
