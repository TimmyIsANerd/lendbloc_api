import Transaction from '../models/Transaction';

export async function ensureIndexes() {
  try {
    // List and drop any existing index(es) on txHash regardless of name to avoid conflicts
    try {
      const idxs = await Transaction.collection.indexes();
      for (const idx of idxs) {
        if (idx?.key && (idx.key as any).txHash === 1) {
          try {
            await Transaction.collection.dropIndex(idx.name);
            console.log(`Dropped existing txHash index: ${idx.name}`);
          } catch {}
        }
      }
    } catch {}

    // Recreate the partial unique index with a stable, conventional name
    await Transaction.collection.createIndex(
      { txHash: 1 },
      {
        name: 'txHash_1',
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
