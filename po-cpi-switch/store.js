const DATA_BACKEND = (process.env.DATA_BACKEND || 'file').toLowerCase();
module.exports = DATA_BACKEND === 'pg' ? require('./store-pg') : require('./store-file');
