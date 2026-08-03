# elERP

PDV leve para comércio de sorvete por quilo — MVP estático no GitHub Pages.

**Idioma da interface: português do Brasil (pt-BR).** Datas e valores monetários usam o padrão brasileiro (R$, vírgula decimal).

## O que já funciona

- **Caixa**: abrir / fechar turno com conferência de dinheiro
- **Venda**: sabores por **kg** (peso decimal) + itens por unidade
- **Estoque**: baixa na venda, alerta de mínimo
- **Compras**: pedido + recebimento (entra estoque)
- **Relatório do dia**: totais por forma de pagamento e kg por sabor

Os textos da interface ficam centralizados em `assets/js/i18n.js`. Os dados ficam no armazenamento local deste navegador (protótipo). Depois definimos o backend (Supabase, VPS, Cloudflare, etc.).

## Publicar (GitHub Pages)

1. Repositório → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / pasta `/` (root)
4. Site: `https://sbacaro.github.io/elERP/`

## Uso local

Abra `index.html` no navegador, ou:

```bash
npx serve .
```

## Licença

MIT
