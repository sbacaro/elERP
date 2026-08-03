(function () {
  /**
   * Catálogo de impressoras usadas no PDV brasileiro.
   * kind: nonfiscal | fiscal_ecf | sat | nfce_printer
   * protocol: escpos | text | fiscal_dll_bridge | sat_bridge | browser
   */
  const PRINTERS = [
    // ---- Não fiscais (térmicas ESC/POS) ----
    { id: "generic_escpos", brand: "Genérica", model: "ESC/POS 58/80mm", kind: "nonfiscal", protocol: "escpos", paper: [58, 80], connections: ["serial", "network", "bluetooth", "browser"] },
    { id: "epson_tm_t20", brand: "Epson", model: "TM-T20 / T20X", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "epson_tm_t88", brand: "Epson", model: "TM-T88V / T88VI", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "epson_tm_m30", brand: "Epson", model: "TM-m30", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "bluetooth", "browser"] },
    { id: "bematech_mp4200", brand: "Bematech", model: "MP-4200 TH", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "bematech_mp2800", brand: "Bematech", model: "MP-2800 TH", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "bematech_mp100s", brand: "Bematech", model: "MP-100S TH", kind: "nonfiscal", protocol: "escpos", paper: [58], connections: ["serial", "bluetooth", "browser"] },
    { id: "elgin_i9", brand: "Elgin", model: "i9", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "elgin_i7", brand: "Elgin", model: "i7 / i7 Plus", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "elgin_i8", brand: "Elgin", model: "i8", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "elgin_nx80", brand: "Elgin", model: "NX80 / Fit", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "bluetooth", "browser"] },
    { id: "daruma_dr800", brand: "Daruma", model: "DR800", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "daruma_ds348", brand: "Daruma", model: "DS348", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "sweda_si300", brand: "Sweda", model: "SI-300", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "tanca_tp650", brand: "Tanca", model: "TP-650", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "tanca_tp550", brand: "Tanca", model: "TP-550", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "diebold_im453", brand: "Diebold", model: "IM453", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "controlid_printid", brand: "Control iD", model: "Print iD", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "gertec_g250", brand: "Gertec", model: "G250 / G250E", kind: "nonfiscal", protocol: "escpos", paper: [58, 80], connections: ["serial", "bluetooth", "browser"] },
    { id: "datecs_dpp250", brand: "Datecs", model: "DPP-250 / DPP-350", kind: "nonfiscal", protocol: "escpos", paper: [58], connections: ["bluetooth", "serial", "browser"] },
    { id: "citizendp", brand: "Citizen", model: "CT-S310II / CTS", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "bixolon_srp350", brand: "Bixolon", model: "SRP-350 / SRP-330", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "posiflex_pp8800", brand: "Posiflex", model: "PP8800 / PP6900", kind: "nonfiscal", protocol: "escpos", paper: [80], connections: ["serial", "network", "browser"] },
    { id: "argox_os214", brand: "Argox", model: "OS-214 / etiqueta", kind: "nonfiscal", protocol: "escpos", paper: [58, 80], connections: ["serial", "network", "browser"] },
    { id: "zebra_zd220", brand: "Zebra", model: "ZD220 / GC420 (etiqueta)", kind: "nonfiscal", protocol: "escpos", paper: [58, 80], connections: ["serial", "network", "browser"] },

    // ---- Fiscais ECF (legado — via bridge local / monitor) ----
    { id: "bematech_mp4000_th_fi", brand: "Bematech", model: "MP-4000 TH FI (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "bematech_mp4200_fi", brand: "Bematech", model: "MP-4200 FI (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "daruma_fs600", brand: "Daruma", model: "FS600 (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "daruma_fs700", brand: "Daruma", model: "FS700 (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "elgin_3000", brand: "Elgin", model: "Elgin 3000 / X5 (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "sweda_st100", brand: "Sweda", model: "ST100 / IF ST100 (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "sweda_st200", brand: "Sweda", model: "ST200 (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "epson_tm_t81_fi", brand: "Epson", model: "TM-T81 FI (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "urano", brand: "Urano", model: "URANO FIT / ZM (ECF)", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "ncr", brand: "NCR", model: "NCR 7197 / ECF", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },
    { id: "ibm_sureone", brand: "IBM/Toshiba", model: "SureOne / ECF", kind: "fiscal_ecf", protocol: "fiscal_dll_bridge", paper: [80], connections: ["fiscal_bridge"] },

    // ---- SAT / MFe (impressão do extrato CFe) ----
    { id: "sat_generic", brand: "SAT/MFe", model: "Extrato CFe (qualquer térmica)", kind: "sat", protocol: "sat_bridge", paper: [58, 80], connections: ["fiscal_bridge", "serial", "network", "browser"] },
    { id: "sat_dimep", brand: "Dimep", model: "D-SAT 2.0", kind: "sat", protocol: "sat_bridge", paper: [80], connections: ["fiscal_bridge", "browser"] },
    { id: "sat_elgin", brand: "Elgin", model: "Smart SAT / Linker", kind: "sat", protocol: "sat_bridge", paper: [80], connections: ["fiscal_bridge", "browser"] },
    { id: "sat_tanca", brand: "Tanca", model: "TS-1000 / TS-2000", kind: "sat", protocol: "sat_bridge", paper: [80], connections: ["fiscal_bridge", "browser"] },
    { id: "sat_gertec", brand: "Gertec", model: "Gertec SAT", kind: "sat", protocol: "sat_bridge", paper: [80], connections: ["fiscal_bridge", "browser"] },
    { id: "mfe_ce", brand: "MFe (CE)", model: "Módulo Fiscal Eletrônico", kind: "sat", protocol: "sat_bridge", paper: [80], connections: ["fiscal_bridge", "browser"] },

    // ---- NFC-e (DANFE simplificado / contingência) ----
    { id: "nfce_browser", brand: "NFC-e", model: "DANFE simplificado (navegador)", kind: "nfce_printer", protocol: "browser", paper: [80], connections: ["browser"] },
    { id: "nfce_escpos", brand: "NFC-e", model: "DANFE térmico ESC/POS", kind: "nfce_printer", protocol: "escpos", paper: [58, 80], connections: ["serial", "network", "browser"] },
  ];

  const CONNECTIONS = [
    { id: "browser", label: "Navegador (dialog de impressão)" },
    { id: "serial", label: "USB / Serial (Web Serial)" },
    { id: "bluetooth", label: "Bluetooth (Web Bluetooth)" },
    { id: "network", label: "Rede via bridge local (TCP 9100)" },
    { id: "fiscal_bridge", label: "Bridge fiscal local (ACBr/Monitor/DLL)" },
  ];

  const KIND_LABELS = {
    nonfiscal: "Não fiscal",
    fiscal_ecf: "Fiscal ECF (legado)",
    sat: "SAT / MFe",
    nfce_printer: "NFC-e",
  };

  window.elERPPrinterCatalog = {
    printers: PRINTERS,
    connections: CONNECTIONS,
    kindLabel: (k) => KIND_LABELS[k] || k,
    find: (id) => PRINTERS.find((p) => p.id === id) || null,
    byKind: (kind) => PRINTERS.filter((p) => p.kind === kind),
    brands: () => [...new Set(PRINTERS.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
})();
