import dotenv from "dotenv";

dotenv.config();

export default {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
};
