'use strict';

// https://apidocs.loopback.io/loopback/

const debug = require('debug')('loopback:connector:neptune');
const uuid = require('uuid');
const {getUrlAndHeaders} = require('gremlin-aws-sigv4/lib/utils');

const gremlin = require('gremlin');
const { t: { id } } = gremlin.process;
const { P: { eq, neq, lt, lte, gt, gte, between, within, without } } = gremlin.process;
const { TextP: { containing, notContaining } } = gremlin.process;
const { order: { asc, desc } } = gremlin.process;
const __ = gremlin.process.statics;
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const traversal = gremlin.process.AnonymousTraversalSource.traversal;


exports.initialize = function (dataSource, cb) {

    debug('Initialize');

    dataSource.connector = new Neptune(dataSource);
    dataSource.connector.init();

    cb && cb();

}

exports = Neptune;

/**
 * @constructor
 * @param {Object} db
 */
function Neptune (datasource) {

    debug('Instantiating');

    this.process = gremlin.process;
    this.transactionList = {};
    this.modelTypes = {};

    this.settings = datasource.settings;
    this.connectionSettings = this.getConnectionDetails(datasource.settings);

}

Neptune.prototype.init = function() {

    debug('Init');

    this.connection = this.createRemoteConnection();
    this.g = this.createGraphTraversalSource(this.connection);

};

Neptune.prototype.getConnectionDetails = function(settings) {

    debug('Get Connection Details');

    if (settings.iam === true) {
        debug('IAM Enabled');
        return getUrlAndHeaders(
            settings.host,
            settings.port,
            {},
            '/gremlin',
            'wss');
    } else {
        debug('IAM Disabled');
        if(settings.url) {
            debug('Using URL to connect');
            return { url: settings.url, headers: {}};
        } else if(settings.secure === false) {
            debug('Using HOST and PORT to connect');
            const database_url = 'ws://' + settings.host + ':' + settings.port + '/gremlin';
            return { url: database_url, headers: {}};
        } else {
            debug('Using SECURE HOST and PORT to connect');
            const database_url = 'wss://' + settings.host + ':' + settings.port + '/gremlin';
            return { url: database_url, headers: {}};
        }
    }

};

Neptune.prototype.createRemoteConnection = function() {

    debug('Create Remote Connection');

    const { url, headers } = this.connectionSettings;

    let authenticator;
    if(this.settings.user && this.settings.password) {
        authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(this.settings.user, this.settings.password);
    }

    debug(' URL: %s \n HEADERS: %s \n AUTH: %s', url, headers, authenticator);

    const c = new DriverRemoteConnection(
        url,
        {
            mimeType: 'application/vnd.gremlin-v2.0+json',
            headers: headers,
            authenticator: authenticator
        });

    c._client._connection.on('close', (code, message) => {
        console.info(`close - ${code} ${message}`);
        if (code === 1006){
            console.error('Connection closed prematurely');
            throw new Error('Connection closed prematurely');
        }
    });

    return c;
};

Neptune.prototype.createGraphTraversalSource = function(conn) {

    debug('Create Graph Traversal Source');

    return traversal().withRemote(conn);

};

Neptune.prototype.create = function(model, data, options, cb) {

    debug('Create');
    debug(' Model: %s \n Data: %s \n Options: %s', model, data, options);

    const modelSettings = this.dataSource.models[model].settings;

    data = this._convertFields(model, data);

    if(modelSettings.type === 'vertex') {
        this._createVertex(model, data, options, cb);
    } else {
        this._createEdge(model, data, options, cb);
    }

};

Neptune.prototype._convertFields = function(model, data) {

    debug('Convert Fields');
    debug(' Model: %s \n Data: %s', model, data);

    const properties = this.dataSource.models[model].definition.properties;
    const keys = Object.keys(data);

    for(let k of keys) {
        if(properties[k]?.neptune?.columnName) {
            data[properties[k].neptune.columnName] = data[k];
            delete data[k];
        }
    }

    return data;

};

