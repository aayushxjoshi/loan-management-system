import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { Role } from "../config/constants";

const SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

type UserLike = { id: string; name: string; email: string; role: string };

export class AuthService {
  constructor(private readonly userModel: typeof User) {}

  async signup(input: { name: string; email: string; password: string }) {
    const email = input.email.toLowerCase().trim();
    if (await this.userModel.exists({ email })) throw AppError.conflict("Email already registered");

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    try {
      const user = await this.userModel.create({ name: input.name, email, passwordHash, role: "borrower" });
      return this.buildSession(user);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw AppError.conflict("Email already registered");
      throw err;
    }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.userModel.findOne({ email: input.email.toLowerCase().trim() });
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !passwordMatches) throw AppError.unauthorized("Invalid email or password");
    return this.buildSession(user);
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw AppError.unauthorized("User no longer exists");
    return this.toPublicUser(user);
  }

  private toPublicUser(user: UserLike): PublicUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
  }

  private buildSession(user: UserLike) {
    return { token: signToken(user.id, user.role as Role), user: this.toPublicUser(user) };
  }
}
