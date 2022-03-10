import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AwsContainerDefinition } from '.';

export enum TaskDefinitionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE"
}

export enum CpuMemCombination {
  "0.25vCPU-0.5GB" = "0.25vCPU-0.5GB",
  "0.25vCPU-1GB" = "0.25vCPU-1GB",
  "0.25vCPU-2GB" = "0.25vCPU-2GB",
  "0.5vCPU-1GB" = "0.5vCPU-1GB",
  "0.5vCPU-2GB" = "0.5vCPU-2GB",
  "0.5vCPU-3GB" = "0.5vCPU-3GB",
  "0.5vCPU-4GB" = "0.5vCPU-4GB",
  "1vCPU-2GB" = "1vCPU-2GB",
  "1vCPU-3GB" = "1vCPU-3GB",
  "1vCPU-4GB" = "1vCPU-4GB",
  "1vCPU-5GB" = "1vCPU-5GB",
  "1vCPU-6GB" = "1vCPU-6GB",
  "1vCPU-7GB" = "1vCPU-7GB",
  "1vCPU-8GB" = "1vCPU-8GB",
  "2vCPU-4GB" = "2vCPU-4GB",
  "2vCPU-5GB" = "2vCPU-5GB",
  "2vCPU-6GB" = "2vCPU-6GB",
  "2vCPU-7GB" = "2vCPU-7GB",
  "2vCPU-8GB" = "2vCPU-8GB",
  "2vCPU-9GB" = "2vCPU-9GB",
  "2vCPU-10GB" = "2vCPU-10GB",
  "2vCPU-11GB" = "2vCPU-11GB",
  "2vCPU-12GB" = "2vCPU-12GB",
  "2vCPU-13GB" = "2vCPU-13GB",
  "2vCPU-14GB" = "2vCPU-14GB",
  "2vCPU-15GB" = "2vCPU-15GB",
  "2vCPU-16GB" = "2vCPU-16GB",
  "4vCPU-8GB" = "4vCPU-8GB",
  "4vCPU-9GB" = "4vCPU-9GB",
  "4vCPU-10GB" = "4vCPU-10GB",
  "4vCPU-11GB" = "4vCPU-11GB",
  "4vCPU-12GB" = "4vCPU-12GB",
  "4vCPU-13GB" = "4vCPU-13GB",
  "4vCPU-14GB" = "4vCPU-14GB",
  "4vCPU-15GB" = "4vCPU-15GB",
  "4vCPU-16GB" = "4vCPU-16GB",
  "4vCPU-17GB" = "4vCPU-17GB",
  "4vCPU-18GB" = "4vCPU-18GB",
  "4vCPU-19GB" = "4vCPU-19GB",
  "4vCPU-20GB" = "4vCPU-20GB",
  "4vCPU-21GB" = "4vCPU-21GB",
  "4vCPU-22GB" = "4vCPU-22GB",
  "4vCPU-23GB" = "4vCPU-23GB",
  "4vCPU-24GB" = "4vCPU-24GB",
  "4vCPU-25GB" = "4vCPU-25GB",
  "4vCPU-26GB" = "4vCPU-26GB",
  "4vCPU-27GB" = "4vCPU-27GB",
  "4vCPU-28GB" = "4vCPU-28GB",
  "4vCPU-29GB" = "4vCPU-29GB",
  "4vCPU-30GB" = "4vCPU-30GB"
}

@Entity()
export class AwsTaskDefinition {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  taskDefinitionArn?: string;

  @Column()
  family: string;

  @Column({
    nullable: true,
    type: 'int',
  })
  revision?: number;

  @Column({
    nullable: true,
  })
  taskRoleArn?: string;

  @Column({
    nullable: true,
  })
  executionRoleArn?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: TaskDefinitionStatus,
  })
  status?: TaskDefinitionStatus;

  @Column({
    nullable: true,
    type: 'enum',
    enum: CpuMemCombination,
  })
  cpuMemory: CpuMemCombination;

  @OneToMany(() => AwsContainerDefinition, c => c.taskDefinition)
  containerDefinitions: AwsContainerDefinition[];

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}