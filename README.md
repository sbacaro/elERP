# elERP

PDV para açaí/sorvete — venda por **gramas**, preço do sabor por **kg**, GitHub Pages + Supabase.

**Idioma:** português do Brasil (pt-BR).

## Site

https://sbacaro.github.io/elERP/

## Setup do Supabase (obrigatório uma vez)

Projeto: `https://jdkggegrreixywoyhkmb.supabase.co`

### 1. Tabelas (fonte da verdade)

1. Abra o [SQL Editor](https://supabase.com/dashboard/project/jdkggegrreixywoyhkmb/sql/new)
2. Rode **`supabase/full_schema.sql`** — produtos, caixa, vendas, estoque, compras + RLS + Realtime
3. Rode **`supabase/catalog_bebidas_br.sql`** — catálogo de ~420 bebidas BR (`product_catalog`)

Após isso, o app lê e grava só no Supabase. Alterações no Dashboard refletem no site (Realtime), e o que você cadastra no site aparece nas tabelas.

> `supabase/schema.sql` é legado (`app_state` jsonb). Use só se precisar migrar dados antigos; o app novo usa as tabelas normalizadas.

### 2. URLs de autenticação

Em **Authentication → URL Configuration**:

- **Site URL:** `https://sbacaro.github.io/elERP/`
- **Redirect URLs:** `https://sbacaro.github.io/elERP/**`

### 3. Confirmar e-mail

Em **Authentication → Providers → Email**, desative **Confirm email** para entrar logo após criar a conta.

## Dados da loja

| Tabela | Conteúdo |
|--------|----------|
| `store_products` | Produtos da loja (sem seed hardcoded no app) |
| `cash_sessions` | Abertura/fechamento de caixa |
| `sales` / `sale_items` / `sale_payments` | Vendas |
| `stock_movements` | Movimentos de estoque |
| `purchase_orders` / `purchase_order_items` | Pedidos de compra |
| `store_suppliers` | Fornecedores |
| `product_catalog` | Catálogo de barras para importar |

Carrinho do PDV fica só no navegador (localStorage) até confirmar a venda.

## Catálogo de códigos (Open Food Facts)

Fonte: [Open Food Facts](https://world.openfoodfacts.org/data) (Brasil) + códigos curados.

- Preferência: tabela `product_catalog` no Supabase
- Fallback: `data/catalog-bebidas-br.json` no Pages

No app: aba **Catálogo** → buscar → **Importar**. No caixa: código de barras + Enter.

## Fluxo de peso

- Quantidade: **gramas**
- Preço do sabor: **R$ / kg**
- Balança USB: converte kg → g

## Licença

MIT — dados do Open Food Facts sob ODbL.
