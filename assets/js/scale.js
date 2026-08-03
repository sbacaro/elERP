(function () {
  const STORAGE_KEY = "elERP.scale.v1";
  const { list, get, parseWeightBarcode, baudRates } = window.elERPScaleProtocols;

  function defaultConfig() {
    return {
      protocolId: "auto",
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      pollMs: 400,
      autoUseStable: true,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  const scale = {
    config: loadConfig(),
    port: null,
    reader: null,
    writer: null,
    keepReading: false,
    pollTimer: null,
    buffer: "",
    last: null,
    listeners: new Set(),
    barcodeBuffer: "",
    barcodeTimer: null,
    barcodeArmed: false,

    isSupported() {
      return typeof navigator !== "undefined" && !!navigator.serial;
    },

    protocols() {
      return list;
    },

    baudRates() {
      return baudRates;
    },

    getConfig() {
      return { ...this.config };
    },

    setConfig(partial) {
      this.config = { ...this.config, ...partial };
      saveConfig(this.config);
      this.emit({ type: "config", config: this.getConfig() });
    },

    on(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },

    emit(event) {
      for (const fn of this.listeners) {
        try {
          fn(event);
        } catch (err) {
          console.error(err);
        }
      }
    },

    status() {
      return {
        supported: this.isSupported(),
        connected: !!this.port,
        last: this.last,
        config: this.getConfig(),
      };
    },

    async connect() {
      if (!this.isSupported()) {
        throw new Error("UNSUPPORTED");
      }
      if (this.port) return this.status();

      const port = await navigator.serial.requestPort();
      const baudRate = Number(this.config.baudRate) || 9600;
      await port.open({
        baudRate,
        dataBits: Number(this.config.dataBits) || 8,
        stopBits: Number(this.config.stopBits) || 1,
        parity: this.config.parity || "none",
      });

      this.port = port;
      this.keepReading = true;
      this.buffer = "";
      this.startReading();
      this.startPolling();
      this.emit({ type: "connected", status: this.status() });
      return this.status();
    },

    async disconnect() {
      this.keepReading = false;
      this.stopPolling();
      try {
        await this.reader?.cancel();
      } catch {
        /* ignore */
      }
      try {
        this.reader?.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        this.writer?.releaseLock();
      } catch {
        /* ignore */
      }
      try {
        await this.port?.close();
      } catch {
        /* ignore */
      }
      this.reader = null;
      this.writer = null;
      this.port = null;
      this.emit({ type: "disconnected" });
    },

    startPolling() {
      this.stopPolling();
      const proto = get(this.config.protocolId);
      if (!proto.pollCommand || !this.port) return;
      this.pollTimer = setInterval(() => {
        this.send(proto.pollCommand);
      }, Math.max(200, Number(this.config.pollMs) || 400));
    },

    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    },

    async send(bytes) {
      if (!this.port) return;
      try {
        const writer = this.port.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
      } catch (err) {
        this.emit({ type: "error", error: err });
      }
    },

    async startReading() {
      const decoder = new TextDecoder();
      while (this.port && this.keepReading && this.port.readable) {
        this.reader = this.port.readable.getReader();
        try {
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (!value) continue;
            const text = decoder.decode(value, { stream: true });
            this.ingest(text);
          }
        } catch (err) {
          if (this.keepReading) this.emit({ type: "error", error: err });
        } finally {
          try {
            this.reader.releaseLock();
          } catch {
            /* ignore */
          }
          this.reader = null;
        }
      }
    },

    ingest(text) {
      this.buffer += text;
      // processa por linhas e também janela recente
      const parts = this.buffer.split(/\r\n|\n|\r/);
      this.buffer = parts.pop() || "";
      for (const line of parts) {
        if (line.trim()) this.handleChunk(line.trim());
      }
      // chunk contínuo sem newline
      if (this.buffer.length > 8) {
        this.handleChunk(this.buffer);
        if (this.buffer.length > 200) this.buffer = this.buffer.slice(-80);
      }
    },

    handleChunk(chunk) {
      const proto = get(this.config.protocolId);
      const parsed = proto.parse(chunk);
      if (!parsed?.kg) return;
      this.last = {
        kg: parsed.kg,
        stable: !!parsed.stable,
        raw: parsed.raw || chunk,
        protocol: parsed.protocol || proto.id,
        at: Date.now(),
        source: "serial",
      };
      this.emit({ type: "weight", reading: this.last });
    },

    /** Ativa captura de código de barras (teclado USB) enquanto o diálogo de peso está aberto. */
    armBarcodeCapture(enabled) {
      this.barcodeArmed = enabled;
      this.barcodeBuffer = "";
      if (!enabled && this.barcodeTimer) {
        clearTimeout(this.barcodeTimer);
        this.barcodeTimer = null;
      }
    },

    onKeydown(e) {
      if (!this.barcodeArmed) return;
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        // ainda assim leitores HID digitarão no input focado — processamos Enter
      }
      if (e.key === "Enter") {
        const code = this.barcodeBuffer;
        this.barcodeBuffer = "";
        const parsed = parseWeightBarcode(code);
        if (parsed) {
          e.preventDefault();
          this.last = { ...parsed, at: Date.now() };
          this.emit({ type: "weight", reading: this.last });
        }
        return;
      }
      if (e.key.length === 1) {
        this.barcodeBuffer += e.key;
        clearTimeout(this.barcodeTimer);
        this.barcodeTimer = setTimeout(() => {
          this.barcodeBuffer = "";
        }, 120);
      }
    },
  };

  window.addEventListener("keydown", (e) => scale.onKeydown(e), true);
  window.elERPScale = scale;
})();
