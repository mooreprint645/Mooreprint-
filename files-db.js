(function () {
  const DB_NAME = 'mooreprint-local-files';
  const STORE_NAME = 'attachments';
  const DB_VERSION = 1;
  const BACKUP_FORMAT = 'mooreprint-files-backup';
  const BACKUP_VERSION = 1;

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

  async function getAllFiles() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => { database.close(); resolve(request.result || []); };
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

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer un archivo adjunto.'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl, fallbackType) {
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(dataUrl || ''));
    if (!match) throw new Error('El respaldo contiene un archivo dañado.');
    const type = match[1] || fallbackType || 'application/octet-stream';
    const binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type });
  }

  async function getStorageSummary() {
    const files = await getAllFiles();
    return {
      count: files.length,
      totalBytes: files.reduce((sum, file) => sum + Number(file.size || file.blob?.size || 0), 0)
    };
  }

  async function exportBackup() {
    const records = await getAllFiles();
    if (!records.length) throw new Error('Todavía no hay archivos adjuntos para respaldar.');

    const files = [];
    for (const record of records) {
      files.push({
        id: record.id,
        orderId: record.orderId,
        name: record.name,
        type: record.type || record.blob?.type || 'application/octet-stream',
        size: Number(record.size || record.blob?.size || 0),
        createdAt: record.createdAt || new Date().toISOString(),
        dataUrl: await blobToDataUrl(record.blob)
      });
    }

    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      count: files.length,
      files
    };
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `mooreprint-archivos-${date}.json`);
    return { count: files.length, totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
  }

  async function importBackup(file, options = {}) {
    if (!file) throw new Error('Selecciona un respaldo de archivos.');
    const parsed = JSON.parse(await file.text());
    if (parsed?.format !== BACKUP_FORMAT || Number(parsed?.version) !== BACKUP_VERSION || !Array.isArray(parsed?.files)) {
      throw new Error('El archivo no es un respaldo válido de MoorePrint.');
    }

    const records = parsed.files.map(item => {
      if (!item?.id || !item?.orderId || !item?.name || !item?.dataUrl) {
        throw new Error('El respaldo contiene información incompleta.');
      }
      const blob = dataUrlToBlob(item.dataUrl, item.type);
      return {
        id: String(item.id),
        orderId: String(item.orderId),
        name: String(item.name),
        type: String(item.type || blob.type || 'application/octet-stream'),
        size: Number(item.size || blob.size || 0),
        createdAt: item.createdAt || new Date().toISOString(),
        blob
      };
    });

    await withStore('readwrite', store => {
      if (options.replace === true) store.clear();
      records.forEach(record => store.put(record));
    });
    return { count: records.length, totalBytes: records.reduce((sum, record) => sum + record.size, 0) };
  }

  async function downloadFile(id) {
    const record = await getFile(id);
    if (!record) throw new Error('No se encontró el archivo.');
    downloadBlob(record.blob, record.name);
  }

  window.FileDB = {
    saveFiles,
    listFiles,
    getAllFiles,
    getFile,
    removeFile,
    removeOrderFiles,
    clearAll,
    downloadFile,
    getStorageSummary,
    exportBackup,
    importBackup
  };
})();