Neptune.prototype._revertFields = function(model, data) {

    debug('Revert Fields');
    debug(' Model: %s \n Data: %s', model, data);

    const properties = this.dataSource.models[model].definition.properties;
    const keys = Object.keys(properties);

    let response = {};
    for(let k of keys) {
        if(data[properties[k]?.neptune?.columnName] !== undefined) {
            response[k] = data[properties[k].neptune.columnName];
        } else if(data[k] !== undefined) {
            response[k] = data[k];
        }
    }

    return response;

};

Neptune.prototype._createVertex = function(model, data, options, cb) {

    debug('Create Vertex');
    debug(' Model: %s \n Data: %s \n Options: %s', model, data, options);

    let bytecode = this._getTransactionBytecode(options?.transaction?.connection);

    bytecode = bytecode ? bytecode.addV(model) : this.g.addV(model);
    bytecode = this._addProperties(model, bytecode, data, []);

    options.method = 'next';

    this._execute(model, bytecode, null, options, 0, (err, res) => {
        if(err) {
            return cb(err);
        }
        cb(null, res?.value?.id);
    });

};

Neptune.prototype._createEdge = function(model, data, options, cb) {

    debug('Create Edge');
    debug(' Model: %s \n Data: %s \n Options: %s', model, data, options);

    if(!data.from || !data.to) throw Error('Edge entity requires FROM and TO fields!');

    const from = data.from.split('/');
    if(from.length !== 2) throw Error('Relational field FROM must be MODEL/ID format');

    const to = data.to.split('/');
    if(to.length !== 2) throw Error('Relational field TO must be MODEL/ID format');

    let bytecode = this._getTransactionBytecode(options?.transaction?.connection);

    bytecode = bytecode ? bytecode.V(from[1]) : this.g.V(from[1]);

    bytecode.hasLabel(from[0]);
    bytecode.addE(model);
    bytecode.to(__.V(to[1]).hasLabel(to[0]));
    bytecode = this._addProperties(model, bytecode, data, ['from', 'to']);

    options.method = 'next';

    this._execute(model, bytecode, null, options, 0, (err, res) => {
        if(err) return cb(err);
        cb(null, res?.value?.id);
    });

};

Neptune.prototype._addProperties = function(model, vertexEdge, data, ignore) {

    debug('Add Properties');
    debug(' Model: %s \n Vertex/Edge: %s \n Data: %s', model, vertexEdge, data);

    const types = this.getModelTypes(model);

    const keys = Object.keys(data);
    for(let k of keys) {
        vertexEdge = this._addProperty(vertexEdge, types[k], k, data[k], ignore);
    }

    return vertexEdge;
};

Neptune.prototype._addProperty = function(vertexEdge, type, key, value, ignore) {

    debug('Add Property');
    debug(' Vertex/Edge: %s \n Type: %s \n Key: %s \n Value: %s \n Ignore: %s', vertexEdge, type, key, value, ignore);

    if(key === 'id' && ignore.indexOf(key) === -1) {
        vertexEdge.property(id, value);
    } else if(ignore.indexOf(key) === -1) {
        switch (type) {
            case 'Object':
                vertexEdge.property(key, JSON.stringify(value));
                break;
            case 'Array':
                vertexEdge.property(key, JSON.stringify(value));
                break;
            case 'Number':
                vertexEdge.property(key, Number(value));
                break;
            case 'Date':
                vertexEdge.property(key, new Date(value));
                break;
            case 'Boolean':
                vertexEdge.property(key, JSON.parse(value));
                break;
            case 'String':
                vertexEdge.property(key, value + '');
                break;
            default:
                throw Error('Type ' + type + ' is not supported.');
        }
    }

    return vertexEdge;
};

Neptune.prototype.getModelTypes = function(model) {

    debug('Get Model Types: %s', model);

    if(this.modelTypes[model]) {
        return this.modelTypes[model];
    }

    const props = this.dataSource.models[model].definition.properties;
    const keys = Object.keys(props);
    const res = {};

    for(let k of keys) {
        if(typeof props[k].type === 'function') {
            res[k] = functionName(props[k].type);
        } else {
            res[k] = functionName(props[k].type.constructor);
        }
    }

    this.modelTypes[model] = res;

    return res;

};

