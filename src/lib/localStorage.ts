// This utility should only be called from client-side components or useEffect hooks.

export function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  const item = window.localStorage.getItem(key);
  if (item) {
    try {
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error parsing localStorage item with key "${key}":`, error);
      window.localStorage.removeItem(key); // Remove corrupted item
      return null;
    }
  }
  return null;
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serializedValue = JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
  } catch (error) {
    console.error(`Error setting localStorage item with key "${key}":`, error);
  }
}

export function removeItem(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(key);
}