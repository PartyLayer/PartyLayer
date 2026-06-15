import { createPartyLayer } from '@partylayer/sdk';
import { createPartyLayerSession } from '@partylayer/vue';
import { createCookieStorage } from '@partylayer/session';

/**
 * Client-only plugin: create the PartyLayer client and provide the session store
 * app-wide. cookieStorage on the client uses document.cookie — the SAME cookie
 * the server reads for SSR (lib/session.ts). The connected/wallet UI is
 * client-side; the server-rendered party comes from the cookie directly.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const client = createPartyLayer({ network: 'devnet', app: { name: '{{PROJECT_NAME}}' } });
  nuxtApp.vueApp.use(
    createPartyLayerSession({
      provider: client.asProvider(),
      storage: createCookieStorage(),
    }),
  );
});
