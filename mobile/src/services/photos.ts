import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Photo {
  id: string;
  obraId: string;
  uploadedBy: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  uploader?: User;
}

export interface PhotoComment {
  id: string;
  photoId: string;
  userId: string;
  body: string;
  createdAt: string;
  user?: User;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getPhotos(obraId: string): Promise<Photo[]> {
  const response = await api.get<ApiResponse<Photo[]>>(
    `/obras/${obraId}/photos`,
  );
  return response.data.data;
}

export async function uploadPhoto(
  obraId: string,
  formData: FormData,
): Promise<Photo> {
  const response = await api.post<ApiResponse<Photo>>(
    `/obras/${obraId}/photos`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data.data;
}

export async function deletePhoto(id: string): Promise<void> {
  await api.delete(`/photos/${id}`);
}

export async function getPhotoComments(
  photoId: string,
): Promise<PhotoComment[]> {
  const response = await api.get<ApiResponse<PhotoComment[]>>(
    `/photos/${photoId}/comments`,
  );
  return response.data.data;
}

export async function addPhotoComment(
  photoId: string,
  body: string,
): Promise<PhotoComment> {
  const response = await api.post<ApiResponse<PhotoComment>>(
    `/photos/${photoId}/comments`,
    { body },
  );
  return response.data.data;
}
