# elERP

PDV para açaí/sorvete — venda por **gramas**, preço do sabor por **kg**, GitHub Pages + Supabase.

**Idioma:** português do Brasil (pt-BR).

## Site

https://sbacaro.github.io/elERP/

## Setup do Supabase (obrigatório uma vez)

Projeto: `https://jdkggegrreixywoyhkmb.supabase.co`

### 1. Criar a tabela

1. Abra o [SQL Editor](https://supabase.com/dashboard/project/jdkggegrreixywoyhkmb/sql/new)
2. Cole o conteúdo de `supabase/schema.sql`
3. Clique em **Run**

### 2. URLs de autenticação

Em **Authentication → URL Configuration**:

- **Site URL:** `https://sbacaro.github.io/elERP/`
- **Redirect URLs:** `https://sbacaro.github.io/elERP/**`

### 3. (Recomendado) confirmar e-mail

Em **Authentication → Providers → Email**, desative **Confirm email** para entrar logo após criar a conta.

## Fluxo de peso

- Quantidade vendida/estoque: **gramas** (ex.: 385 g)
- Preço do sabor: **R$ / kg** (total = gramas ÷ 1000 × preço/kg)
- Balança USB: conversão automática kg → g

## Balança

Chrome/Edge no PC → aba **Balança** → Conectar USB → na venda o peso entra em gramas.

## Licença

MIT
