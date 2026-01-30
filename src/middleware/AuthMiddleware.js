import jwt from "jsonwebtoken";
export async function authMiddleware(req, res, next) {
  try {
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, please login" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Invalid token, authorization denied" });
  }
}
