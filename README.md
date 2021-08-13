# Loopback 4 Connector for AWS Neptune

Loopback 4 connector for AWS Neptune using Gremlin Graph Query Language.

This connector has the intent of connecting [Loopback](https://loopback.io/doc/en/lb4/index.html) to 
[AWS Neptune](https://docs.aws.amazon.com/neptune/latest/userguide/intro.html) and use the Loopback ORM language to 
facilitate the use of basic operations like Create, Update and Delete. It also allows the use of audit layers and 
middlewares when using CRUD methods.

This connector allows you to run direct queries (raw queries) using Gremlin bytecode format with 
[Graph Traversal Steps](http://tinkerpop.apache.org/docs/current/reference/#graph-traversal-steps). 
It doesn't support Gremlin script execution in order to avoid injections.

It uses non-authenticated connection and IAM authentication method. You can also use this to connect to other Gremlin
based GraphDB's, but it wasn't tested, so, be careful. The code used for IAM authentication was based on 
[Lambda Example](https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html) from AWS Neptune
documentation.

It does support Neptune "transactions", which is called **Multithreaded Gremlin Writes** and runs internally in 
Neptune engine, it's NOT the standard Gremlin transaction, please read 
[Neptune documentation](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-gremlin-multithreaded-writes.html) 
to understand what it means.

## Installing
```shell
npm install loopback-connector-neptune
```

## Gremlin Client Version
The Gremlin Client Version is important for Neptune compatibility as you can read at 
[Neptune engine version Docs](https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-gremlin-client.html).
We're using Gremlin `^3.4.12`.

## Setup
Please read and follow each step of setup because all parameters must be present to have the connector working 
properly with GraphDB Neptune.
- 1 - [Datasource](docs/datasource.md)
- 2 - [Models](docs/models.md)
- 3 - [Repositories](docs/repositories.md)
- 4 - [CRUD methods](docs/crud.md)
- 5 - [Direct Query Execution (Gremlin Bytecode)](docs/bytecode.md)
- 6 - [Transaction](docs/transaction.md)

## Debugging
```shell
DEBUG=loopback:connector:neptune npm start
```

## Tests
You can find all tests and code examples at [Loopback Neptune Connector Test Kit Repository]() which has a Docker
environment to run functional tests using [Apache TinkerPop](http://tinkerpop.apache.org/). Note that Apache TinkerPop
doesn't have the exactly same behavior of AWS Neptune, there are some limitations you must validate running the tests
against a real Neptune instance. Please follow the instructions on Test Kit Repository of how to do that.

## License
This connector is under MIT license which means, you can modify and distribute since your code is OpenSource and free
for use by anyone.

## Contributions
There are so many other tests to be created and issues to be fixed especially when new Neptune versions are released.
Create a fork, do your improvements with well done comments and documentation if needed, create a pull request, and 
the community will be eternally grateful for your help ;)

