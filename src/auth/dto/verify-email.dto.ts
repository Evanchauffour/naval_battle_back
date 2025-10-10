import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty({ message: 'Le token est requis' })
  @IsString({ message: 'Le token doit être une chaîne de caractères' })
  token: string;
}
