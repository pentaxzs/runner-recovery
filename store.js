// localStorage 래퍼. 접근이 막히거나 용량이 차도 앱이 죽지 않도록 메모리로 폴백한다.

export const STORAGE_PREFIX = 'rr_v3_';

function defaultBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = `${STORAGE_PREFIX}__probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function createStore(backend = defaultBackend()) {
  const memory = new Map();

  const readRaw = (k) => {
    if (backend) {
      // getItem이 멀쩡해도 setItem이 터지는 경우(용량 초과)가 있다. 그때
      // backend는 null을 돌려주므로 메모리 사본까지 내려가야 쓴 값을 되읽는다.
      try {
        const v = backend.getItem(k);
        if (v !== null) return v;
      } catch { /* 메모리로 */ }
    }
    return memory.has(k) ? memory.get(k) : null;
  };

  const writeRaw = (k, v) => {
    memory.set(k, v); // 항상 메모리에도 둔다
    if (backend) {
      try { backend.setItem(k, v); } catch { /* 메모리만으로 계속 */ }
    }
  };

  return {
    get(key, fallback) {
      const raw = readRaw(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      writeRaw(STORAGE_PREFIX + key, JSON.stringify(value));
    },
    remove(key) {
      const k = STORAGE_PREFIX + key;
      memory.delete(k);
      if (backend) {
        try { backend.removeItem(k); } catch { /* noop */ }
      }
    },
  };
}
