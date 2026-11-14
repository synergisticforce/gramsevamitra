self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (event.request.method !== 'POST' || path !== '/owner') return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const file = form.get('file');
      if (file instanceof File && file.size > 0) {
        const cache = await caches.open('gsm-share');
        await cache.put(
          '/shared-payout-file',
          new Response(file, {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-File-Name': encodeURIComponent(file.name || 'payout'),
            },
          }),
        );
      }
    } catch (err) {
      console.warn('[share-target] could not cache shared file', err);
    }
    return Response.redirect(`${url.origin}/owner/?shared=1`, 303);
  })());
});
