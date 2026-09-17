import { IsEmail, IsString, MinLength } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  @MinLength(20)
  idToken: string;
}

export class DevSignInDto {
  @IsEmail()
  email: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken: string;
}
