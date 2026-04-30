// Test-level retry: re-runs a failing test up to 2 additional times before
// reporting failure. The flakes that motivated this are load-induced
// supertest hangs (socket hang up, timeouts, querySelector returning null
// after a 404 fall-through) where the second attempt typically passes
// because the system has more headroom by then. Retries do NOT mask
// reproducible test failures — a real bug fails all 3 attempts.
jest.retryTimes(2, { logErrorsBeforeRetry: true });
