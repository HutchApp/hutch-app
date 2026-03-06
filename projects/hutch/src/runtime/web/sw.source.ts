export const SERVICE_WORKER_SOURCE = `\
var CACHE_NAME = 'hutch-offline-v2';
var MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isQueueList(url) {
  var path = new URL(url).pathname;
  return path === '/queue';
}

function isReaderPage(url) {
  var path = new URL(url).pathname;
  return /^\\/queue\\/[^/]+\\/read$/.test(path);
}

function isArticleRoute(url) {
  return isQueueList(url) || isReaderPage(url);
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

function cacheResponse(cache, request, response) {
  return addCacheTimestamp(response.clone()).then(function(stamped) {
    cache.put(request, stamped);
  });
}

function extractReaderLinks(html, baseUrl) {
  var pattern = /href="(\\/queue\\/[^"]+\\/read)"/g;
  var links = [];
  var match;
  while ((match = pattern.exec(html)) !== null) {
    links.push(new URL(match[1], baseUrl).href);
  }
  return links;
}

function precacheReaderPages(cache, html, baseUrl) {
  var links = extractReaderLinks(html, baseUrl);
  links.forEach(function(link) {
    cache.match(link).then(function(existing) {
      if (existing) return;
      fetch(link, { credentials: 'same-origin' }).then(function(res) {
        if (res.ok) cacheResponse(cache, new Request(link), res);
      }).catch(function() {});
    });
  });
}

function networkFirst(event, cache) {
  return fetch(event.request).then(function(networkResponse) {
    if (networkResponse.ok) {
      cacheResponse(cache, event.request, networkResponse);
      if (isQueueList(event.request.url)) {
        networkResponse.clone().text().then(function(html) {
          precacheReaderPages(cache, html, event.request.url);
        });
      }
    }
    return networkResponse;
  }).catch(function() {
    return cache.match(event.request).then(function(cached) {
      if (cached) return cached;
      return new Response(
        '<!DOCTYPE html><html><head><title>Offline</title></head>' +
        '<body><h1>You are offline</h1><p>This page is not available offline yet. ' +
        'Visit it once while online to make it available offline.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      );
    });
  });
}

function staleWhileRevalidate(event, cache) {
  return cache.match(event.request).then(function(cachedResponse) {
    if (cachedResponse) {
      var expired = isCacheExpired(cachedResponse);
      var stale = isStaleConnection();
      if (expired && !stale) {
        fetch(event.request).then(function(res) {
          if (res.ok) cacheResponse(cache, event.request, res);
        }).catch(function() {});
      }
      return cachedResponse;
    }
    return fetch(event.request).then(function(networkResponse) {
      if (networkResponse.ok) {
        cacheResponse(cache, event.request, networkResponse);
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
}

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!isArticleRoute(event.request.url)) return;
  if (event.request.headers.get('accept') &&
      event.request.headers.get('accept').indexOf('text/html') === -1) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      if (isQueueList(event.request.url)) {
        return networkFirst(event, cache);
      }
      return staleWhileRevalidate(event, cache);
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
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'REVALIDATE_QUEUE') {
    caches.open(CACHE_NAME).then(function(cache) {
      fetch('/queue', { credentials: 'same-origin' }).then(function(res) {
        if (res.ok) {
          cacheResponse(cache, new Request('/queue'), res);
          res.clone().text().then(function(html) {
            precacheReaderPages(cache, html, self.registration.scope);
          });
        }
      }).catch(function() {});
    });
  }
});
`;
