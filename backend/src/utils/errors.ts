export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(400, code, message);
  }

  static unauthorized(message = 'Token inválido ou expirado') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Sem permissão para esta ação') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Recurso') {
    return new AppError(404, 'NOT_FOUND', `${resource} não encontrado`);
  }

  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }

  static internal(message = 'Erro interno do servidor') {
    return new AppError(500, 'INTERNAL_ERROR', message, false);
  }
}
