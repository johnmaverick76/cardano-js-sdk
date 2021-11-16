/* eslint-disable unicorn/no-nested-ternary */
import { Cardano, StakePoolSearchProvider, WalletProvider } from '@cardano-sdk/core';
import { DelegationTracker, StakeKeyStatus, TransactionsTracker } from '../types';
import { KeyManager } from '../../KeyManagement';
import { Observable, combineLatest, distinctUntilChanged, map, share, switchMap } from 'rxjs';
import { ObservableStakePoolSearchProvider, createDelegateeTracker, createQueryStakePoolsProvider } from './Delegatee';
import { RetryBackoffConfig } from 'backoff-rxjs';
import { RewardsHistoryProvider, createRewardsHistoryProvider, createRewardsHistoryTracker } from './RewardsHistory';
import { TrackerSubject, coldObservableProvider } from '../util';
import { TxWithEpoch } from './types';
import { isEqual, uniq } from 'lodash-es';
import {
  isLastStakeKeyCertOfType,
  outgoingTransactionsWithCertificates,
  transactionStakeKeyCertficates
} from './transactionCertificates';

export const createBlockEpochProvider =
  (walletProvider: WalletProvider, retryBackoffConfig: RetryBackoffConfig) => (blockHashes: Cardano.Hash16[]) =>
    coldObservableProvider(() => walletProvider.queryBlocksByHashes(blockHashes), retryBackoffConfig).pipe(
      map((blocks) => blocks.map(({ epoch }) => epoch))
    );

export type BlockEpochProvider = ReturnType<typeof createBlockEpochProvider>;

export interface DelegationTrackerProps {
  walletProvider: WalletProvider;
  keyManager: KeyManager;
  stakePoolSearchProvider: StakePoolSearchProvider;
  epoch$: Observable<Cardano.Epoch>;
  transactionsTracker: TransactionsTracker;
  retryBackoffConfig: RetryBackoffConfig;
  internals?: {
    queryStakePoolsProvider?: ObservableStakePoolSearchProvider;
    rewardsHistoryProvider?: RewardsHistoryProvider;
    blockEpochProvider?: BlockEpochProvider;
  };
}

export const certificateTransactionsWithEpochs = (
  transactionsTracker: TransactionsTracker,
  blockEpochProvider: BlockEpochProvider,
  certificateTypes: Cardano.CertificateType[]
): Observable<TxWithEpoch[]> =>
  outgoingTransactionsWithCertificates(transactionsTracker, certificateTypes).pipe(
    switchMap((transactions) =>
      blockEpochProvider(transactions.map((tx) => tx.blockHeader.blockHash)).pipe(
        map((epochs) => transactions.map((tx, txIndex) => ({ epoch: epochs[txIndex], tx })))
      )
    ),
    share()
  );

export const createRewardAccountsTracker = (
  transactions$: Observable<TxWithEpoch[]>,
  transactionsInFlight$: Observable<Cardano.NewTxAlonzo[]>
) =>
  combineLatest([transactions$, transactionsInFlight$]).pipe(
    map(([transactions, transactionsInFlight]) => [transactions.map(({ tx }) => tx), transactionsInFlight]),
    map(([transactions, transactionsInFlight]) => {
      const rewardAccounts = uniq(
        [...transactions, ...transactionsInFlight].flatMap(({ body }) =>
          transactionStakeKeyCertficates(body).map((cert) => cert.address)
        )
      );
      return rewardAccounts.map((address) => {
        const isRegistered = isLastStakeKeyCertOfType(
          transactions,
          Cardano.CertificateType.StakeKeyRegistration,
          address
        );
        const isRegistering = isLastStakeKeyCertOfType(
          transactionsInFlight,
          Cardano.CertificateType.StakeKeyRegistration,
          address
        );
        const isUnregistering = isLastStakeKeyCertOfType(
          transactionsInFlight,
          Cardano.CertificateType.StakeKeyDeregistration,
          address
        );
        return {
          address,
          keyStatus: isRegistering
            ? StakeKeyStatus.Registering
            : isUnregistering
            ? StakeKeyStatus.Unregistering
            : isRegistered
            ? StakeKeyStatus.Registered
            : StakeKeyStatus.Unregistered
        };
      });
    }),
    distinctUntilChanged(isEqual)
  );

export const createDelegationTracker = ({
  keyManager,
  epoch$,
  walletProvider,
  retryBackoffConfig,
  transactionsTracker,
  stakePoolSearchProvider,
  internals: {
    queryStakePoolsProvider = createQueryStakePoolsProvider(stakePoolSearchProvider, retryBackoffConfig),
    rewardsHistoryProvider = createRewardsHistoryProvider(walletProvider, keyManager, retryBackoffConfig),
    blockEpochProvider = createBlockEpochProvider(walletProvider, retryBackoffConfig)
  } = {}
}: DelegationTrackerProps): DelegationTracker => {
  const transactions$ = certificateTransactionsWithEpochs(transactionsTracker, blockEpochProvider, [
    Cardano.CertificateType.StakeDelegation,
    Cardano.CertificateType.StakeKeyRegistration,
    Cardano.CertificateType.StakeKeyDeregistration
  ]);
  const rewardsHistory$ = new TrackerSubject(createRewardsHistoryTracker(transactions$, rewardsHistoryProvider));
  const delegatee$ = new TrackerSubject(createDelegateeTracker(queryStakePoolsProvider, epoch$, transactions$));
  const rewardAccounts$ = new TrackerSubject(
    createRewardAccountsTracker(transactions$, transactionsTracker.outgoing.inFlight$)
  );
  return {
    delegatee$,
    rewardAccounts$,
    rewardsHistory$,
    shutdown: () => {
      rewardAccounts$.complete();
      rewardsHistory$.complete();
      delegatee$.complete();
    }
  };
};