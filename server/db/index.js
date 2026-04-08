const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
let client;
let db;

const connect = async () => {
  if (!client) {
    const options = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    // Atlas SRV URI may require TLS options in this environment
    if (uri.includes('mongodb+srv://')) {
      options.tls = true;
      options.ssl = true;
      options.tlsAllowInvalidCertificates = true;
      options.tlsAllowInvalidHostnames = true;
      options.retryWrites = true;
      options.w = 'majority';
      options.directConnection = false;
    }

    client = new MongoClient(uri, options);
  }
  await client.connect();
  if (!db) {
    const dbName = process.env.MONGODB_DB || (() => {
      try {
        return new URL(uri).pathname.replace(/^\//, '');
      } catch {
        return 'smartcut';
      }
    })();
    db = client.db(dbName || 'smartcut');
  }
  return db;
};

const collection = async (name) => {
  const database = await connect();
  return database.collection(name);
};

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (ObjectId.isValid(id)) return new ObjectId(id);
  return null;
};

const formatDoc = (doc) => {
  if (!doc) return doc;
  const formatted = { ...doc, id: doc._id?.toString() };
  delete formatted._id;
  return formatted;
};

const formatDocs = (docs) => docs.map(formatDoc);

module.exports = { connect, collection, toObjectId, formatDoc, formatDocs, ObjectId };
