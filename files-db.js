(function () {
  const DB_NAME = 'mooreprint-local-files';
  const STORE_NAME = 'attachments';
  const DB_VERSION = 1;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Este navegador no permite guardar archivos localmente.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento de archivos.'));
    });
  }

  async function withStore(mode, callback) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try { result = callback(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  }

  async function saveFiles(orderId, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return [];
    const records = files.map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      orderId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file
    }));
    await withStore('readwrite', store => records.forEach(record => store.put(record)));
    return records.map(({ blob, ...metadata }) => metadata);
  }

  async function listFiles(orderId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const index = transaction.objectStore(STORE_NAME).index('orderId');
      const request = index.getAll(orderId);
      request.onsuccess = () => {
        database.close();
        resolve((request.result || []).map(({ blob, ...metadata }) => metadata));
      };
      request.onerror = () => { database.close(); reject(request.error); };
    });
  }

  async function getFile(id) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => { database.close(); resolve(request.result || null); };
      request.onerror = () => { database.close(); reject(request.error); };
    });
  }

  async function removeFile(id) {
    await withStore('readwrite', store => store.delete(id));
  }

  async function removeOrderFiles(orderId) {
    const files = await listFiles(orderId);
    await withStore('readwrite', store => files.forEach(file => store.delete(file.id)));
  }

  async function clearAll() {
    await withStore('readwrite', store => store.clear());
  }

  async function downloadFile(id) {
    const record = await getFile(id);
    if (!record) throw new Error('No se encontró el archivo.');
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.FileDB = { saveFiles, listFiles, getFile, removeFile, removeOrderFiles, clearAll, downloadFile };
})();
