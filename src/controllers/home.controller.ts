import { Request, Response } from "express";

export const homeController = (req: Request, res: Response) => {
  res.json({
    message: "Hello from Express + TypeScript!",
  });
};
