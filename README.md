# Animamagisterium

Dark fantasy RPG character creation MVP built with Expo React Native Web, Supabase, Vercel, and OpenAI image generation.

## Local Setup

Create a `.env.local` file in the project root:

```txt
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_IMAGE_MODEL=gpt-image-1
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are safe for frontend use. `OPENAI_API_KEY` is server-only and must never be exposed to browser code.

The Expo web build reads `.env.local` during `npm run build` and writes only the public Supabase values into `src/lib/runtimeEnv.generated.ts`.

## Commands

```sh
npm install
npm run typecheck
npm run build
npm run web
```

## Supabase

Migrations live in `supabase/migrations`. The MVP uses:

- Supabase Auth for user login
- `user-selfies` storage bucket for original uploads
- `character-portraits` storage bucket for AI-generated portraits
- RLS-protected character/profile/attribute/appearance records

### Supabase CLI migrations

The project includes Supabase CLI config in `supabase/config.toml`.

First-time setup on a machine:

```sh
npm install
npm run supabase:login
npm run supabase:link
```

When a new migration is added and you want to apply it to the linked Supabase project:

```sh
npm run supabase:migrations
npm run supabase:push
```

`npm run supabase:link` is already pointed at project ref `xasccgfbwluyommimqis`. Supabase may ask for the database password when linking or pushing.

## Vercel

Vercel must define:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
OPENAI_IMAGE_MODEL
```

The OpenAI key is only used by the serverless route at `api/generate-avatar.js`.
