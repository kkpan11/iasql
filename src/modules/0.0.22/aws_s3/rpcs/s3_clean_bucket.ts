import { S3, _Object } from '@aws-sdk/client-s3';

import { AwsS3Module } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class S3CleanBucketRpc extends RpcBase {
  module: AwsS3Module;
  outputTable = {
    bucket: 'varchar',
    status: 'varchar',
    response_message: 'varchar',
  } as const;

  getBucketObjects = crudBuilderFormat<S3, 'listObjectsV2', _Object[]>(
    'listObjectsV2',
    bucketName => ({ Bucket: bucketName }),
    res => res?.Contents ?? [],
  );
  deleteBucketObject = crudBuilder2<S3, 'deleteObject'>('deleteObject', (bucketName, key) => ({
    Bucket: bucketName,
    Key: key,
  }));

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    bucketName: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // we need to have bucket name as first element of params
    if (!bucketName) {
      return [
        {
          bucket: 'none',
          status: 'KO',
          response_message: 'Please send the bucket name as first parameter of the query',
        },
      ];
    }
    const client = (await ctx.getAwsClient()) as AWS;
    const objects = await this.getBucketObjects(client.s3Client, bucketName);
    for (const object of objects) {
      // delete the object
      await this.deleteBucketObject(client.s3Client, bucketName, object.Key);
    }

    // query again to see if all objects have been deleted
    const remainingObjects = await this.getBucketObjects(client.s3Client, bucketName);
    if (!remainingObjects.length) {
      return [
        {
          bucket: bucketName,
          status: 'OK',
          response_message: 'All bucket objects have been deleted',
        },
      ];
    } else {
      return [
        {
          bucket: bucketName,
          status: 'KO',
          response_message: 'There are remaining objects that could not be deleted',
        },
      ];
    }
  };

  constructor(module: AwsS3Module) {
    super();
    this.module = module;
    super.init();
  }
}