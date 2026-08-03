# elERP

PDV para açaí/sorvete — venda por **gramas/kg**, preço do sabor por **kg**, GitHub Pages + Supabase.

**Idioma:** português do Brasil (pt-BR).  
**Fonte única:** Atkinson Hyperlegible (texto e números).

## Site

https://sbacaro.github.io/elERP/

## Setup do Supabase (obrigatório)

Projeto: `https://jdkggegrreixywoyhkmb.supabase.co`

1. Abra o [SQL Editor](https://supabase.com/dashboard/project/jdkggegrreixywoyhkmb/sql/new)
2. Rode **`supabase/full_schema.sql`** — produtos, caixa, vendas, estoque, compras + RLS + Realtime
3. Rode **`supabase/extend_complete.sql`** — loja, equipe, complementos, troco
4. Rode **`supabase/catalog_bebidas_br.sql`** — catálogo de bebidas (`product_catalog`)

Se a loja já existia sem `kg`, rode também `supabase/alter_unit_kg.sql`.

### Auth

Em **Authentication → URL Configuration**:

- **Site URL:** `https://sbacaro.github.io/elERP/`
- **Redirect URLs:** `https://sbacaro.github.io/elERP/**`

Em **Authentication → Providers → Email**, desative **Confirm email** se quiser entrar logo após criar a conta.

## Áreas do app

| Área | Telas |
|------|--------|
| **Operação** | Caixa (PDV), Dia / Relatórios |
| **Gestão** | Produtos (+ complementos), Inventário, Compras, Fornecedores, Catálogo, Balança, Loja*, Equipe* |

\* Loja e Equipe só para o papel **owner**. Cashier vê só Operação.

## O que já está no PDV

- Venda g / kg / un, complementos, pagamentos múltiplos (dinheiro/Pix/cartão) com **troco**
- Cupom **não fiscal** imprimível (dados da loja)
- Caixa abrir/fechar, cancelamento de venda no turno
- Estoque, inventário (ajuste), compras multi-item, fornecedores
- Relatórios por período + export CSV
- Balança USB (Web Serial), catálogo de bebidas
- Offline leve: fila IndexedDB + Service Worker (assets)
- Realtime Supabase

## Fiscal (scaffold)

Cadastro de CNPJ/IE/CSC e modo `nao_fiscal` | `nfce_futuro`.  
Vendas gravam `fiscal_status` = `nao_fiscal` ou `pendente_nfce`.  
**Não há emissão NFC-e real neste ciclo** (precisa provedor + certificado A1).

## Fora do escopo atual

- NFC-e/SAT real, TEF/pinpad, multi-loja, delivery/CRM

## Checklist rápido após o SQL

1. Hard refresh no site
2. Criar/entrar na conta
3. Gestão → Loja: preencher nome/CNPJ
4. Gestão → Produtos: cadastrar sabor + complementos
5. Operação → Abrir caixa → vender com Pix+dinheiro e troco → imprimir cupom
6. Dia / Relatórios → exportar CSV

## Licença

MIT — dados do Open Food Facts sob ODbL.
