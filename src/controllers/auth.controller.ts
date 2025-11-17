import { Request, Response } from "express";
import { asyncHandler } from "../utils/handler";
import { ApiError } from "../utils/ApiError";
import { User } from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password, firstName, lastName, email, phone, roles } = req.body;

  if (!auid || !password || !firstName) {
    throw new ApiError(400, "AUID, password, and firstName are required.");
  }

  // Check if user already exists
  const existing = await User.findOne({ auid });
  if (existing) {
    throw new ApiError(409, "User with this AUID already exists.");
  }

  const user = await User.create({
    auid,
    password,
    firstName,
    lastName,
    email,
    phone,
    roles: roles || ["student"],
  });

  res.status(201).json({
    message: "User registered successfully.",
    user: {
      _id: user._id,
      auid: user.auid,
      roles: user.roles,
    },
  });
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { auid, password } = req.body;

  if (!auid || !password) {
    throw new ApiError(400, "AUID and password are required.");
  }

  // Find user
  const user = await User.findOne({ auid });
  if (!user) {
    throw new ApiError(401, "Invalid AUID or password.");
  }

  // Password check
  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    throw new ApiError(401, "Invalid AUID or password.");
  }

  // Generate JWT token from your model method
  const token = user.accessToken();

  // set cookie if needed
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRY || "864000") * 1000,
  });

  res.json({
    message: "Login successful",
    token,
    user: {
      _id: user._id,
      auid: user.auid,
      firstName: user.firstName,
      roles: user.roles,
    },
  });
});
