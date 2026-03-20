import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl: process.env.DATABASE_URL!,

  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  jwtAccessExpiry: (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'],
  jwtRefreshExpiry: (process.env.JWT_REFRESH_EXPIRY || '7d') as jwt.SignOptions['expiresIn'],

  resetTokenExpiryHours: parseInt(process.env.RESET_TOKEN_EXPIRY_HOURS || '2', 10),

  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),

  s3Endpoint: process.env.S3_ENDPOINT,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKey: process.env.S3_ACCESS_KEY,
  s3SecretKey: process.env.S3_SECRET_KEY,
  s3Region: process.env.S3_REGION || 'auto',

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,

  trelloApiKey: process.env.TRELLO_API_KEY,
  trelloToken: process.env.TRELLO_TOKEN,

  agendorApiToken: process.env.AGENDOR_API_TOKEN,
  agendorBaseUrl: process.env.AGENDOR_BASE_URL || 'https://api.agendor.com.br/v3',

  googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
};
