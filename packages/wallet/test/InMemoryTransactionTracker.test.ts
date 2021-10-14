import { CardanoSerializationLib, CSL, ProviderError, ProviderFailure } from '@cardano-sdk/core';
import { dummyLogger } from 'ts-log';
import { ledgerTip, providerStub, ProviderStub, queryTransactionsResult } from './mocks';
import mockDelay from 'delay';
import { TransactionTrackerEvent, InMemoryTransactionTracker, TransactionFailure } from '../src';

jest.mock('delay', () => jest.fn().mockResolvedValue(void 0));

describe('InMemoryTransactionTracker', () => {
  const POLL_INTERVAL = 1000;
  let ledgerTipSlot: number;
  let provider: ProviderStub;
  let txTracker: InMemoryTransactionTracker;
  let hash_transaction: jest.Mock;

  const mockHashTransactionReturn = (resultHash: string) => {
    hash_transaction.mockReturnValue({
      to_bytes() {
        return Buffer.from(resultHash);
      }
    });
  };

  beforeEach(() => {
    provider = providerStub();
    provider.queryTransactionsByHashes.mockReturnValue([queryTransactionsResult[0]]);
    hash_transaction = jest.fn();
    mockHashTransactionReturn('some-hash');
    txTracker = new InMemoryTransactionTracker({
      provider,
      csl: { hash_transaction } as unknown as CardanoSerializationLib,
      logger: dummyLogger,
      pollInterval: POLL_INTERVAL
    });
    ledgerTipSlot = ledgerTip.slot;
    (mockDelay as unknown as jest.Mock).mockReset();
  });

  describe('track', () => {
    let onTransaction: jest.Mock;

    beforeEach(() => {
      onTransaction = jest.fn();
      txTracker.on(TransactionTrackerEvent.NewTransaction, onTransaction);
    });

    it('cannot track transactions that have no validity interval', async () => {
      await expect(() =>
        txTracker.track({
          body: () => ({
            ttl: () => void 0
          })
        } as unknown as CSL.Transaction)
      ).rejects.toThrowError(TransactionFailure.CannotTrack);
    });

    describe('valid transaction', () => {
      let transaction: CSL.Transaction;

      beforeEach(async () => {
        transaction = {
          body: () => ({
            ttl: () => ledgerTipSlot
          })
        } as unknown as CSL.Transaction;
      });

      it('throws CannotTrack on ledger tip fetch error', async () => {
        provider.queryTransactionsByHashes.mockResolvedValueOnce([]);
        provider.ledgerTip.mockRejectedValueOnce(new ProviderError(ProviderFailure.Unknown));
        await expect(txTracker.track(transaction)).rejects.toThrowError(TransactionFailure.CannotTrack);
        expect(provider.ledgerTip).toBeCalledTimes(1);
        expect(provider.queryTransactionsByHashes).toBeCalledTimes(1);
      });

      it('polls provider at "pollInterval" until it returns the transaction', async () => {
        // resolve [] or reject with 404 should be treated the same
        provider.queryTransactionsByHashes.mockResolvedValueOnce([]);
        provider.queryTransactionsByHashes.mockRejectedValueOnce(new ProviderError(ProviderFailure.NotFound));
        await txTracker.track(transaction);
        expect(provider.queryTransactionsByHashes).toBeCalledTimes(3);
        expect(mockDelay).toBeCalledTimes(3);
        expect(mockDelay).toBeCalledWith(POLL_INTERVAL);
      });

      it('throws after timeout', async () => {
        provider.queryTransactionsByHashes.mockResolvedValueOnce([]);
        provider.ledgerTip.mockResolvedValueOnce({ slot: ledgerTipSlot + 1 });
        await expect(txTracker.track(transaction)).rejects.toThrowError(TransactionFailure.Timeout);
      });

      it('emits "transaction" event for tracked transactions, returns promise unique per pending tx', async () => {
        const promise1 = txTracker.track(transaction);
        const promise2 = txTracker.track(transaction);
        await promise1;
        await promise2;
        mockHashTransactionReturn('other-hash');
        await txTracker.track(transaction);
        expect(provider.queryTransactionsByHashes).toBeCalledTimes(2);
        expect(onTransaction).toBeCalledTimes(2);
        // assert it clears cache
        await txTracker.track(transaction);
        expect(provider.queryTransactionsByHashes).toBeCalledTimes(3);
        expect(onTransaction).toBeCalledTimes(3);
      });
    });
  });
});
