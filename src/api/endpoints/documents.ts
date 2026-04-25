import type { UploadRequest, UploadResponse } from '@/types/api';

import { http, withUploadTimeout } from '../client';

/**
 * POST /infrasscanfield/documents/upload
 * Upload a scanned document (base64) and attach it to a Dolibarr object.
 * Auto-applies the upload-class timeout (120s).
 */
export async function uploadDocument(payload: UploadRequest): Promise<UploadResponse> {
  const res = await http.post<UploadResponse>('/documents/upload', payload, withUploadTimeout());
  return res.data;
}
