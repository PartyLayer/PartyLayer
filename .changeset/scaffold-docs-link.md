---
"create-partylayer-app": patch
---

Point the scaffolded templates' docs link at `/docs` instead of `/docs/introduction`.

The site now serves the introduction at `partylayer.xyz/docs` and 301s the old
`/docs/introduction` URL to it, so the link in every scaffolded README would
otherwise send a new user through a redirect on their first click. All four
templates (react-vite, next-ssr, vanilla, vue-nuxt-pinia) are updated.