Neptune.prototype.save = function(model, data, cb) {

    debug('Save');
    debug(' Model: %s \n Data: %s', model, data);

    this.replaceById(model, data.id, data, null, cb);

};

Neptune.prototype.count = function(model, where, options, cb) {

    debug('Count');
    debug(' Model: %s \n Where: %s \n Options: %s', model, where, options);

    const bytecode = this._buildWhere(null, model, null, where);

    bytecode.count();

    this._execute(model, bytecode, null, {method: 'next'}, 0, (err, res) => {
        if(err) return cb(err);
        cb(null, res.value);
    });

};

Neptune.prototype.destroyAll = function(model, where, cb) {

    debug('Destroy All');
    debug(' Model: %s \n Where: %s', model, where);

    this.count(model, where, null, (err, count) => {

        if(err) return cb(err);

        if(count === 0) return cb(null, { count: 0 });

        const bytecode = this._buildWhere(null, model, null, where);

        bytecode.drop();

        this._execute(model, bytecode, null, {method: 'iterate'}, 0, (err, res) => {
            if(err) return cb(err);
            cb(null, { count: count });
        });

    });

};

Neptune.prototype.destroyById = function(model, id, cb) {

    debug('Destroy By Id');
    debug(' Model: %s \n ID: %s', model, id);

    if(!id) throw Error('ID is required');

    this.destroyAll(model, { id: id }, cb);

};

Neptune.prototype.exists = function(model, id, cb) {

    debug('Exists');
    debug(' Model: %s \n ID: %s', model, id);

    const filter = {
        where: { id: id },
        fields: [],
        limit: 1,
        skip: 0
    };

    this.find(model, filter, null, (err, res) => {
        if(err) return cb(err);
        cb(null, !!res[0]);
    });

};

Neptune.prototype.findById = function(model, id, filter, cb) {

    debug('Find By Id');
    debug(' Model: %s \n ID: %s \n Filter: %s', model, id, filter);

    if(!id) throw Error('ID is required');

    if(!filter) filter = {};
    filter.where = { id: id };
    filter.limit = 1;
    filter.skip = 0;

    this.all(model, filter, null, (err, res) => {
        if(err) return cb(err);
        cb(null, res[0]);
    });

};

Neptune.prototype.findOne = function(model, filter, cb) {

    debug('Find One');
    debug(' Model: %s \n Filter: %s', model, filter);

    if(!filter) filter = {};
    filter.limit = 1;
    filter.skip = 0;

    this.all(model, filter, null, (err, res) => {
        if(err) return cb(err);
        cb(null, res[0]);
    });
};

Neptune.prototype.replaceById = function(model, id, data, options, cb) {

    debug('Replace By Id');
    debug(' Model: %s \n ID: %s \n Data: %s \n Options: %s', model, id, data, options);

    if(!id) throw Error('ID is required');

    const settings = this.dataSource.models[model].settings;

    if(settings.type === 'edge') {
        delete data.from;
        delete data.to;
    }

    let bytecode = this._buildWhere(null, model, null, { id: id });

    bytecode.sideEffect(__.properties().drop())

    const types = this.getModelTypes(model);

    for(let key in data) {
        if(data.hasOwnProperty(key)) {
            bytecode = this._addProperty(bytecode, types[key], key, data[key], ['id','from','to']);
        }
    }

    this._execute(model, bytecode, null, {method: 'iterate'}, 0, (err, res) => {
        if(err) return cb(err);
        cb();
    });

};

Neptune.prototype.updateAll = function(model, where, data, cb) {

    debug('Update All');
    debug(' Model: %s \n Where: %s \n Data: %s', model, where, data);

    const bytecode = this._buildWhere(null, model, null, where);

    const settings = this.dataSource.models[model].settings;

    if(settings.type === 'edge') {
        delete data.from;
        delete data.to;
    }

    for(let key in data) {
        if(data.hasOwnProperty(key)) {
            bytecode.sideEffect(__.properties(key).drop()).property(key, data[key]);
        }
    }

    bytecode.count();

    this._execute(model, bytecode, null, {method: 'next'}, 0, (err, res) => {
        if(err) return cb(err);
        cb(null, { count: res.value });
    });

};

