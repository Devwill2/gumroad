export interface UploadState {
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadId: string;
  completedParts: number[];
  totalParts: number;
  lastUpdated: number;
  error?: string;
  canRetry?: boolean;
}

export interface UploadProgress {
  percent: number;
  bitrate: number;
  completedParts: number;
  totalParts: number;
}

