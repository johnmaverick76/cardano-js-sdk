import { Cardano, WalletProvider } from '@cardano-sdk/core';
import { RetryBackoffConfig } from 'backoff-rxjs';
import { StakeKeyStatus, TransactionsTracker } from '../../../src/services';
import { TxWithEpoch } from '../../../src/services/DelegationTracker/types';
import {
  certificateTransactionsWithEpochs,
  createBlockEpochProvider,
  createRewardAccountsTracker
} from '../../../src/services/DelegationTracker';
import { createStubTxWithCertificates } from './stub-tx';
import { createTestScheduler } from '../../testScheduler';

jest.mock('../../../src/services/util/coldObservableProvider', () => ({ coldObservableProvider: jest.fn() }));
const coldObservableProviderMock: jest.Mock = jest.requireMock(
  '../../../src/services/util/coldObservableProvider'
).coldObservableProvider;

describe('DelegationTracker', () => {
  test('createRewardAccountsTracker', () => {
    createTestScheduler().run(({ cold, expectObservable }) => {
      const address = 'stake...';
      const transactions$ = cold('a-b-c', {
        a: [],
        b: [
          {
            tx: { body: { certificates: [{ __typename: Cardano.CertificateType.StakeKeyRegistration, address }] } }
          } as TxWithEpoch
        ],
        c: [
          {
            tx: { body: { certificates: [{ __typename: Cardano.CertificateType.StakeKeyRegistration, address }] } }
          } as TxWithEpoch,
          {
            tx: { body: { certificates: [{ __typename: Cardano.CertificateType.StakeKeyDeregistration, address }] } }
          } as TxWithEpoch
        ]
      });
      const transactionsInFlight$ = cold('abaca', {
        a: [],
        b: [
          {
            body: { certificates: [{ __typename: Cardano.CertificateType.StakeKeyRegistration, address }] }
          } as Cardano.NewTxAlonzo
        ],
        c: [
          {
            body: { certificates: [{ __typename: Cardano.CertificateType.StakeKeyDeregistration, address }] }
          } as Cardano.NewTxAlonzo
        ]
      });
      const tracker$ = createRewardAccountsTracker(transactions$, transactionsInFlight$);
      expectObservable(tracker$).toBe('abcde', {
        a: [],
        b: [{ address, keyStatus: StakeKeyStatus.Registering }],
        c: [{ address, keyStatus: StakeKeyStatus.Registered }],
        d: [{ address, keyStatus: StakeKeyStatus.Unregistering }],
        e: [{ address, keyStatus: StakeKeyStatus.Unregistered }]
      });
    });
  });

  test('createBlockEpochProvider', () => {
    createTestScheduler().run(({ cold, expectObservable, flush }) => {
      coldObservableProviderMock.mockReturnValue(
        cold('a-b', {
          a: [{ epoch: 100 }],
          b: [{ epoch: 100 }, { epoch: 101 }]
        })
      );
      const walletProvider = null as unknown as WalletProvider; // not used in this test
      const config = null as unknown as RetryBackoffConfig; // not used in this test
      const hashes = ['hash1', 'hash2'];
      expectObservable(createBlockEpochProvider(walletProvider, config)(hashes)).toBe('a-b', {
        a: [100],
        b: [100, 101]
      });
      flush();
      expect(coldObservableProviderMock).toBeCalledTimes(1);
    });
  });

  describe('certificateTransactionsWithEpochs', () => {
    it('emits outgoing transactions containing given certificate types, retries on error', () => {
      createTestScheduler().run(({ cold, expectObservable }) => {
        const transactions = [
          createStubTxWithCertificates([Cardano.CertificateType.StakeKeyRegistration]),
          createStubTxWithCertificates([
            Cardano.CertificateType.PoolRetirement,
            Cardano.CertificateType.StakeDelegation
          ]),
          createStubTxWithCertificates(),
          createStubTxWithCertificates([Cardano.CertificateType.StakeKeyDeregistration])
        ];
        const blockEpochProvider = jest.fn().mockReturnValue(cold('-a', { a: [284, 285] }));
        const target$ = certificateTransactionsWithEpochs(
          {
            history: {
              outgoing$: cold('a--a', {
                a: transactions
              })
            }
          } as unknown as TransactionsTracker,
          blockEpochProvider,
          [Cardano.CertificateType.StakeDelegation, Cardano.CertificateType.StakeKeyDeregistration]
        );
        expectObservable(target$).toBe('-a', {
          a: [
            { epoch: 284, tx: transactions[1] },
            { epoch: 285, tx: transactions[3] }
          ]
        });
      });
    });
  });
});