Neptune.prototype.update = function(model, where, data, options, cb) {

    debug('Update');
    debug(' Model: %s \n Where: %s \n Data: %s \n Options: %s', model, where, data, options);

    this.updateAll(model, where, data, cb);

};

// https://stackoverflow.com/questions/63711403/converting-gremlin-javascript-output-into-json
Neptune.prototype._normalizeData = function(gremlinData) {

    debug('Normalize Data');

    // Do this so that JSON.stringify works for maps
    (Map.prototype).toJSON = function () {
        return Object.fromEntries(this);
    };
    let mapStrippedData = JSON.parse(JSON.stringify(gremlinData));

    // Undo it so that we don't permanently pollute globals
    (Map.prototype).toJSON = undefined;

    if(mapStrippedData instanceof Array) {
        mapStrippedData = mapStrippedData.map((item) => {
            delete item.label;
            return item;
        });
    }

    return mapStrippedData;
};

Neptune.prototype.all = function find(model, filter, options, cb) {

    debug('All');
    debug(' Model: %s \n Filter: %s \n Options: %s', model, filter, options);

    const settings = this.dataSource.models[model].settings;
    const bytecode = this._queryBuilder(model, filter, options);

    this._execute(model, bytecode, null, {method: 'toList'}, 0, (err, res) => {
        if(err) return cb(err);

        if(settings.type === 'edge') {
            res = this._convertEdge(model, res);
        }

        res = res.map((item) => { return this._revertFields(model, item) });

        cb(null, res);

        cb();
    });

};

Neptune.prototype._convertEdge = function(model, edges) {

    debug('Convert Edge');
    debug(' Model: %s \n Edges: %s', model, edges);

    const settings = this.dataSource.models[model].settings;
    return edges.map((item) => {

        const ignoreList = ['label','IN','OUT'];
        const res = {};

        for(let i in item) {
            if(ignoreList.indexOf(i) === -1) res[i] = item[i];
        }

        res.to = item.IN.label + '/' + item.IN.id;
        res.from = item.OUT.label + '/' + item.OUT.id;

        return res;

    });

};

Neptune.prototype.execute = function(g, params, options, callback) {

    debug('Execute');
    debug(' G: %s \n Params: %s \n Options: %s', g, params, options);

    this._execute(null, g, params, options, 0, callback);

};

Neptune.prototype._execute = function(model, g, params, options, retries, callback) {

    debug('_Execute');
    debug(' Model: %s \n G: %s \n Params: %s \n Options: %s \n Retries: %s', model, g, params, options, retries);

    if (typeof params === 'function') {
        // execute(sql, callback)
        options = {};
        callback = params;
        params = [];
    } else if (typeof options === 'function') {
        // execute(sql, params, callback)
        callback = options;
        options = {};
    }

    options = options || {};

    if(typeof g?.then === 'function') {
        this._executePromise(g, options, (err, res) => {

            if(!err) return callback(null, res);

            const retryConf = this._needRetry(model, err);
            if(retryConf?.max > retries) {
                setTimeout(() => { this._execute(model, g, params, options, retries+1, callback); }, retryConf.delay);
            } else {
                callback(err);
            }

        });
    } else if(typeof g?.next === 'function') {
        this._executeGremlin(g, options, (err, res) => {

            if(!err) return callback(null, res);

            const retryConf = this._needRetry(model, err);
            if(retryConf?.max > retries) {
                setTimeout(() => { this._execute(model, g, params, options, retries+1, callback); }, retryConf.delay);
            } else {
                callback(err);
            }

        });
    } else {
        throw Error('Invalid Bytecode Query Format!');
    }

};

Neptune.prototype._executePromise = function(g, options, callback) {

    debug('Execute Promise');
    debug(' G: %s \n Options: %s', g, options);

    if(options.transaction) throw Error('Transactions are not supported on Promise Mode!');

    g.then(r => {

        if(options.parse === false) {
            callback(null, r);
        } else {
            callback(null, this._normalizeData(r));
        }

    }).catch(e => {
        console.error(e);
        callback(e);
    });

};

