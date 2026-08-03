# elERP

PDV leve para comércio de sorvete por quilo — MVP estático no GitHub Pages.

## O que já funciona

- **Caixa**: abrir / fechar turno com conferencia de dinheiro
- **Venda**: sabores por **kg** (peso decimal) + itens por unidade
- **Estoque**: baixa na venda, alerta de mínimo
- **Compras**: pedido + recebimento (entra estoque)
- **Relatório do dia**: totais por forma de pagamento e kg por sabor

Dados ficam no **localStorage** deste navegador (protótipo). Depois definimos backend (Supabase, VPS, Cloudflare, etc.).

## Publicar (GitHub Pages)

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder `/` (root)
4. Site: `https://sbacaro.github.io/elERP/`

Ou via CLI (já configurável após o primeiro push):

```bash
gh api repos/sbacaro/elERP/pages -X POST -f build_type=legacy -f source='{"branch":"main","path":"/"}'
```

## Uso local

Abra `index.html` no navegador, ou:

```bash
npx serve .
```

## Licença

MIT
