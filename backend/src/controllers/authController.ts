import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { loginSchema, signupSchema } from "./schemas";
import { parseOrThrow } from "../utils/validate";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  signup = async (req: Request, res: Response) => {
    const session = await this.authService.signup(parseOrThrow(signupSchema, req.body));
    res.status(201).json(session);
  };

  login = async (req: Request, res: Response) => {
    res.json(await this.authService.login(parseOrThrow(loginSchema, req.body)));
  };

  me = async (req: Request, res: Response) => {
    res.json({ user: await this.authService.getCurrentUser(req.auth!.id) });
  };
}
