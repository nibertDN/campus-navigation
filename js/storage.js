export const storage = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (error) {
      console.error('Storage read failed', error);
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage write failed', error);
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};
