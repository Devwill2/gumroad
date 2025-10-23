import { UploadState } from "$app/types/upload";

export class UploadStateManager {
  private static readonly STORAGE_PREFIX = "gumroad_upload_";
  private static readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  private static readonly MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB limit for IndexedDB storage
  private static readonly DB_NAME = "GumroadUploadDB";
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = "files";

  static save(fileId: string, state: Partial<UploadState>): void {
    const key = `${this.STORAGE_PREFIX}${fileId}`;
    const existing = this.load(fileId) || {};
    const updated = { ...existing, ...state, lastUpdated: Date.now() };

    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // Handle save errors silently
    }
  }

  static load(fileId: string): UploadState | null {
    const key = `${this.STORAGE_PREFIX}${fileId}`;

    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;

      const state: UploadState = JSON.parse(saved);

      if (Date.now() - state.lastUpdated > this.MAX_AGE_MS) {
        this.clear(fileId);
        return null;
      }

      return state;
    } catch {
      return null;
    }
  }

  static clear(fileId: string): void {
    const key = `${this.STORAGE_PREFIX}${fileId}`;
    localStorage.removeItem(key);
  }

  static getAll(): UploadState[] {
    const states: UploadState[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_PREFIX)) {
        const fileId = key.replace(this.STORAGE_PREFIX, "");
        const state = this.load(fileId);
        if (state) states.push(state);
      }
    }

    return states;
  }

  static async cleanup(): Promise<void> {
    const states = this.getAll();
    const now = Date.now();

    for (const state of states) {
      if (now - state.lastUpdated > this.MAX_AGE_MS) {
        this.clear(state.fileId);
        await this.clearFile(state.fileId);
      }
    }

    await this.cleanupFiles();
  }

  private static async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'fileId' });
        }
      };
    });
  }

  static async saveFile(fileId: string, file: File): Promise<boolean> {
    if (file.size > this.MAX_FILE_SIZE) {
      return false;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const fileData = {
        fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        data: arrayBuffer,
        timestamp: Date.now()
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(fileData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch {
      return false;
    }
  }

  static async loadFile(fileId: string): Promise<File | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);

      const fileData = await new Promise<any>((resolve, reject) => {
        const request = store.get(fileId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!fileData) return null;

      const blob = new Blob([fileData.data], { type: fileData.type });
      return new File([blob], fileData.name, {
        type: fileData.type,
        lastModified: fileData.lastModified
      });
    } catch {
      return null;
    }
  }

  static async clearFile(fileId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Handle clear errors silently
    }
  }

  static async canResume(fileId: string): Promise<boolean> {
    const state = this.load(fileId);
    const file = await this.loadFile(fileId);
    return !!(state && file && state.completedParts.length > 0);
  }

  static async cleanupFiles(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const allFiles = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const now = Date.now();
      for (const file of allFiles) {
        if (now - file.timestamp > this.MAX_AGE_MS) {
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = store.delete(file.fileId);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      }
    } catch {
    }
  }
}
