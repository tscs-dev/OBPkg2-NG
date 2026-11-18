import { apiClient } from './client'
import type {
  UpdateUploaderDescriptionPayload,
  UpdateUploaderPayload,
  Uploader,
  UploaderDetail,
} from '@/types/models'

export async function fetchUploaderDetail(
  id: number,
  signal?: AbortSignal,
): Promise<UploaderDetail> {
  return apiClient<UploaderDetail>(`/uploaders/${id}`, {
    signal,
  })
}

export async function updateUploaderProfile(
  id: number,
  payload: UpdateUploaderPayload | UpdateUploaderDescriptionPayload,
): Promise<Uploader> {
  return apiClient<Uploader>(`/uploaders/${id}`, {
    method: 'POST',
    body: payload,
  })
}
