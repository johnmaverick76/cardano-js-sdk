import { CardanoProvider } from '@cardano-sdk/core';
import { Schema as Cardano } from '@cardano-ogmios/client';
import axios from 'axios';

export type RosettaProviderOptions = {
  baseUrl: string;
  network: 'mainnet' | 'testnet';
};

/**
 * Provider for [Cardano Rosetta](https://github.com/input-output-hk/cardano-rosetta)
 *
 * @param {string} baseUrl - baseUrl of the rosetta api
 * @returns {CardanoProvider} CardanoProvider
 */

export const rosettaProvider = ({ baseUrl, network }: RosettaProviderOptions): CardanoProvider => {
  const client = axios.create({ baseURL: baseUrl });
  const network_identifier = { blockchain: 'cardano', network };

  const submitTx: CardanoProvider['submitTx'] = async (signedTransaction) => {
    try {
      type Response = {
        transaction_identifier: {
          hash: string;
        };
      };

      const body = {
        network_identifier,
        signed_transaction: signedTransaction
      };

      const response = await client.post<Response>('/construction/submit', body);

      return !!response.data.transaction_identifier;
    } catch {
      return false;
    }
  };

  const utxo: CardanoProvider['utxo'] = async (addresses) => {
    type Response = {
      block_identifier: {
        index: number;
        hash: string;
      };
      coins: [
        {
          coin_identifier: {
            identifier: string;
          };
          amount: {
            value: string;
            currency: {
              symbol: string;
              decimals: 8;
              metadata: {
                Issuer: string;
              };
            };
            metadata: Record<
              string,
              {
                policyId: string;
                tokens: {
                  value: string;
                  currency: {
                    symbol: string;
                    decimals: number;
                    metadata: {
                      policyId: string;
                    };
                  };
                }[];
              }[]
            >;
          };
        }
      ];
      metadata: {
        sequence_number: number;
      };
    };

    const results = await Promise.all(
      addresses.map((address) => {
        const body = { network_identifier, account_identifier: { address } };
        return client.post<Response>('/account/coins', body);
      })
    );

    return results.flatMap(
      ({ data }, index) =>
        data.coins.map((coin) => {
          const txIn: Cardano.TxIn = { txId: coin.coin_identifier.identifier, index: data.block_identifier.index };

          const metadata = coin.amount.metadata[coin.coin_identifier.identifier];
          const assets: Cardano.Value['assets'] = {};
          for (const m of metadata) {
            for (const t of m.tokens) {
              const assetId = t.currency.metadata.policyId + t.currency.symbol;
              assets[assetId] = BigInt(t.value);
            }
          }
          const value: Cardano.Value = { coins: Number(coin.amount.value), assets };
          const txOut: Cardano.TxOut = { address: addresses[index], value };

          return [txIn, txOut];
        }) as Cardano.Utxo
    );
  };

  const queryTransactionsByAddresses: CardanoProvider['queryTransactionsByAddresses'] = async (addresses) => {};

  const queryTransactionsByHashes: CardanoProvider['queryTransactionsByHashes'] = async (hashes) => {};

  return {
    submitTx,
    utxo,
    queryTransactionsByAddresses,
    queryTransactionsByHashes
  };
};
