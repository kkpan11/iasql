// Currently just a collection of independent functions for user database management. May eventually
// grow into something more.

import { randomBytes } from 'crypto'
import * as fs from 'fs'

import { Connection, } from 'typeorm'

import { IronPlans, } from './gateways/ironplans'

// We only want to do this setup once, then we re-use it. First we get the list of files
const migrationFiles = fs
  .readdirSync(`${__dirname}/../migration`)
  .filter(f => !/\.map$/.test(f));
// Then we construct the class names stored within those files (assuming *all* were generated with
// `yarn gen-sql some-name`
const migrationNames = migrationFiles.map(f => {
  const components = f.replace(/\.(js|ts)/, '').split('-');
  const tz = components.shift();
  for (let i = 1; i < components.length; i++) {
    components[i] = components[i].replace(/^([a-z])(.*$)/, (_, p1, p2) => p1.toUpperCase() + p2);
  }
  return [...components, tz].join('');
});
// Then we dynamically `require` the migration files and construct the inner classes
const migrationObjs = migrationFiles
  .map(f => require(`${__dirname}/../migration/${f}`))
  .map((c, i) => c[migrationNames[i]])
  .map(M => new M());
// Finally we use this in this function to execute all of the migrations in order for a provided
// connection, but without the migration management metadata being added, which is actually a plus
// for us.
export async function migrate(conn: Connection) {
  const qr = conn.createQueryRunner();
  await qr.connect();
  for (const m of migrationObjs) {
    await m.up(qr);
  }
  await qr.release();
}

function randomHexValue() {
  return randomBytes(8)
    .toString('hex')
    .toLowerCase()
}

function toDbKey(dbAlias: string) {
  return `db:${dbAlias}`;
}

function fromDbKey(dbAlias: string) {
  return dbAlias.substr('db:'.length);
}

function isDbKey(dbAlias: string) {
  return dbAlias.startsWith('db:');
}

export async function getAliases(email: string, uid: string) {
  const ipUser = await IronPlans.getNewOrExistingUser(email, uid);
  const metadata: any = await IronPlans.getTeamMetadata(ipUser.teamId);
  return Object.keys(metadata).filter(isDbKey).map(fromDbKey);
}

// returns unique db id
export async function newId(dbAlias: string, email: string, uid: string): Promise<string> {
  const ipUser = await IronPlans.getNewOrExistingUser(email, uid);
  const dbId = `_${randomHexValue()}`;
  const metadata: any = await IronPlans.getTeamMetadata(ipUser.teamId);
  const key = toDbKey(dbAlias);
  if (metadata.hasOwnProperty(key)) {
    throw new Error(`db with alias ${dbAlias} already defined`)
  }
  metadata[key] = dbId;
  await IronPlans.setTeamMetadata(ipUser.teamId, metadata);
  return dbId;
}

export async function getId(dbAlias: string, email: string, uid: string) {
  const ipUser = await IronPlans.getNewOrExistingUser(email, uid);
  const metadata: any = await IronPlans.getTeamMetadata(ipUser.teamId);
  return metadata[toDbKey(dbAlias)];
}

export async function delId(dbAlias: string, email: string, uid: string) {
  const ipUser = await IronPlans.getNewOrExistingUser(email, uid);
  const metadata: any = await IronPlans.getTeamMetadata(ipUser.teamId);
  delete metadata[toDbKey(dbAlias)];
  await IronPlans.setTeamMetadata(ipUser.teamId, metadata);
}