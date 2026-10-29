import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { conflict, notFoundError, unauthorized } from "../../utils/httpError";
import { UserModel, type UserDocument } from "./auth.model";
import type { LoginInput, RegisterInput } from "./auth.validation";

const BCRYPT_ROUNDS = 10;

// Hash de referencia usado cuando el correo no existe: mantiene un tiempo de
// respuesta similar al de una contraseña incorrecta y evita revelar por
// temporización qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync("hash-de-referencia-sin-uso", BCRYPT_ROUNDS);

// Tipo de dato publico del usuario (sin contraseña)
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

// Tipo de Datos que retorna el servicio (usuario + token)
export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

// Transforma el documento de mongoose a un objeto PublicUser
function toPublicUser(user: UserDocument): PublicUser {
  return { id: String(user._id), name: user.name, email: user.email };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Verifica si el error es de clave duplicada
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
}

//firma el access token con el id del usuario
export function signAccessToken(userId: string): string {
  const options: jwt.SignOptions = {
    algorithm: "HS256",
    // env.JWT_EXPIRES_IN ya está validado con el formato `número + unidad` (ms acepta ese formato)
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  };
  // Genera el token con el id del usuario.
  // sub es el sujeto del token (id del usuario)
  return jwt.sign({ sub: userId }, env.JWT_SECRET, options);
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const user = await UserModel.create({
      name: input.name.trim(),
      email,
      passwordHash,
    });
    return {
      user: toPublicUser(user), // devuelve el usuario sin contraseña
      accessToken: signAccessToken(String(user._id)), // firma el token
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw conflict("El correo ya está registrado");
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const user = await UserModel.findOne({ email }).select("+passwordHash");

  // Se compara siempre (contra un hash de referencia si el usuario no existe)
  // para no filtrar la existencia del correo por diferencias de tiempo.
  const matches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  // Mismo mensaje para email inexistente y contraseña incorrecta
  if (!user || !matches) {
    throw unauthorized("Credenciales inválidas");
  }

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(String(user._id)), // firma el token
  };
}

// obtiene el usuario publico
export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw notFoundError("Usuario no encontrado");
  }
  return toPublicUser(user);
}
