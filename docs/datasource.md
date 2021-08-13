## Datasource
When creating a datasource, pay attention to the config params, they are different from other common datasources
especially if you choose to use IAM authentication, here are the options:
- **name**: The name of your datasource, you can enter any string name here.
- **connector**: use `loopback-connector-neptune` if you are using the connector from GitHub, and `neptune` if you 
  installed it from `npm`.
- **url**: This param overrides `host` and `port`, and can only be used without IAM authentication. The url must have 
  protocol, host, port and path like this `wss://neptune-99999.us-east-1.elb.amazonaws.com:8182/gremlin`
- **host**: It must contain only the domain i.e. `neptune-99999.us-east-1.elb.amazonaws.com`. By default the protocol 
  `wss` is used. This is a required param for IAM authentication.
- **port**: Must contain only number, usually `8182`.
- **iam**: Boolean, enabling `true` or disabling `false` IAM authentication. We use 
  [Signature Version 4 Signing](https://docs.aws.amazon.com/neptune/latest/userguide/get-started-connect-iam.html) 
  library to authenticate.
- **database**: Database name as string.
- **transactionClearTimeout**: As transaction operations on Neptune uses 
  [Multithreaded Gremlin Writes](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-gremlin-multithreaded-writes.html)
  all steps must be stores locally before sending all of them at once to the server. Doing this we can have memory 
  issues in our connector. To avoid this problem the connector has an internal timeout to clean up transaction steps
  in case of commit or rollback isn't called. Loopback has an independent timeout controls for transaction timeouts, 
  but if you don't input a timeout on transactions it has no default value. To workaround this problem we set a default
  timeout to `5000` ms. If you used to run slower queries with transactions enabled, you can increment this value through
  `transactionClearTimeout`, if 5 seconds is enough please remove this params from your config.
- **user**: User is optional and NOT supported by Neptune, you can use it when connecting to other OLTP databases.
- **password**: Password is optional and NOT supported by Neptune, you can use it when connecting to other OLTP databases.

### Datasource example
```typescript
import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'neptune',
  connector: 'loopback-connector-neptune',
  url: 'wss://neptune-99999.us-east-1.elb.amazonaws.com:8182/gremlin',
  host: 'neptune-99999.us-east-1.elb.amazonaws.com',
  port: 8182,
  iam: true,
  database: 'myDatabase',
  transactionClearTimeout: 5000
};

@lifeCycleObserver('datasource')
export class NeptuneDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'neptune';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.neptune', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
```

### Keep reading
- 1 - Datasource
- 2 - [Models](models.md)
- 3 - [Repositories](repositories.md)
- 4 - [CRUD methods](crud.md)
- 5 - [Direct Query Execution (Gremlin Bytecode)](bytecode.md)
- 6 - [Transaction](transaction.md)

[Back](https://github.com/wesleymilan/loopback-connector-neptune)
