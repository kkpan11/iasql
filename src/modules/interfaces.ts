import { readdirSync, } from 'fs'

import { QueryRunner, } from 'typeorm'

// The exported interfaces are meant to provide better type checking both at compile time and in the
// editor. They *shouldn't* have to be ever imported directly, only the classes ought to be, but as
// the classes use these interfaces it helps give you hints as you develop a lot better than without
// them.

export type Context = { [key: string]: any };

export interface CrudInterface<E> {
  create: (e: E[], ctx: Context) => Promise<void | E[]>;
  read: (ctx: Context, ids?: string[]) => Promise<E[] | void>;
  updateOrReplace?: (prev: E, next: E) => 'update' | 'replace';
  update: (e: E[], ctx: Context) => Promise<void | E[]>;
  delete: (e: E[], ctx: Context) => Promise<void | E[]>;
}

export class Crud<E> {
  createFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  readFn: (ctx: Context, ids?: string[]) => Promise<E[] | void>;
  updateFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  updateOrReplaceFn: (prev: E, next: E) => 'update' | 'replace';
  deleteFn: (e: E[], ctx: Context) => Promise<void | E[]>;
  dest?: 'db' | 'cloud';
  entity?: new () => E;
  entityId?: (e: E) => string;

  constructor(def: CrudInterface<E>) {
    this.createFn = def.create;
    this.readFn = def.read;
    this.updateOrReplaceFn = def.updateOrReplace ?? (() => 'update');
    this.updateFn = def.update
    this.deleteFn = def.delete;
  }

  memo(entity: void | E | E[], ctx: Context, input?: any | any[]) {
    if (!entity) return;
    const es = Array.isArray(entity) ? entity : [entity];
    const dest = this.dest ?? 'What?';
    const entityName = this.entity?.name ?? 'What?';
    const entityId = this.entityId ?? ((_e: E) => { return 'What?'; });
    es.forEach((e, i) => {
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      if (!ctx.memo[dest][entityName][entityId(e)]) {
        ctx.memo[dest][entityName][entityId(e)] = e;
      } else {
        // Transfer the properties from the entity to the one already memoized so other references
        // to the same entity also get updated, then update the output array
        const realE = ctx.memo[dest][entityName][entityId(e)];
        Object.keys(e).forEach(k => realE[k] = (e as any)[k]);
        es[i] = realE;
      }
    });
    if (Array.isArray(entity) && (Array.isArray(input) || input === undefined)) {
      return entity;
    } else {
      // To return the possibly-changed entity instead of the original input one
      return es[0];
    }
  }

  unmemo(entity: void | E | E[], ctx: Context) {
    if (!entity) return;
    const es = Array.isArray(entity) ? entity : [entity];
    const dest = this.dest ?? 'What?';
    const entityName = this.entity?.name ?? 'What?';
    const entityId = this.entityId ?? ((_e: E) => { return 'What?'; });
    es.forEach(e => {
      ctx.memo[dest] = ctx.memo[dest] ?? {};
      ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
      delete ctx.memo[dest][entityName][entityId(e)];
    });
  }

  async create(e: E | E[], ctx: Context) {
    console.log(`Calling ${this.entity?.name ?? ''} ${this.dest} create`);
    const es = Array.isArray(e) ? e : [e];
    // Memoize before and after the actual logic to make sure the unique ID is reserved
    this.memo(e, ctx);
    try {
      return this.memo(await this.createFn(es, ctx), ctx, e);
    } catch (err) {
      // Unmemo if it failed
      this.unmemo(e, ctx);
      throw err;
    }
  }

