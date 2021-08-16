# Repositories

## ORM Edge creation
When using ORM to create an EDGE entry you have to specify the FROM and TO fields using the name of Label (table)
followed by slash and the ID.
```typescript
const postOwnerData = {
  owner: 'People/' + PeopleID,
  post: 'Post/' + postID
};

await this.postOwnerRepository.create(postOwnerData);
```

To use CRUD methods you can use it as you would use with any other connector, see more in [CRUD methods](crud.md).

To use Gremlin Traversal Steps in bytecode mode look at [Direct Query Execution (Gremlin Bytecode)](bytecode.md).

### Keep reading
- 1 - [Datasource](datasource.md)
- 2 - [Models](models.md)
- 3 - Repositories
- 4 - [CRUD methods](crud.md)
- 5 - [Direct Query Execution (Gremlin Bytecode)](bytecode.md)
- 6 - [Transaction](transaction.md)

[Back](https://github.com/wesleymilan/loopback-connector-neptune)
