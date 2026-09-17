import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CATEGORY_CATALOG, Category, CategorySlug } from '@tapntally/shared';
import { In, IsNull, Repository } from 'typeorm';
import { AppError } from '../../common/filters/http-exception.filter';
import { CategoryEntity } from '../../database/entities';

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);
  /** slug → entity. Canonical categories never change at runtime, so cache forever. */
  private bySlugCache = new Map<CategorySlug, CategoryEntity>();

  constructor(@InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>) {}

  /** Idempotently upsert the canonical catalogue so a fresh DB is usable immediately. */
  async onModuleInit() {
    const existing = await this.categories.find({ where: { isCustom: false } });
    const bySlug = new Map(existing.map((c) => [c.slug, c]));
    let created = 0;
    for (const [i, def] of CATEGORY_CATALOG.entries()) {
      let entity = bySlug.get(def.slug);
      if (!entity) {
        entity = this.categories.create({ slug: def.slug, isCustom: false, userId: null });
        created++;
      }
      entity.name = def.name;
      entity.icon = def.icon;
      entity.color = def.color;
      entity.sortOrder = i;
      await this.categories.save(entity);
      this.bySlugCache.set(def.slug, entity);
    }
    if (created) this.logger.log(`Seeded ${created} canonical categories`);
  }

  bySlug(slug: CategorySlug): CategoryEntity {
    const c = this.bySlugCache.get(slug);
    if (!c) throw new Error(`Canonical category missing: ${slug}`);
    return c;
  }

  get uncategorized(): CategoryEntity {
    return this.bySlug(CategorySlug.UNCATEGORIZED);
  }

  /** Canonical + the user's custom categories. */
  async listForUser(userId: string): Promise<CategoryEntity[]> {
    return this.categories.find({
      where: [{ isCustom: false, userId: IsNull() }, { isCustom: true, userId }],
      order: { isCustom: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Resolve a category id the user is allowed to use (canonical or their own custom). */
  async resolveForUser(userId: string, categoryId: string): Promise<CategoryEntity> {
    const c = await this.categories.findOne({ where: { id: categoryId } });
    if (!c || (c.isCustom && c.userId !== userId)) {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }
    return c;
  }

  async createCustom(userId: string, input: { name: string; icon: string; color: string }): Promise<CategoryEntity> {
    const dupe = await this.categories.findOne({ where: { userId, name: input.name.trim() } });
    if (dupe) throw new AppError('CATEGORY_EXISTS', 'You already have a category with that name', 409);
    return this.categories.save(
      this.categories.create({ ...input, name: input.name.trim(), slug: null, isCustom: true, userId, sortOrder: 1000 }),
    );
  }

  async deleteCustom(userId: string, id: string): Promise<void> {
    const c = await this.categories.findOne({ where: { id, userId, isCustom: true } });
    if (!c) throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    // Transactions referencing it are RESTRICTed at the DB level; the caller should
    // re-categorise first. Surface a friendly error rather than a 500.
    try {
      await this.categories.remove(c);
    } catch {
      throw new AppError('CATEGORY_IN_USE', 'Move transactions out of this category before deleting it', 409);
    }
  }

  async byIds(ids: string[]): Promise<Map<string, CategoryEntity>> {
    if (ids.length === 0) return new Map();
    const rows = await this.categories.find({ where: { id: In(ids) } });
    return new Map(rows.map((r) => [r.id, r]));
  }

  toDto(c: CategoryEntity): Category {
    return { id: c.id, slug: c.slug, name: c.name, icon: c.icon, color: c.color, isCustom: c.isCustom, userId: c.userId };
  }
}
