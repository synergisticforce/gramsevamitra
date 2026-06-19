import { jsonResponse } from '../../_lib/json.mjs';
import { getSessionUser } from '../../_lib/session.mjs';
import { getRuntimeEnv } from '../../_lib/runtimeEnv.mjs';
import { getUserRow, isOrderProcessed } from '../../_lib/userDb.mjs';

export async function onRequestGet(context) {
  const { request } = context;
  const env = getRuntimeEnv(context);
  const user = await getSessionUser(request, context);

  if (!user?.id) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    const row = await getUserRow(env, user.id);
    return jsonResponse({
      plan: row?.plan ?? user.plan ?? 'free',
      proActive: row?.plan === 'pro',
    });
  }

  const processed = await isOrderProcessed(env, orderId);
  const row = await getUserRow(env, user.id);

  return jsonResponse({
    orderId,
    processed,
    plan: row?.plan ?? 'free',
    proActive: row?.plan === 'pro',
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
