import mongoose from "mongoose";
import env from "../utility/env.js";

export const connectionDatabase = async () => {
  await mongoose.connect(env.DATABASE_URL);
  console.log(`🔥Database Connected`);
};
