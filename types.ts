export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ImageItem {
  id: string;
  file: File;
  originalPreviewUrl: string;
  processedUrl?: string;
  status: ProcessingStatus;
  errorMessage?: string;
  mimeType: string;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  success: number;
  failed: number;
}