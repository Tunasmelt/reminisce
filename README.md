# Reminisce v2

AI Context Orchestration Platform

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + Database)
- TypeScript
- Tailwind CSS

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in all environment variables
4. `npm install`
5. `npm run dev`

## Environment Variables

See `.env.example` for all required vars.

Supabase setup:
- Enable Email auth in Supabase dashboard
- Add your deployment URL to 
  Supabase → Auth → URL Configuration:
  Site URL: https://your-app.vercel.app
  Redirect URLs: https://your-app.vercel.app/**

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add all env vars from .env.example
4. Deploy

## Theme System

5 themes: Solar Flare, Elite Purple, 
Midnight Cyan, Emerald Circuit, Monochrome.
First-visit onboarding picker.
Persisted in localStorage.
