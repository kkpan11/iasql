import config from "../../src/config";
import * as iasql from "../../src/services/iasql";
import {
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  getPrefix,
} from "../helpers";

const prefix = getPrefix();
const dbAlias = "elasticachetest";
const clusterId = `${prefix}${dbAlias}`;
const newClusterId = `new-${prefix}${dbAlias}`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ["aws_elasticache"];

jest.setTimeout(620000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe("Elasticache Integration Testing", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it(
    "inserts aws credentials",
    query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `)
  );

  it("installs the elasticache module", install(modules));

  it(
    "adds a new cacheCluster",
    query(`  
    INSERT INTO cache_cluster (cluster_id)
    VALUES ('${clusterId}');
  `)
  );

  it("undo changes", sync());

  it(
    "adds a new cacheCluster",
    query(`  
    INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes)
    VALUES ('${clusterId}', 'cache.t2.micro', 'redis', 1);
  `)
  );

  it("applies the cache_cluster change", apply());

  it(
    "check cache_cluster is available",
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update cache_cluster node type",
    query(`
  UPDATE cache_cluster SET node_type='cache.t2.small' WHERE cluster_id='${clusterId}'
  `)
  );

  it("applies the cache_cluster node_type update", apply());

  it(
    "checks that cache_cluster have been modified",
    query(
      `
  SELECT * FROM cache_cluster WHERE node_type='cache.t2.small';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update cache_cluster engine",
    query(`
  UPDATE cache_cluster SET engine='memcached' WHERE cluster_id='${clusterId}'
  `)
  );

  it("applies the cache_cluster engine update", apply());

  it(
    "checks that cache_cluster engine has not been modified",
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}' AND engine='redis';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "checks that cache_cluster with new engine does not exist",
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}' AND engine='memcached';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it(
    "tries to update cache_cluster id",
    query(`
  UPDATE cache_cluster SET cluster_id='${newClusterId}' WHERE cluster_id='${clusterId}'
  `)
  );

  it("applies the cache_cluster cluster_id update", apply());

  it(
    "checks that cache_cluster cluster_id have been modified",
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${newClusterId}';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "checks that older cache_cluster cluster_id does not exist",
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it("uninstalls the elasticache module", uninstall(modules));

  it(
    "installs the elasticache module again (to make sure it reloads stuff)",
    install(modules)
  );

  it(
    "checks cache_cluster count",
    query(
      `
    SELECT * FROM cache_cluster WHERE cluster_id='${newClusterId}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "deletes the cache_cluster",
    query(`
    DELETE FROM cache_cluster
    WHERE cluster_id = '${newClusterId}';
  `)
  );

  it("applies the cache_cluster removal", apply());

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});

describe("Elasticache install/uninstall", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it(
    "inserts aws credentials",
    query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `)
  );

  it("installs the Elasticache module", install(modules));

  it("uninstalls the Elasticache module", uninstall(modules));

  it("installs all modules", (done) =>
    void iasql
      .install([], dbAlias, config.db.user, true)
      .then(...finish(done)));

  it("uninstalls the Elasticache module", uninstall(["aws_elasticache"]));

  it("installs the Elasticache module", install(["aws_elasticache"]));

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});