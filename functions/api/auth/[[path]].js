import { createAuth } from '../../_lib/auth.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';

export async function onRequest(context) {
  const auth = createAuth(getRuntimeEnv(context));
  return auth.handler(context.request);
}
