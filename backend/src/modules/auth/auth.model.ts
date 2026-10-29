import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'name es obligatorio'],
      trim: true,
      maxlength: [100, 'name no puede superar 100 caracteres'],
    },
    email: {
      type: String,
      required: [true, 'email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'email no puede superar 254 caracteres'],
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash es obligatorio'],
      // Nunca se incluye en consultas ni en respuestas por defecto
      select: false,
    },
  },
  { timestamps: true },
);


export type User = InferSchemaType<typeof userSchema>;

export type UserDocument = HydratedDocument<User>;

export const UserModel: Model<User> =
  (models.User as Model<User> | undefined) ?? model<User>('User', userSchema);
