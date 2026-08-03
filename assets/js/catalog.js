(function () {
  const GROUP_LABELS = {
    agua: "Água",
    refrigerante: "Refrigerante",
    suco: "Suco",
    energetico: "Energético",
    cha: "Chá",
    bebida: "Bebida",
  };

  const catalog = {
    items: [],
    loaded: false,
    source: null,

    groupLabel(group) {
      return GROUP_LABELS[group] || group || "Bebida";
    },

    async load() {
      // 1) tenta Supabase
      const sb = window.elERPSb;
      if (sb) {
        try {
          const { data, error } = await sb
            .from("product_catalog")
            .select(
              "barcode,sku,name,brand,product_group,quantity,unit,suggested_price,suggested_cost,source,image_url"
            )
            .limit(5000);
          if (!error && data?.length) {
            this.items = data.map((r) => ({
              barcode: r.barcode,
              sku: r.sku || r.barcode,
              name: r.name,
              brand: r.brand || "",
              group: r.product_group || "bebida",
              quantity: r.quantity || "",
              unit: r.unit || "un",
              suggested_price: Number(r.suggested_price) || 0,
              suggested_cost: Number(r.suggested_cost) || 0,
              source: r.source || "supabase",
              image_url: r.image_url || null,
            }));
            this.loaded = true;
            this.source = "supabase";
            return this.items;
          }
        } catch {
          /* fallback */
        }
      }

      // 2) JSON estático no Pages
      const res = await fetch("./data/catalog-bebidas-br.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("CATALOG_FETCH");
      const json = await res.json();
      this.items = (json.products || []).map((p) => ({
        ...p,
        group: p.group || "bebida",
      }));
      this.loaded = true;
      this.source = "json";
      return this.items;
    },

    search({ q = "", group = "", limit = 80 } = {}) {
      const query = String(q || "").trim().toLowerCase();
      const digits = query.replace(/\D/g, "");
      let list = this.items;
      if (group) list = list.filter((p) => p.group === group);
      if (query) {
        list = list.filter((p) => {
          if (digits.length >= 6 && String(p.barcode).includes(digits)) return true;
          const hay = `${p.name} ${p.brand} ${p.sku} ${p.quantity}`.toLowerCase();
          return hay.includes(query);
        });
      }
      return list.slice(0, limit);
    },

    findByBarcode(code) {
      const digits = String(code || "").replace(/\D/g, "");
      if (!digits) return null;
      return this.items.find((p) => p.barcode === digits) || null;
    },
  };

  window.elERPCatalog = catalog;
})();
