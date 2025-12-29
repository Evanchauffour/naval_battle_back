import { IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((o) => o.username !== undefined && o.username !== null && o.username !== '')
  @IsString({
    message: "Le nom d'utilisateur doit être une chaîne de caractères",
  })
  @MinLength(3, {
    message: "Le nom d'utilisateur doit contenir au moins 3 caractères",
  })
  username?: string;

  @IsNotEmpty({ message: 'Le mot de passe actuel est requis' })
  @IsString({ message: 'Le mot de passe actuel doit être une chaîne de caractères' })
  currentPassword: string;

  @IsOptional()
  @ValidateIf((o) => o.newPassword !== undefined && o.newPassword !== null && o.newPassword !== '')
  @IsString({ message: 'Le nouveau mot de passe doit être une chaîne de caractères' })
  @MinLength(6, { message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
  newPassword?: string;
}

