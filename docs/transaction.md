# Transactions
Keep in mind that the term `Transactions` here refers to traditional DB transaction concept, where more than one 
instruction is sent to the database and if one of those instructions fails all previous executed instructions 
will be rolled back.
AWS Neptune Documentation calls it [Multithreaded Gremlin Writes](https://docs.aws.amazon.com/neptune/latest/userguide/best-practices-gremlin-multithreaded-writes.html)
and can only be used for written operations.

In order to use one unique request to insert a set of data into Neptune you can use Loopback ORM transaction method
and commit once.

As this feature is not actually supported as a transaction by Neptune, all instructions are stored in memory til the
moment you commit it. To avoid memory issues with your application this connector has an internal timeout limit
to clean up those transactions from the memory. For more details look at [Datasource](datasource.md) docs. 

Inside a repository method where you have to insert related data with a rollback condition, you should do something
like this:
```typescript
async createRelatedPost(post: PostRequestType) {

    const transaction = await this.dataSource.beginTransaction({
      timeout: 1000
    });
    
    const postData = {
      id: uuidv4(),
      content: post.content,
      createdAt: post.createdAt
    };
    
    const postOwnerData = {
      owner: 'People/' + post.userId,
      post: 'Post/' + postData.id
    };
    
    const resPost = await this.create(postData, {transaction});
    
    const resPostOwner = await this.postOwnerRepository.create(postOwnerData, {transaction});
    
    await transaction.commit();
    
    return { post: resPost, postOwner: resPostOwner };
    
}
```

### Keep reading
- 1 - [Datasource](docs/datasource.md)
- 2 - [Models](docs/models.md)
- 3 - [Repositories](docs/repositories.md)
- 4 - [CRUD methods](docs/crud.md)
- 5 - [Direct Query Execution (Gremlin Bytecode)](docs/bytecode.md)
- 6 - Transaction

[Back](/)
