import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';

class CreateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name: string;

  @IsString() @MinLength(1) @MaxLength(16)
  icon: string;

  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;
}

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    return (await this.categories.listForUser(me.id)).map((c) => this.categories.toDto(c));
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.toDto(await this.categories.createCustom(me.id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.categories.deleteCustom(me.id, id);
  }
}
