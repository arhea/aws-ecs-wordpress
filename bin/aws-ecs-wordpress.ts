#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsEcsWordpressStack } from '../lib/aws-ecs-wordpress-stack';

const app = new cdk.App();
new AwsEcsWordpressStack(app, 'AwsEcsWordpressStack');