  async read(ctx: Context, id?: string | string[]) {
    console.log(`Calling ${this.entity?.name ?? ''} ${this.dest} read`);
    const entityId = this.entityId ?? ((_e: E) => { return 'What?'; });
    if (id) {
      const dest = this.dest ?? 'What?';
      const entityName = this.entity?.name ?? 'What?';
      if (Array.isArray(id)) {
        const missing: string[] = [];
        const vals = id.map(i => {
          const val = ctx.memo[dest]?.[entityName]?.[i];
          if (!val || (val && Object.keys(val).length === 0)) {
            // We create a placeholder value to put here so recursive calls will resolve an object
            // and we will rely on later code to stitch things back together to make sure circular
            // references are fine
            ctx.memo[dest] = ctx.memo[dest] ?? {};
            ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
            ctx.memo[dest][entityName][i] = new (this.entity as new () => E)();
            missing.push(i);
            return i;
          } else {
            return val;
          }
        });
        if (missing.length === 0) {
          return vals;
        }
        console.log(`Partial cache hit for ${this.entity?.name ?? ''} ${this.dest}`);
        // TODO: is it possible that `missingVals` it is unaligned with `missing`??
        const missingVals = (this.memo(await this.readFn(ctx, missing), ctx, missing) as E[]).sort(
          (a: E, b: E) => missing.indexOf(entityId(a)) - missing.indexOf(entityId(b))
        );
        // The order is the same in both lists, so we can cheat and do a single pass
        for (let i = 0, j = 0; i < vals.length; i++) {
          if (vals[i] === missing[j]) {
            const realE = ctx.memo[dest][entityName][vals[i]];
            if (missingVals && missingVals.length) Object.keys(missingVals[j]).forEach(k => realE[k] = (missingVals[j] as any)[k]);
            if (realE && !!Object.keys(realE).length) {
              vals[i] = realE;
            } else {
              delete ctx.memo[dest][entityName][vals[i]];
              vals.splice(i, 1);
            }
            j++;
          }
        }
        return vals;
      } else {
        // Possibly store an empty entity in the memoization before the call is done to make sure
        // circular loops don't really happen (a later call for the same ID will eject earlier)
        ctx.memo[dest] = ctx.memo[dest] ?? {};
        ctx.memo[dest][entityName] = ctx.memo[dest][entityName] ?? {};
        if (!ctx.memo[dest][entityName][id]) {
          console.log(`Cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
          ctx.memo[dest][entityName][id] = new (this.entity as new () => E)();
        } else {
          console.log(`Cache hit for ${this.entity?.name ?? ''} ${this.dest}`);
          return ctx.memo[dest][entityName][id];
        }
        // Linter thinks this is shadowing the other one on line 152 because JS hoisting nonsense
        let o;
        try {
          o = await this.readFn(ctx, [id]);
        } catch (e) {
          // Don't memo in this case, remove the registered placeholder and throw
          delete ctx.memo[dest][entityName][id];
          throw e;
        }
        if (!o || o.length === 0) {
          // Don't memo in this case, just pass it through, also remove the registered placeholder
          delete ctx.memo[dest][entityName][id];
          return undefined;
        } else if (Array.isArray(o) && o.length === 1) {
          return this.memo(o[0], ctx, id);
        } else {
          // Don't memo in this case, just pass it through, also remove the registered placeholder
          delete ctx.memo[dest][entityName][id];
          return o;
        }
      }
    }
    console.log(`Full cache miss for ${this.entity?.name ?? ''} ${this.dest}`);
    const out = await this.readFn(ctx);
    if (!out || out.length === 0) {
      // Don't memo in this case, just pass it through
      return out;
    } else {
      return this.memo(out, ctx, out.map(entityId));
    }
  }

  async update(e: E | E[], ctx: Context) {
    console.log(`Calling ${this.entity?.name ?? ''} ${this.dest} update`);
    const es = Array.isArray(e) ? e : [e];
    return this.memo(await this.updateFn(es, ctx), ctx, e);
  }

  async delete(e: E | E[], ctx: Context) {
    console.log(`Calling ${this.entity?.name ?? ''} ${this.dest} delete`);
    const es = Array.isArray(e) ? e : [e];
    const out = await this.deleteFn(es, ctx);
    this.unmemo(es, ctx); // Remove deleted record(s) from the memo
    if (!Array.isArray(e) && Array.isArray(out)) {
      return out[0];
    } else {
      return out;
    }
  }

  updateOrReplace(prev: E, next: E): 'update' | 'replace' {
    return this.updateOrReplaceFn(prev, next);
  }
}

export interface MapperInterface<E> {
  entity:  new () =>  E;
  entityId: (e: E) => string;
  entityPrint: (e: E) => { [key: string]: string, };
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud<E>;
  cloud: Crud<E>;
}

export class Mapper<E> {
  entity: new() => E;
  entityId: (e: E) => string;
  entityPrint: (e: E) => { [key: string]: string, };
  equals: (a: E, b: E) => boolean;
  source: 'db' | 'cloud';
  db: Crud<E>;
  cloud: Crud<E>;

  constructor(def: MapperInterface<E>) {
    this.entity = def.entity;
    this.entityId = def.entityId;
    this.entityPrint = def.entityPrint;
    this.equals = def.equals;
    this.source = def.source;
    this.db = def.db;
    this.db.entity = def.entity;
    this.db.entityId = def.entityId;
    this.db.dest = 'db';
    this.cloud = def.cloud;
    this.cloud.entity = def.entity;
    this.cloud.entityId = def.entityId;
    this.cloud.dest = 'cloud';
  }
}

export interface ModuleInterface {
  name: string;
  version: string;
  dependencies: string[];
  provides: {
    entities: { [key: string]: any, };
    tables?: string[];
    functions?: string[];
    // TODO: What other PSQL things should be tracked?
    // Context is special, it is merged between all installed modules and becomes the input to the
    // mappers, which can then make use of logic defined and exposed through this that they depend
    // on, so things like the `awsClient` just becomes part of the responsibility of the
    // `aws_account` module, for instance.
    context?: Context;
  };
  utils?: { [key: string]: any, };
  mappers: { [key: string]: Mapper<any>, };
  migrations?: {
    install: (q: QueryRunner) => Promise<void>;
    remove: (q: QueryRunner) => Promise<void>;
  };
}

// This is just a no-op class at the moment. Not strictly necessary but keeps things consistent
export class Module {
  name: string;
  version: string;
  dependencies: string[];
  provides: {
    entities: { [key: string]: any, };
    tables?: string[];
    functions?: string[];
    context?: Context;
  };
  utils: { [key: string]: any, };
  mappers: { [key: string]: Mapper<any>, };
  migrations: {
    install: (q: QueryRunner) => Promise<void>;
    remove: (q: QueryRunner) => Promise<void>;
  };

  constructor(def: ModuleInterface, dirname?: string) {
    this.name = def.name;
    this.version = def.version;
    this.dependencies = def.dependencies;
    this.provides = def.provides;
    this.utils = def?.utils ?? {};
    this.mappers = def.mappers;
    if (!def.migrations) {
      if (!dirname) throw new Error('Cannot determine module migration');
      const migrationDir = `${dirname}/migration`;
      const files = readdirSync(migrationDir).filter(f => !/.map$/.test(f));
      if (files.length !== 1) throw new Error('Cannot determine which file is the migration');
      const migration = require(`${migrationDir}/${files[0]}`);
      // Assuming TypeORM migration files
      const migrationClass = migration[Object.keys(migration)[0]];
      if (!migrationClass || !migrationClass.prototype.up || !migrationClass.prototype.down) {
        throw new Error('Presumed migration file is not a TypeORM migration');
      }
      this.migrations = {
        install: migrationClass.prototype.up,
        remove: migrationClass.prototype.down,
      };
    } else {
      this.migrations = def.migrations;
    }
  }
}