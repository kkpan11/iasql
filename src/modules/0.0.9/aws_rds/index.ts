import { CreateDBInstanceCommandInput, CreateDBParameterGroupCommandInput, DBParameterGroup, ModifyDBInstanceCommandInput, Parameter } from '@aws-sdk/client-rds'

import { AWS, } from '../../../services/gateways/aws_2'
import { ParameterGroup, ParameterGroupFamily, RDS, } from './entity'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { AwsSecurityGroupModule } from '..'
import * as metadata from './module.json'

interface DBParameterGroupWParameters extends DBParameterGroup {
  Parameters:  Parameter[];
}

export const AwsRdsModule: Module2 = new Module2({
  ...metadata,
  utils: {
    rdsMapper: async (rds: any, ctx: Context) => {
      const out = new RDS();
      out.allocatedStorage = rds?.AllocatedStorage;
      out.availabilityZone = rds?.AvailabilityZone;
      out.dbInstanceClass = rds?.DBInstanceClass;
      out.dbInstanceIdentifier = rds?.DBInstanceIdentifier;
      out.endpointAddr = rds?.Endpoint?.Address;
      out.endpointHostedZoneId = rds?.Endpoint?.HostedZoneId;
      out.endpointPort = rds?.Endpoint?.Port;
      out.engine = `${rds?.Engine}:${rds?.EngineVersion}`;
      out.masterUsername = rds?.MasterUsername;
      const vpcSecurityGroupIds = rds?.VpcSecurityGroups?.filter((vpcsg: any) => !!vpcsg?.VpcSecurityGroupId).map((vpcsg: any) => vpcsg?.VpcSecurityGroupId);
      out.vpcSecurityGroups = [];
      for (const sgId of vpcSecurityGroupIds) {
        const sg = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId) ??
          await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sgId);
        if (sg) out.vpcSecurityGroups.push(sg);
      }
      out.backupRetentionPeriod = rds?.BackupRetentionPeriod ?? 1;
      if (rds.DBParameterGroups?.length) {
        const parameterGroup = rds.DBParameterGroups[0];
        out.parameterGroup = await AwsRdsModule.mappers.parameterGroup.db.read(ctx, parameterGroup.DBParameterGroupName) ??
          await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, parameterGroup.DBParameterGroupName);
      }
      return out;
    },
    parameterGroupMapper: (pg: DBParameterGroupWParameters) => {
      const out = new ParameterGroup();
      out.arn = pg?.DBParameterGroupArn;
      out.description = pg?.Description ?? '';
      out.family = pg.DBParameterGroupFamily as ParameterGroupFamily ?? '';
      out.name = pg.DBParameterGroupName ?? '';
      out.parameters = pg.Parameters;
      return out;
    },
    getParametersNotEqual: (a: Parameter[], b: Parameter[]) => {
      const parameters: Parameter[] = [];
      a?.forEach(ap => {
        const bParam = b?.find(bp => Object.is(ap.ParameterName, bp.ParameterName));
        if (!bParam || !(Object.is(ap.AllowedValues, bParam.AllowedValues)
          && Object.is(ap.ApplyMethod, bParam.ApplyMethod)
          && Object.is(ap.ApplyType, bParam.ApplyType)
          && Object.is(ap.DataType, bParam.DataType)
          && Object.is(ap.Description, bParam.Description)
          && Object.is(ap.IsModifiable, bParam.IsModifiable)
          && Object.is(ap.MinimumEngineVersion, bParam.MinimumEngineVersion)
          && Object.is(ap.ParameterValue, bParam.ParameterValue)
          && Object.is(ap.Source, bParam.Source))) {
            parameters.push(ap);
        }
      });
      return parameters;
    },
  },
  mappers: {
    rds: new Mapper2<RDS>({
      entity: RDS,
      equals: (a: RDS, b: RDS) => Object.is(a.engine, b.engine)
        && Object.is(a.dbInstanceClass, b.dbInstanceClass)
        && Object.is(a.availabilityZone, b.availabilityZone)
        && Object.is(a.dbInstanceIdentifier, b.dbInstanceIdentifier)
        && Object.is(a.endpointAddr, b.endpointAddr)
        && Object.is(a.endpointHostedZoneId, b.endpointHostedZoneId)
        && Object.is(a.endpointPort, b.endpointPort)
        && !a.masterUserPassword  // Special case, if master password defined, will update the instance password
        && Object.is(a.masterUsername, b.masterUsername)
        && Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length)
        && (a.vpcSecurityGroups?.every(asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
        && Object.is(a.allocatedStorage, b.allocatedStorage)
        && Object.is(a.backupRetentionPeriod, b.backupRetentionPeriod)
        && Object.is(a.parameterGroup?.arn, b.parameterGroup?.arn),
      source: 'db',
      cloud: new Crud2({
        create: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const securityGroupIds = e.vpcSecurityGroups?.map(sg => {
              if (!sg.groupId) throw new Error('Security group needs to exist')
              return sg.groupId;
            }) ?? []
            const [Engine, EngineVersion] = e.engine.split(':');
            const instanceParams: CreateDBInstanceCommandInput = {
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              DBInstanceClass: e.dbInstanceClass,
              Engine,
              EngineVersion,
              MasterUsername: e.masterUsername,
              MasterUserPassword: e.masterUserPassword,
              AllocatedStorage: e.allocatedStorage,
              VpcSecurityGroupIds: securityGroupIds,
              AvailabilityZone: e.availabilityZone,
              BackupRetentionPeriod: e.backupRetentionPeriod,
            };
            if (e.parameterGroup) {
              instanceParams.DBParameterGroupName = e.parameterGroup.name;
            }
            const result = await client.createDBInstance(instanceParams);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('DBInstanceIdentifier')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getDBInstance(result.DBInstanceIdentifier ?? '');
            // We need to update the parameter groups if its a default one and it does not exists
            const parameterGroupName = newObject.DBParameterGroups?.[0].DBParameterGroupName;
            if (!(await AwsRdsModule.mappers.parameterGroup.db.read(ctx, parameterGroupName))) {
              const cloudParameterGroup = await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, parameterGroupName);
              await AwsRdsModule.mappers.parameterGroup.db.create(cloudParameterGroup, ctx);
            }
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsRdsModule.utils.rdsMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Set password as null to avoid infinite loop trying to update the password.
            // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
            newEntity.masterUserPassword = null;
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.rds.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawRds = await client.getDBInstance(id);
            if (!rawRds) return;
            return await AwsRdsModule.utils.rdsMapper(rawRds, ctx);
          } else {
            const rdses = (await client.getDBInstances()).DBInstances;
            const out = [];
            for (const rds of rdses) {
              out.push(await AwsRdsModule.utils.rdsMapper(rds, ctx));
            }
            return out;
          }
        },
        updateOrReplace: () => 'update',
        update: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.RDS?.[e.dbInstanceIdentifier ?? ''];
            let updatedRecord = { ...cloudRecord };
            if (!(Object.is(e.dbInstanceClass, cloudRecord.dbInstanceClass)
              && Object.is(e.engine, cloudRecord.engine)
              && Object.is(e.allocatedStorage, cloudRecord.allocatedStorage)
              && !e.masterUserPassword
              && Object.is(e.vpcSecurityGroups.length, cloudRecord.vpcSecurityGroups.length)
              && (e.vpcSecurityGroups?.every(esg => !!cloudRecord.vpcSecurityGroups.find((csg: any) => Object.is(esg.groupId, csg.groupId))) ?? false))) {
                if (!e.vpcSecurityGroups?.filter(sg => !!sg.groupId).length) {
                  throw new Error('Waiting for security groups');
                }
              const instanceParams: ModifyDBInstanceCommandInput = {
                DBInstanceClass: e.dbInstanceClass,
                EngineVersion: e.engine.split(':')[1],
                DBInstanceIdentifier: e.dbInstanceIdentifier,
                AllocatedStorage: e.allocatedStorage,
                VpcSecurityGroupIds: e.vpcSecurityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!) ?? [],
                BackupRetentionPeriod: e.backupRetentionPeriod,
                ApplyImmediately: true,
              };
              // If a password value has been inserted, we update it.
              if (e.masterUserPassword) {
                instanceParams.MasterUserPassword = e.masterUserPassword;
              }
              const result = await client.updateDBInstance(instanceParams);
              const dbInstance = await client.getDBInstance(result?.DBInstanceIdentifier ?? '');
              updatedRecord = await AwsRdsModule.utils.rdsMapper(dbInstance, ctx);
            }
            // Restore autogenerated values
            updatedRecord.id = e.id;
            // Set password as null to avoid infinite loop trying to update the password.
            // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
            updatedRecord.masterUserPassword = null;
            await AwsRdsModule.mappers.rds.db.update(updatedRecord, ctx);
            out.push(updatedRecord);
          }
          return out;
        },
        delete: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const input = {
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              // TODO: do users will have access to this type of config?
              //        probably initially we should play it safe and do not create a snapshot
              //        and do not delete backups if any?
              SkipFinalSnapshot: true,
              // FinalDBSnapshotIdentifier: undefined,
              // DeleteAutomatedBackups: false,
            };
            await client.deleteDBInstance(input);
          }
        },
      }),
    }),
    parameterGroup: new Mapper2<ParameterGroup>({
      entity: ParameterGroup,
      equals: (a: ParameterGroup, b: ParameterGroup) => Object.is(a.arn, b.arn)
        && Object.is(a.family, b.family)
        && Object.is(a.description, b.description)
        && !AwsRdsModule.utils.getParametersNotEqual(a.parameters, b.parameters).length,
      source: 'db',
      cloud: new Crud2({
        create: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const parameterGroupInput: CreateDBParameterGroupCommandInput = {
              DBParameterGroupName: e.name,
              DBParameterGroupFamily: e.family,
              Description: e.description,
            };
            const result = await client.createDBParameterGroup(parameterGroupInput);
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getDBParameterGroup(result?.DBParameterGroupName ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = AwsRdsModule.utils.parameterGroupMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.parameterGroup.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const parameterGroup = await client.getDBParameterGroup(id);
            if (!parameterGroup) return;
            return AwsRdsModule.utils.parameterGroupMapper(parameterGroup, ctx);
          } else {
            const parameterGroups = await client.getDBParameterGroups();
            const out = [];
            for (const pg of parameterGroups) {
              out.push(AwsRdsModule.utils.parameterGroupMapper(pg, ctx));
            }
            return out;
          }
        },
        update: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.ParameterGroup?.[e.name ?? ''];
            let updatedRecord = { ...cloudRecord };
            const parametersNotEqual = AwsRdsModule.utils.getParametersNotEqual(e.parameters, cloudRecord.parameters);
            let anyUpdate = false;
            for (const p of parametersNotEqual ?? []) {
              if (p.IsModifiable) {
                const parameterInput = {
                  ParameterName: p.ParameterName,
                  ParameterValue: p.ParameterValue,
                  ApplyMethod: p.ApplyMethod,
                };
                await client.modifyParameter(e.name, parameterInput);
                anyUpdate = true;
              }
            }
            if (anyUpdate) {
              // Delete record from memo since we want a fresh read from cloud
              delete ctx?.memo?.cloud?.ParameterGroup?.[e.name ?? ''];
              updatedRecord = await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, e.name);
            }
            await AwsRdsModule.mappers.parameterGroup.db.update(updatedRecord, ctx);
            out.push(updatedRecord);
          }
          return out;
        },
        delete: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteDBParameterGroup(e.name);
          }
        },
      }),
    }),
  },
}, __dirname);