export const SERVICE_WORKER_SOURCE = `\
var CACHE_NAME = 'hutch-offline-v1';
var MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isArticleRoute(url) {
  var path = new URL(url).pathname;
  return path === '/queue' || /^\\/queue\\/[^/]+\\/read$/.test(path);
}

function isStaleConnection() {
  if (!navigator.connection) return false;
  var conn = navigator.connection;
  if (conn.saveData) return true;
  var dominated = ['slow-2g', '2g'];
  return dominated.indexOf(conn.effectiveType) !== -1;
}

function isCacheExpired(response) {
  var cached = response.headers.get('sw-cached-at');
  if (!cached) return true;
  return Date.now() - Number(cached) > MAX_AGE_MS;
}

function addCacheTimestamp(response) {
  var headers = new Headers(response.headers);
  headers.set('sw-cached-at', String(Date.now()));
  return response.clone().arrayBuffer().then(function(body) {
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  });
}

function revalidateCache(request, cache) {
  return fetch(request).then(function(networkResponse) {
    if (networkResponse.ok) {
      return addCacheTimestamp(networkResponse).then(function(stamped) {
        cache.put(request, stamped);
        return networkResponse;
      });
    }
    return networkResponse;
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!isArticleRoute(event.request.url)) return;
  if (event.request.headers.get('accept') &&
      event.request.headers.get('accept').indexOf('text/html') === -1) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          var expired = isCacheExpired(cachedResponse);
          var stale = isStaleConnection();

          if (expired && !stale) {
            return revalidateCache(event.request, cache).catch(function() {
              return cachedResponse;
            });
          }

          if (!stale) {
            revalidateCache(event.request, cache).catch(function() {});
          }

          return cachedResponse;
        }

        return fetch(event.request).then(function(networkResponse) {
          if (networkResponse.ok) {
            addCacheTimestamp(networkResponse.clone()).then(function(stamped) {
              cache.put(event.request, stamped);
            });
          }
          return networkResponse;
        }).catch(function() {
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head>' +
            '<body><h1>You are offline</h1><p>This page is not available offline yet. ' +
            'Visit it once while online to make it available offline.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        });
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name.startsWith('hutch-offline-') && name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    })
  );
});
`;
