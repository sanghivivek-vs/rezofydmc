/**
 * Auth API (Build guide §4): organization bootstrap + login. Unauthenticated by
 * design — these endpoints mint the first/next session token.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ValidationError } from '@common/errors/errors';
import { AuthService, type RegisterOrgInput } from '../service/auth.service';

interface LoginDto {
  email?: string;
  password?: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register-org')
  @HttpCode(HttpStatus.CREATED)
  async registerOrg(@Body() body: RegisterOrgInput) {
    if (!body?.org || !body?.owner) {
      throw new ValidationError('Both "org" and "owner" are required');
    }
    return this.auth.registerOrg(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    if (!body?.email || !body?.password) {
      throw new ValidationError('email and password are required');
    }
    const result = await this.auth.login(body.email, body.password);
    if (!result) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return result;
  }
}
