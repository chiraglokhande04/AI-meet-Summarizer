import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import env from "../utility/env.js";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      _id: user._id,
      email: user.email,
      message: "Login successful",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ email, password });

    await newUser.save();

    const token = generateToken(newUser._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      _id: newUser._id,
      email: newUser.email,
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const logoutUser = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
};

export const getUser = async (req, res) => {
  try {
    const id = req.user.id;
    if (!id) return res.status(400).json({ message: "id is not avaiable" });

    const user = await User.findById(id);
    if (!user)
      return res.status(400).json({ message: "User does not already exists" });
    res
      .status(200)
      .json({ success: true, message: "User is fetched", data: user });
  } catch (error) {}
};
