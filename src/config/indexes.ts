import Transaction from '../models/Transaction';

export async function ensureIndexes() {
  try {
    // Drop legacy non-partial unique index if present to avoid duplicate null errors
    try {
      await Transaction.collection.dropIndex('txHash_1');
      console.log('Dropped legacy index txHash_1');
    } catch (e) {
      // ignore if it doesn't exist
    }

    // Create partial unique index that only indexes documents with a real string txHash
    await Transaction.collection.createIndex(
      { txHash: 1 },
      {
        name: 'txHash_unique_nonnull',
        unique: true,
        partialFilterExpression: { txHash: { $exists: true, $type: 'string' } },
      }
    );

    // Sync any remaining indexes defined in schema
    await Transaction.syncIndexes();
    console.log('Indexes synced for Transaction');
  } catch (e) {
    console.error('Failed to sync indexes for Transaction', e);
  }
}
