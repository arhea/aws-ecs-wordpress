import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsManager from 'aws-cdk-lib/aws-secretsmanager'
import * as iam from 'aws-cdk-lib/aws-iam';

export class AwsEcsWordpressStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create the vpc
    const vpc = new ec2.Vpc(this, 'VPC');
    
    // create the ecs cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
    });

    // create wordpress secrets
    const secretDatabaseCredentials = new secretsManager.Secret(this, 'DatabaseCredentials', {
      generateSecretString: {
        passwordLength: 30,
        excludePunctuation: true,
        includeSpace: false
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretAuthKey = new secretsManager.Secret(this, 'AuthKey', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretSecureAuthKey = new secretsManager.Secret(this, 'SecureAuthKey', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretLoggedInKey = new secretsManager.Secret(this, 'LoggedInKey', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretNonceKey = new secretsManager.Secret(this, 'NonceKey', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretAuthSalt = new secretsManager.Secret(this, 'AuthSalt', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretSecureAuthSalt = new secretsManager.Secret(this, 'SecureAuthSalt', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretLoggedInSalt = new secretsManager.Secret(this, 'LoggedInSalt', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const secretNonceSalt = new secretsManager.Secret(this, 'NonceSalt', {
      generateSecretString: {
        excludeCharacters: '\'"',
        passwordLength: 64
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    let clusterEngine = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_03_0
    });

    // create the aurora mysql database
    const db = new rds.DatabaseCluster(this, 'Database', {
      engine: clusterEngine,
      defaultDatabaseName: 'wordpress',
      credentials: {
        username: 'admin',
        password: cdk.SecretValue.secretsManager(secretDatabaseCredentials.secretArn)
      },
      instanceProps: {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // create the shared file system
    const fsSecurityGroup = new ec2.SecurityGroup(this, 'EfsSecurityGroup', {
      vpc,
      description: 'allow access to the efs file system',
      allowAllOutbound: true
    });

    const fileSystem = new efs.FileSystem(this, 'Content', {
      vpc,
      encrypted: true,
      securityGroup: fsSecurityGroup,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // configure the wordpress task
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'))
    secretDatabaseCredentials.grantRead(taskExecutionRole);
    secretAuthKey.grantRead(taskExecutionRole);
    secretSecureAuthKey.grantRead(taskExecutionRole);
    secretLoggedInKey.grantRead(taskExecutionRole);
    secretNonceKey.grantRead(taskExecutionRole);
    secretAuthSalt.grantRead(taskExecutionRole);
    secretSecureAuthSalt.grantRead(taskExecutionRole);
    secretLoggedInSalt.grantRead(taskExecutionRole);
    secretNonceSalt.grantRead(taskExecutionRole);

    const taskSecurityGroup = new ec2.SecurityGroup(this, 'TaskSecurityGroup', {
      vpc,
      description: 'allow access to the task',
      allowAllOutbound: true
    });

    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: 'wordpress',
      executionRole: taskExecutionRole,
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // workaround for in progress support of EFS in CDK
    const cfnTask = taskDef.node.defaultChild as ecs.CfnTaskDefinition;

    cfnTask.addPropertyOverride('Volumes', [{
      Name: 'wp-content',
      EFSVolumeConfiguration: {
          FilesystemId: fileSystem.fileSystemId,
          TransitEncryption: 'ENABLED'
      },
    }]);

    // add the container to the task definition
    const container = taskDef.addContainer('Wordpress', {
      image: ecs.ContainerImage.fromRegistry('wordpress:6.2.0-apache'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'Wordpress' }),
      memoryLimitMiB: 1024,
      cpu: 512,
      environment: {
        WORDPRESS_DB_HOST: db.clusterEndpoint.socketAddress,
        WORDPRESS_DB_NAME: 'wordpress',
        WORDPRESS_DB_USER: 'admin'
      },
      secrets: {
        WORDPRESS_DB_PASSWORD: ecs.Secret.fromSecretsManager(secretDatabaseCredentials),
        WORDPRESS_AUTH_KEY: ecs.Secret.fromSecretsManager(secretSecureAuthKey),
        WORDPRESS_SECURE_AUTH_KEY: ecs.Secret.fromSecretsManager(secretSecureAuthKey),
        WORDPRESS_LOGGED_IN_KEY: ecs.Secret.fromSecretsManager(secretLoggedInKey),
        WORDPRESS_NONCE_KEY: ecs.Secret.fromSecretsManager(secretNonceKey),
        WORDPRESS_AUTH_SALT: ecs.Secret.fromSecretsManager(secretAuthSalt),
        WORDPRESS_SECURE_AUTH_SALT: ecs.Secret.fromSecretsManager(secretSecureAuthSalt),
        WORDPRESS_LOGGED_IN_SALT: ecs.Secret.fromSecretsManager(secretLoggedInSalt),
        WORDPRESS_NONCE_SALT: ecs.Secret.fromSecretsManager(secretNonceSalt)
      }
    });

    container.addPortMappings({
      containerPort: 80
    });

    container.addMountPoints({
      sourceVolume: 'wp-content',
      containerPath: '/var/www/html/wp-content',
      readOnly: false
    });

    // create the wordpress service
    const wordpress = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
    });

    wordpress.service.connections.addSecurityGroup(taskSecurityGroup);

    wordpress.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 10,
    });

    wordpress.targetGroup.configureHealthCheck({
      enabled: true,
      path: '/index.php',
      healthyHttpCodes: '200,201,302',
      interval: cdk.Duration.seconds(15),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 3,
      unhealthyThresholdCount: 2
    });

    // configure security groups
    db.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(3306), 'allow connections from within the vpc to the database')
    fsSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(2049), 'allow access to the efs file mounts')

  }
}
