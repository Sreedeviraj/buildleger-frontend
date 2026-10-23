// Receipt and invoice files. Kept in the browser's IndexedDB for now (localStorage is too small);
// records only store { id, name, type, size }. The backend will replace this with file storage.
import type { Attachment } from '../types';

const DB_NAME = 'buildledger-files';
const STORE = 'files';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_FILES = 'image/*,application/pdf';

function openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(new Error('Files cannot be saved in this browser.'));
    request.onsuccess = () => resolve(request.result.transaction(STORE, mode).objectStore(STORE));
  });
}

export async function saveAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    throw new Error(`${file.name}: only photos and PDF files can be attached.`);
  }
  const id = `att_${Math.random().toString(36).slice(2, 12)}`;
  const store = await openStore('readwrite');
  await new Promise<void>((resolve, reject) => {
    const request = store.put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`${file.name} could not be saved.`));
  });
  return { id, name: file.name, type: file.type, size: file.size };
}

export async function openAttachment(attachment: Attachment): Promise<void> {
  // Open the tab first so the browser does not block it as a pop-up.
  const tab = window.open('', '_blank');
  const store = await openStore('readonly');
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = store.get(attachment.id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(new Error('The file could not be opened.'));
  });
  if (!blob) {
    tab?.close();
    throw new Error('This file is not available on this device.');
  }
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.location.href = url;
}

export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
