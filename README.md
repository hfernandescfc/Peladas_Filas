# Gestor de Pelada (MVP)

Aplicacao web simples para gerenciar confirmacoes e fila de espera de peladas, com prioridade para mensalistas.

## Requisitos locais

- Node.js 18+ (necessario para rodar o Vite)
- Conta no Supabase (plano gratuito)

## Configuracao Supabase

1. Crie um projeto no Supabase.
2. Em **Authentication > Providers**, habilite Magic Link (Email) e/ou Google OAuth.
3. Configure o **Site URL** para o dominio do deploy (ou `http://localhost:5173`).
4. Execute o SQL em `supabase/schema.sql` no SQL Editor.
5. Copie `Project URL` e `anon public key`.

## Variaveis de ambiente

Crie um arquivo `.env.local` na raiz com:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Rodar localmente

```
npm install
npm run dev
```

## Deploy (Vercel ou Netlify)

1. Suba este repositorio no GitHub.
2. Conecte na Vercel/Netlify e aponte para este repo.
3. Defina as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Configure o build:
   - Build command: `npm run build`
   - Output: `dist`

## Fluxo basico

- Admin cria uma pelada e vira mensalista por padrao.
- Usuarios entram informando o ID da pelada.
- Admin cria evento com status aberto.
- Usuarios confirmam presenca e entram na fila automaticamente.

## Observacoes

- A logica central fica em `supabase/schema.sql` (funcao `confirm_presence`).
- Promocao automatica da fila ocorre quando alguem sai (`status = 'fora'`).
