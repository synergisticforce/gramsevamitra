self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/owner/') return;
  event.respondWith((async () => {
    const form = await event.request.formData();
    const file = form.get('file');
    if (file instanceof File) {
      const cache = await caches.open('gsm-share');
      await cache.put('/shared-payout-file', new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'payout'),
        },
      }));
    }
    return Response.redirect('/owner/?shared=1', 303);
  })());
});
