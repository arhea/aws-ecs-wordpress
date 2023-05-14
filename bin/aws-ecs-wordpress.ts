#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsEcsWordpressStack } from '../lib/aws-ecs-wordpress-stack';

const app = new cdk.App();

// Configure the stack to use the default AWS profile
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
};

new AwsEcsWordpressStack(app, 'AwsEcsWordpressStack', { env });
