# Skill: Reminisce Context

## When to use
Load this skill when working on any part of the Reminisce platform build.

## Context
This project follows the architecture in reminisce-docs/reminisce-architecture.md.
The build phases are in reminisce-docs/reminisce-build-prompt.md.
Always check these files before implementing any feature.

## Key patterns
- API routes live in app/api/
- FSAPI helpers live in lib/fsapi.ts
- Context compilation lives in lib/context-compiler.ts
- OpenRouter client lives in lib/openrouter.ts
- All Supabase server calls use service role key
- All Supabase client calls use anon key with RLS
