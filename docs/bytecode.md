# Direct Query Execution (Gremlin Bytecode)

[Gremlin Traversal Steps](http://tinkerpop.apache.org/docs/current/reference/#graph-traversal-steps) are the best way 
to use a GraphDB in full capacity. This document shows you how to use Gremlin inside your repositories to run 
direct queries against AWS Neptune.

[Gremlin for Javascript](https://www.npmjs.com/package/gremlin) convert commands into bytecode. With that you can
write complex and platform agnostic queries to efficiently navigate highly connected datasets, and use those data 
for social platforms, machine learning, and many other applications that requires complex related data. 

Gremlin uses some stand-alone methods as part of its query language. In a standard Javascript file using Gremlin 
your code could look like this:
```javascript
import gremlin from 'gremlin';
const { t: { id } } = gremlin.process;
const { P: { eq, neq, lt, lte, gt, gte, inside, outside, between, within, without } } = gremlin.process;
const { TextP: { startingWith, endingWith, containing, notStartingWith, notEndingWith, notContaining } } = gremlin.process;
const { order: { asc, desc } } = gremlin.process;
const { cardinality: { single } } = gremlin.process;
const __ = gremlin.process.statics;
```
Using Loopback Neptune Connector your repository will look like this:
```typescript
import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {NeptuneDataSource} from '../datasources';
import {People, PeopleRelations} from '../models';

export class PeopleRepository extends DefaultCrudRepository<
  People,
  typeof People.prototype.id,
  PeopleRelations
> {
  g;
  P;
  order;

  constructor(
    @inject('datasources.neptune') dataSource: NeptuneDataSource
  ) {
    super(People, dataSource);

    this.g = this.dataSource.connector?.g;
    this.P = this.dataSource.connector?.process.P;
    this.order = this.dataSource.connector?.process.order;
  }

  async findFollower(userId: string) {
    return this.g.V(userId).hasLabel('People').out('Follow').path().toList();
  }
  
  async findFollowerGreaterThanAgePromise(age: number) {
    const promise = this.g.V().hasLabel('People').out("Follow").has('age', this.P.gt(age)).elementMap().dedup().order().by('age', this.order.asc).toList();
    const res = await this.execute(promise);
    return res;
  }

  async findFollowerGreaterThanAgeBytecode(age: number) {
    const bytecode = this.g.V().hasLabel('People').out("Follow").has('age', this.P.gt(age)).elementMap().dedup().order().by('age', this.order.asc);
    const res = await this.execute(bytecode, null, { method: 'toList' });
    return res;
  }

}
```
Here is the full list of classes you can pull into your repository to use in your Gremlin Queries:
```typescript
this.g = this.dataSource.connector?.g;
this.statics = this.dataSource.connector?.process.statics;
this.EnumValue = this.dataSource.connector?.process.EnumValue;
this.P = this.dataSource.connector?.process.P;
this.TextP = this.dataSource.connector?.process.TextP;
this.Traversal = this.dataSource.connector?.process.Traversal;
this.TraversalSideEffects = this.dataSource.connector?.process.TraversalSideEffects;
this.TraversalStrategies = this.dataSource.connector?.process.TraversalStrategies;
this.TraversalStrategy = this.dataSource.connector?.process.TraversalStrategy;
this.Traverser = this.dataSource.connector?.process.Traverser;
this.barrier = this.dataSource.connector?.process.barrier;
this.cardinality = this.dataSource.connector?.process.cardinality;
this.column = this.dataSource.connector?.process.column;
this.direction = this.dataSource.connector?.process.direction;
this.operator = this.dataSource.connector?.process.operator;
this.order = this.dataSource.connector?.process.order;
this.pick = this.dataSource.connector?.process.pick;
this.pop = this.dataSource.connector?.process.pop;
this.scope = this.dataSource.connector?.process.scope;
this.t = this.dataSource.connector?.process.t;
this.GraphTraversal = this.dataSource.connector?.process.GraphTraversal;
this.GraphTraversalSource = this.dataSource.connector?.process.GraphTraversalSource;
this.traversal = this.dataSource.connector?.process.traversal;
this.withOptions = this.dataSource.connector?.process.withOptions;
```
To learn about what all these classes are for look at [Gremlin Docs](https://tinkerpop.apache.org/docs/current/reference/). 
Not all of these classes and methods are supported by AWS Neptune, but they are available in case you want to use 
this library to connect to any other Gremlin Compatible GraphDB. For more information please look at 
[AWS Neptune Docs](https://docs.aws.amazon.com/neptune/latest/userguide/intro.html).

### Keep reading
- 1 - [Datasource](datasource.md)
- 2 - [Models](models.md)
- 3 - [Repositories](repositories.md)
- 4 - [CRUD methods](crud.md)
- 5 - Direct Query Execution (Gremlin Bytecode)
- 6 - [Transaction](transaction.md)

[Back](https://github.com/wesleymilan/loopback-connector-neptune)
