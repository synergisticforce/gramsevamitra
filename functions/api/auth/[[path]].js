import { createAuth } from '../_lib/auth.mjs';

export async function onRequest(context) {
  const auth = createAuth(context.env);
  return auth.handler(context.request);
}
