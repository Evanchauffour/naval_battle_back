import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  password: string;

  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @MinLength(1, { message: 'Le prénom ne peut pas être vide' })
  firstName: string;

  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(1, { message: 'Le nom ne peut pas être vide' })
  lastName: string;

  @IsString({
    message: "Le nom d'utilisateur doit être une chaîne de caractères",
  })
  @MinLength(3, {
    message: "Le nom d'utilisateur doit contenir au moins 3 caractères",
  })
  username: string;
}
