import api, { ApiResponse } from './api';
import { User } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  obraId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  createdBy: string;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  assignee?: User;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  dueDate?: string;
  position?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string | null;
  dueDate?: string | null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getTasks(obraId: string): Promise<ApiResponse<Task[]>> {
  const response = await api.get<ApiResponse<Task[]>>(
    `/obras/${obraId}/tasks`,
  );
  return response.data;
}

export async function createTask(
  obraId: string,
  data: CreateTaskData,
): Promise<Task> {
  const response = await api.post<ApiResponse<Task>>(
    `/obras/${obraId}/tasks`,
    data,
  );
  return response.data.data;
}

export async function updateTask(
  id: string,
  data: UpdateTaskData,
): Promise<Task> {
  const response = await api.put<ApiResponse<Task>>(`/tasks/${id}`, data);
  return response.data.data;
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  const response = await api.patch<ApiResponse<Task>>(`/tasks/${id}/status`, {
    status,
  });
  return response.data.data;
}

export async function updateTaskPosition(
  id: string,
  position: number,
): Promise<Task> {
  const response = await api.patch<ApiResponse<Task>>(
    `/tasks/${id}/position`,
    { position },
  );
  return response.data.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
