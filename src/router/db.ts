import * as express from 'express'

import * as iasql from '../services/iasql'
import { handleErrorMessage } from '.'

export const db = express.Router();

db.post('/new', async (req, res) => {
  console.log('Calling /new');
  const {dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(await iasql.add(dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.post('/import', async (req, res) => {
  console.log('Calling /import');
  const {dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dump || !dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dump', 'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(
      await iasql.load(dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, req.user)
    );
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.post('/export', async (req, res) => {
  console.log('Calling /export');
  const { dbAlias, } = req.body;
  if (!dbAlias) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dbAlias',
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(await iasql.dump(dbAlias, req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.get('/list', async (req, res) => {
  try {
    res.json(await iasql.list(req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.get('/remove/:dbAlias', async (req, res) => {
  try {
    res.json(await iasql.remove(req.params.dbAlias, req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.post('/apply', async (req, res) => {
  const { dbAlias, dryRun } = req.body;
  try {
    res.json(await iasql.apply(dbAlias, dryRun, req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});

db.post('/sync', async (req, res) => {
  const { dbAlias, dryRun } = req.body;
  try {
    res.json(await iasql.sync(dbAlias, dryRun, req.user));
  } catch (e) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  }
});