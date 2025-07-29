// tests/__mocks__/@vercel/kv.js

let memoryKvStore = {};

const kv = {
  get: jest.fn((key) => Promise.resolve(memoryKvStore[key])),
  set: jest.fn((key, value) => {
    memoryKvStore[key] = value;
    return Promise.resolve('OK');
  }),
  incr: jest.fn((key) => {
    const currentValue = memoryKvStore[key] || 0;
    const newValue = currentValue + 1;
    memoryKvStore[key] = newValue;
    return Promise.resolve(newValue);
  }),
  del: jest.fn((key) => {
    const exists = key in memoryKvStore;
    delete memoryKvStore[key];
    return Promise.resolve(exists ? 1 : 0);
  }),
  // Вспомогательная функция для тестов, чтобы очищать хранилище
  __clearStore: () => {
    memoryKvStore = {};
  }
};

module.exports = { kv }; 