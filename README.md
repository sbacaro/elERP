# elERP

PDV para comércio de sorvete por quilo — GitHub Pages + Supabase (login e dados na nuvem).

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

### 3. (Recomendado para começar) confirmar e-mail

Em **Authentication → Providers → Email**, desative **Confirm email** se quiser entrar logo após “Criar conta”.

### 4. Usar o app

1. Abra o site
2. **Criar conta** (e-mail + senha)
3. **Entrar** e usar o PDV

## O que já funciona

- Login / criar conta / sair
- Caixa (abrir / fechar)
- Venda por **kg** + itens por unidade
- Estoque, compras, relatório do dia
- Sync dos dados por usuário no Supabase (`app_state`)

## Desenvolvimento local

```bash
npx serve .
```

Configuração em `assets/js/config.js` (URL + chave publishable).

## Balança (USB)

No PC do caixa (Chrome/Edge):

1. Aba **Balança** → escolha protocolo (comece em **Automático**) e baud (muitas usam **9600**)
2. **Conectar balança (USB)** e autorize a porta
3. Na venda por kg, o peso aparece ao vivo; use **Usar peso da balança**

Também lê **código de barras de peso** (etiqueta) no diálogo de peso.

**Limite:** não cobre 100% das balanças (USB proprietário/HID puro pode falhar). A maioria com USB–serial funciona.

## Licença

MIT
