import { CreativePreset, MediaAsset, Project } from '../types/studio';

const DB_NAME = 'motionforge-studio-db';
const DB_VERSION = 1;

const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'assets';
const STORE_BLOBS = 'assetBlobs';
const STORE_PRESETS = 'customPresets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const assetStore = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
        assetStore.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PRESETS)) {
        db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const ProjectStorage = {
  async listProjects(): Promise<Project[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const items = (await reqToPromise(tx.objectStore(STORE_PROJECTS).getAll())) as Project[];
    return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  async saveProject(project: Project): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    await reqToPromise(
      tx.objectStore(STORE_PROJECTS).put({
        ...project,
        updatedAt: new Date().toISOString(),
      })
    );
  },

  async deleteProject(projectId: string): Promise<void> {
    const db = await openDb();
    const assets = await this.listAssets(projectId);
    const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    for (const a of assets) {
      tx.objectStore(STORE_ASSETS).delete(a.id);
      tx.objectStore(STORE_BLOBS).delete(a.id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async listAssets(projectId?: string): Promise<MediaAsset[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_ASSETS, 'readonly');
    const store = tx.objectStore(STORE_ASSETS);
    if (projectId) {
      const idx = store.index('projectId');
      return (await reqToPromise(idx.getAll(projectId))) as MediaAsset[];
    }
    return (await reqToPromise(store.getAll())) as MediaAsset[];
  },

  async saveAsset(asset: MediaAsset, blob?: Blob): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_ASSETS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_ASSETS).put(asset);
    if (blob) {
      tx.objectStore(STORE_BLOBS).put({ id: asset.id, blob });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAssetBlob(assetId: string): Promise<Blob | null> {
    const db = await openDb();
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const record = (await reqToPromise(tx.objectStore(STORE_BLOBS).get(assetId))) as { id: string; blob: Blob } | undefined;
    return record?.blob || null;
  },

  async deleteAsset(assetId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction([STORE_ASSETS, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_ASSETS).delete(assetId);
    tx.objectStore(STORE_BLOBS).delete(assetId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async listCustomPresets(): Promise<CreativePreset[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_PRESETS, 'readonly');
    return (await reqToPromise(tx.objectStore(STORE_PRESETS).getAll())) as CreativePreset[];
  },

  async saveCustomPreset(preset: CreativePreset): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_PRESETS, 'readwrite');
    await reqToPromise(tx.objectStore(STORE_PRESETS).put({ ...preset, isCustom: true }));
  },

  async deleteCustomPreset(presetId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_PRESETS, 'readwrite');
    await reqToPromise(tx.objectStore(STORE_PRESETS).delete(presetId));
  },

  async estimateStorage(): Promise<{ usageBytes: number; quotaBytes: number; percent: number; opfsSupported: boolean }> {
    const opfsSupported = typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageBytes = est.usage || 0;
        const quotaBytes = est.quota || 0;
        const percent = quotaBytes > 0 ? Number(((usageBytes / quotaBytes) * 100).toFixed(2)) : 0;
        return { usageBytes, quotaBytes, percent, opfsSupported };
      } catch {
        return { usageBytes: 0, quotaBytes: 0, percent: 0, opfsSupported };
      }
    }
    return { usageBytes: 0, quotaBytes: 0, percent: 0, opfsSupported };
  },
};