Neptune.prototype._executeGremlin = function(g, options, callback) {

    debug('Execute Gremlin');
    debug(' G: %s \n Options: %s', g, options);

    if(options?.transaction?.connection) {
        this.transactionList[options?.transaction?.connection].bytecode = g;
        return callback();
    }

    switch(options?.method) {
        case 'toList':
            g.toList().then(r => {
                callback(null, this._normalizeData(r));
            }).catch(callback);
            break;
        case 'next':
            g.next().then(r => {
                callback(null, this._normalizeData(r));
            }).catch(callback);
            break;
        case 'iterate':
            g.iterate().then(r => {
                callback();
            }).catch(callback);
            break;
        default:
            throw Error('Invalid Method, should be toList, next or iterate');
    }

};

Neptune.prototype._needRetry = function(model, err) {

    debug('Need retry: %s', model);

    if(!model) return null;

    if(typeof err.statusMessage === 'string') {

        const settings = this.dataSource.models[model].settings;
        const retry = {
            max: settings.retry?.max || 3,
            delay: settings.retry?.delay || 100
        };

        if(err.statusMessage.indexOf('ConcurrentModificationException') > 0) {
            return retry;
        }

        if(err.statusMessage.indexOf('ReadOnlyViolationException') > 0) {
            return retry;
        }

        if(err.statusMessage.indexOf('WebSocket is not open') !== -1) {
            this.connection.close();
            this.init();
            return retry;
        }

    } else {
        return null;
    }

};

Neptune.prototype._queryBuilder = function(model, filter, options, whereRequired) {

    debug('Query Builder');
    debug(' Model: %s \n Filter: %s \n Options: %s', model, filter, options);

    const settings = this.dataSource.models[model].settings;

    if(!filter && !whereRequired) {
        let bytecode = this._getTransactionBytecode(options?.transaction?.connection);
        if(settings.type === 'edge') {
            bytecode = bytecode ? bytecode.E() : this.g.E();
        } else {
            bytecode = bytecode ? bytecode.V() : this.g.V();
        }
        bytecode.hasLabel(model);
        return bytecode;
    }

    // Where
    let where;
    if(!filter.where) where = {};
    else where = filter.where;

    let bytecode = this._getTransactionBytecode(options?.transaction?.connection);
    bytecode = this._buildWhere(bytecode, model, null, where, whereRequired);

    if(whereRequired && !bytecode.bytecode.stepInstructions[0][1]) {
        let steps = JSON.stringify(bytecode, null, 2);
        let checkWhere = false;
        for(let s of steps) { if(s[0]==='has') { checkWhere = true; break; } }
        if(checkWhere !== true) throw Error('WHERE is required for this operation!');
    }

    // Fields
    if(!filter.fields) {
        // https://stackoverflow.com/questions/2856059/passing-an-array-as-a-function-parameter-in-javascript
        // http://www.kelvinlawrence.net/book/PracticalGremlin.html
        bytecode.elementMap(...Object.keys(this.dataSource.models[model].definition.properties));
    } else if(filter.fields.length > 0) {
        bytecode.elementMap(...filter.fields);
    }

    // Order
    if(filter.order) {
        let order = filter.order;
        if(!(order instanceof Array)) {
            order = [order];
        }

        for(let o of order) {
            const params = o.split(' ');

            if(filter.fields && filter.fields.indexOf(params[0]) === -1) {
                throw Error('Field "' + params[0] + '" must be in field list!');
            }

            if(params[1].toLowerCase() === 'desc') {
                bytecode.order().by(params[0], desc);
            } else {
                bytecode.order().by(params[0], asc);
            }
        }
    }

    // Skip
    if(filter.skip) {
        bytecode.skip(filter.skip);
    }

    // Limit
    if(filter.limit) {
        bytecode.limit(filter.limit);
    }

    return bytecode;

};

