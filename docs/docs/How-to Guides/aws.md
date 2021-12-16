---
sidebar_position: 2
slug: '/aws'
---

# Manage an AWS Account

IaSQL requires cloud credentials to manage and provision resources. First, make sure you have an [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) in the [AWS console](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_console) with **Programmatic access** and ensure it has sufficient permissions to deploy and manage your program’s resources. 

There are two parts to each [access key](https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html#access-keys-and-secret-access-keys), which you’ll see in the IAM console after you create it, an id and a secret. If you have previously installed and configured the AWS CLI, IaSQL will respect and use your configuration settings.

## Create a shared credentials file

A credentials file is a plaintext file on your machine that contains your access keys. The file must be named `credentials` and is located underneath `.aws/` directory in your home directory.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Option 1: Use the CLI" label="Option 1: Use the CLI" default>

  To create this file using the CLI, [install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). If you’re using Homebrew on macOS, you can use [awscli](https://formulae.brew.sh/formula/awscli) via `brew install awscli`.

  After installing the CLI, configure it with your IAM credentials, typically using the `aws configure` command. For other configuration options, see the AWS article [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

  ```bash
  $ aws configure
  AWS Access Key ID [None]: <YOUR_ACCESS_KEY_ID>
  AWS Secret Access Key [None]: <YOUR_SECRET_ACCESS_KEY>
  Default region name [None]:
  Default output format [None]:
  ```
  Now you’ve created the `~/.aws/credentials` file and populated it with the expected settings.

  </TabItem>
  <TabItem value="Option 2: Create manually" label="Option 2: Create manually">

  You can also create the shared credentials file manually in the correct location:

  ```bash
  [default]
  aws_access_key_id = <YOUR_ACCESS_KEY_ID>
  aws_secret_access_key = <YOUR_SECRET_ACCESS_KEY>
  ```

  </TabItem>
</Tabs>