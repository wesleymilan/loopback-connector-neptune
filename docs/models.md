# Models
Models are the most critic component, please pay especial attention to model `settings` as described below:
- type: It can be `vertex` or `edge`.
- retry: Neptune can return temporary errors based on some different reasons as you can see at 
  [AWS docs](https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html). These requests can
  be automatically retried.
    - max: Max number retries. Default is `3`.
    - delay: Time to wait between each try in milliseconds. Default is `100` ms.
  
### Model example
```typescript
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    type: 'vertex',
    retry: {
      max: 5,
      delay: 100
    }
  }
})
export class People extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  constructor(data?: Partial<People>) {
    super(data);
  }
}

export interface PeopleRelations {
  // describe navigational properties here
}

export type PeopleWithRelations = People & PeopleRelations;
```

## ID
This connector only support one primary key (index), and it MUST be called `id` immutably.

## Edge models
In edge models you MUST inform two additional fields called `from` and `to`. You can use any property name, but the 
database column name is immutable. See the examples below:
```typescript
@property({
    type: 'string',
    required: true,
    neptune: {
      columnName: 'from'
    },
  })
  follower: string;

  @property({
    type: 'string',
    required: true,
    neptune: {
      columnName: 'to'
    },
  })
  followee: string;
```

## Relations
You can set relations between models, but, we strongly recommend NOT to use relations on Loopback queries. ORM join
operations sends one request for each model included in the main requested model. It doesn't make sense when using
any database, but, when using a GraphDB it's like buying a Ferrari to tow your boat to go fishing. Use
[Direct Query Execution (Gremlin Bytecode)](docs/bytecode.md) instead, when querying relations from Neptune.

## Loopback Types
There are some NOT supported Loopback data type in this connector, see the full list below:
- any: **Not supported**
- array: Will be stored as string and parsed back to array
- Boolean: Will be forcibly converted to boolean
- buffer: **Not supported**.
- date: **Not supported**. Use Date instead
- GeoPoint: **Not supported**
- Date: Will be forcibly converted to date
- null: **Not Supported**
- number: Will be forcibly converted to number. Will store **NaN** if it's not convertible
- Object: Will be stored as string and parsed back to object
- String: Will be forcibly converted to string

### Keep reading
- 1 - [Datasource](docs/datasource.md)
- 2 - Models
- 3 - [Repositories](docs/repositories.md)
- 4 - [CRUD methods](docs/crud.md)
- 5 - [Direct Query Execution (Gremlin Bytecode)](docs/bytecode.md)
- 6 - [Transaction](docs/transaction.md)

[Back](/)