Neptune.prototype._buildWhere = function(bytecode, model, field, where) {

    debug('Build Where');
    debug(' Bytecode: %s \n Model: %s \n Field: %s \n Where: %s', bytecode, model, field, where);

    const settings = this.dataSource.models[model].settings;

    where = where || {};

    if(!bytecode) {

        const keys = Object.keys(where);

        if(keys.length === 1 && keys[0] === 'id') {

            if(settings.type === 'edge') {
                bytecode = this.g.E(where['id']);
            } else {
                bytecode = this.g.V(where['id']);
            }
            bytecode.hasLabel(model);
            return bytecode;
        } else {
            if(settings.type === 'edge') {
                bytecode = this.g.E();
            } else {
                bytecode = this.g.V();
            }
            bytecode.hasLabel(model);
        }

    }

    for(let k in where) {

        switch (k) {
            case 'or':
                bytecode.or(this._buildWhere(bytecode, model, null, where[k]));
                break;

            case 'and':
                bytecode.and(this._buildWhere(bytecode, model, null, where[k]));
                break;

            case 'eq':
                bytecode.has(this._getField(field), eq(where[k]));
                break;

            case 'neq':
                bytecode.has(this._getField(field), neq(where[k]));
                break;

            case 'gt':
                bytecode.has(this._getField(field), gt(where[k]));
                break;

            case 'gte':
                bytecode.has(this._getField(field), gte(where[k]));
                break;

            case 'lt':
                bytecode.has(this._getField(field), lt(where[k]));
                break;

            case 'lte':
                bytecode.has(this._getField(field), lte(where[k]));
                break;

            case 'between':
                bytecode.has(this._getField(field), between(where[k]));
                break;

            case 'inq':
                bytecode.has(this._getField(field), within(where[k]));
                break;

            case 'nin':
                bytecode.has(this._getField(field), without(where[k]));
                break;

            case 'near':
                throw Error('NEAR operator is not implemented on Gremlin!');

            case 'like':
                bytecode.has(this._getField(field), containing(where[k]));
                break;

            case 'nlike':
                bytecode.has(this._getField(field), notContaining(where[k]));
                break;

            case 'ilike':
                bytecode.has(this._getField(field), containing(where[k]));
                break;

            case 'nilike':
                bytecode.has(this._getField(field), notContaining(where[k]));
                break;

            case 'regexp':
                throw Error('REGEXP operator is not implemented on Gremlin!');

            default:
                if(isNaN(k)) {
                    if(typeof where[k] === 'string' || typeof where[k] === 'number' || typeof where[k] === 'boolean') {
                        bytecode.has(this._getField(k), where[k]);
                    } else {
                        this._buildWhere(bytecode, model, this._getField(k), where[k]);
                    }

                } else {
                    this._buildWhere(bytecode, model, null, where[k]);
                }

        }

    }

    return bytecode;

};

Neptune.prototype._getField = function(field) {

    debug('Get Field: %s', field);

    if(field !== 'id') return field;
    else return id;
};

Neptune.prototype.beginTransaction = function(options, cb) {

    debug('Begin Transaction: %s', options);

    const connectionID = uuid.v4();

    const clearTimeout = this.settings.transactionClearTimeout ?? 5000;

    this.transactionList[connectionID] = {
        bytecode: null,
        timeoutInstance: setTimeout(() => {this.rollback(connectionID)}, clearTimeout)
    };

    cb(null, connectionID);

};

Neptune.prototype.commit = function(connection, cb) {

    debug('Commit');

    if(!this.transactionList[connection]) return cb(new Error('Transaction Expired or Does Not Exists'));

    this._executeGremlin(this.transactionList[connection].bytecode, { method: 'iterate' },
        (err, res) => {

            clearTimeout(this.transactionList[connection].timeoutInstance);
            delete this.transactionList[connection];

            if(err) return cb(err);

            cb && cb(null, res);

        });

};

Neptune.prototype.rollback = function(connection, cb) {

    debug('Rollback');

    if(!this.transactionList[connection]) {
        return cb();
    }

    clearTimeout(this.transactionList[connection].timeoutInstance);
    delete this.transactionList[connection];

    cb && cb();

};

Neptune.prototype._getTransactionBytecode = function(id) {

    debug('Get transaction bytecode: %s', id);

    if(!this.transactionList[id]) return null;

    return this.transactionList[id].bytecode;

};

function functionName(fun) {
    let ret = fun.toString();
    return ret.substring('function '.length, ret.indexOf('('));
}
