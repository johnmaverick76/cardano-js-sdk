import { BigIntMath, Cardano, WalletProvider } from '@cardano-sdk/core';
import { KeyManager } from '../../KeyManagement';
import { Observable, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { RetryBackoffConfig } from 'backoff-rxjs';
import { TxWithEpoch, transactionHasAnyCertificate } from './util';
import { coldObservableProvider } from '../util';
import { first } from 'lodash-es';
import { isNotNil } from '@cardano-sdk/core/src/util/misc';

export const createRewardsHistoryProvider =
  (walletProvider: WalletProvider, keyManager: KeyManager, retryBackoffConfig: RetryBackoffConfig) =>
  (lowerBound: Cardano.Epoch | null) =>
    lowerBound
      ? coldObservableProvider(
          () => walletProvider.rewardsHistory({ epochs: { lowerBound }, stakeAddresses: [keyManager.rewardAccount] }),
          retryBackoffConfig
        )
      : of([]);

export type RewardsHistoryProvider = ReturnType<typeof createRewardsHistoryProvider>;

const firstDelegationEpoch$ = (transactions$: Observable<TxWithEpoch[]>) =>
  transactions$.pipe(
    map((transactions) =>
      first(
        transactions.filter(({ tx }) => transactionHasAnyCertificate(tx, [Cardano.CertificateType.StakeDelegation]))
      )
    ),
    map((tx) => (isNotNil(tx) ? tx.epoch + 2 : null)),
    distinctUntilChanged()
  );

export const createRewardsHistoryTracker = (
  transactions$: Observable<TxWithEpoch[]>,
  rewardsHistoryProvider: RewardsHistoryProvider
) =>
  firstDelegationEpoch$(transactions$).pipe(
    switchMap((firstEpoch) => rewardsHistoryProvider(firstEpoch)),
    map((all) => {
      const lifetimeRewards = BigIntMath.sum(all.map(({ rewards }) => rewards));
      return {
        all,
        avgReward: all.length > 0 ? lifetimeRewards / BigInt(all.length) : null,
        lastReward: all.length > 0 ? all[all.length - 1] : null,
        lifetimeRewards
      };
    })
  );
