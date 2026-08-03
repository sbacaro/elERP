# elERP

PDV para açaí/sorvete — venda por **gramas**, preço do sabor por **kg**, GitHub Pages + Supabase.

**Idioma:** português do Brasil (pt-BR).

## Site

https://sbacaro.github.io/elERP/

## Setup do Supabase (obrigatório uma vez)

Projeto: `https://jdkggegrreixywoyhkmb.supabase.co`

### 1. Tabelas

1. Abra o [SQL Editor](https://supabase.com/dashboard/project/jdkggegrreixywoyhkmb/sql/new)
2. Rode `supabase/schema.sql` (estado do PDV por usuário)
3. Rode `supabase/catalog_bebidas_br.sql` (~420 bebidas BR com código de barras)

### 2. URLs de autenticação

Em **Authentication → URL Configuration**:

- **Site URL:** `https://sbacaro.github.io/elERP/`
- **Redirect URLs:** `https://sbacaro.github.io/elERP/**`

### 3. Confirmar e-mail

Em **Authentication → Providers → Email**, desative **Confirm email** para entrar logo após criar a conta.

## Catálogo de códigos (Open Food Facts)

Fonte: [Open Food Facts](https://world.openfoodfacts.org/data) (Brasil: águas, refrigerantes, sucos, chás, energéticos) + códigos curados.

- Pages/JSON: `data/catalog-bebidas-br.json`
- Supabase: tabela `product_catalog` (se o SQL foi rodado; senão o site usa o JSON)

No app: aba **Catálogo** → buscar → **Importar**. No caixa: campo de código de barras + Enter.

## Fluxo de peso

- Quantidade: **gramas**
- Preço do sabor: **R$ / kg**
- Balança USB: converte kg → g

## Licença

MIT — dados do Open Food Facts sob ODbL.
