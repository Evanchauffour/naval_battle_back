import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'L’email doit être valide' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  password: string;

  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(1, { message: 'Le nom ne peut pas être vide' })
  name: string;
}
