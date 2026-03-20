import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

export async function listPhotos(obraId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where: { obraId },
      include: {
        uploader: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.photo.count({ where: { obraId } }),
  ]);
  return { photos, total };
}

export async function createPhoto(obraId: string, uploadedBy: string, imageUrl: string, caption?: string) {
  return prisma.photo.create({
    data: {
      obraId,
      uploadedBy,
      imageUrl,
      caption,
    },
    include: {
      uploader: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function deletePhoto(id: string, userId: string, userRole: string) {
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) throw AppError.notFound('Foto');

  // Only the uploader or gestor+ can delete
  if (photo.uploadedBy !== userId && userRole === 'campo') {
    throw AppError.forbidden();
  }

  await prisma.photo.delete({ where: { id } });
}

export async function listComments(photoId: string) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) throw AppError.notFound('Foto');

  return prisma.photoComment.findMany({
    where: { photoId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createComment(photoId: string, userId: string, body: string) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) throw AppError.notFound('Foto');

  return prisma.photoComment.create({
    data: { photoId, userId, body },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function getPhotoObraId(photoId: string): Promise<string> {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { obraId: true } });
  if (!photo) throw AppError.notFound('Foto');
  return photo.obraId;
}
