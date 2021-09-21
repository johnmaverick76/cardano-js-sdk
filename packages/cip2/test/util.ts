// These are utilities used by tests. They are not tested.
// Consider moving some of them to core package utils.
// And some of them to a new 'dev-util' package.
import { CardanoSerializationLib } from '@cardano-sdk/cardano-serialization-lib/src/loadCardanoSerializationLib';
import {
  TransactionUnspentOutput,
  TransactionOutput,
  ScriptHash,
  Assets
} from '@emurgo/cardano-serialization-lib-nodejs';
import { SelectionResult } from '@src/types';
import {
  coalesceValueQuantities,
  ValueQuantities,
  createCslUtils,
  AssetQuantities,
  computeMinUtxoValue
} from '@src/util';
import fc, { Arbitrary } from 'fast-check';

export const coinsPerUtxoWord = 34_482n;

export interface TxAssets {
  key: ScriptHash;
  value: Assets;
}

export const TSLA_Asset = 'b32_1vk0jj9lmv0cjkvmxw337u467atqcgkauwd4eczaugzagyghp25lTSLA';
export const PXL_Asset = 'b32_1rmy9mnhz0ukepmqlng0yee62ve7un05trpzxxg3lnjtqzp4dmmrPXL';
export const Unit_Asset = 'b32_154p9h4augxpry5vg4u35qs2cy7nnlpzcgmqktk0pf3dw68m28hsUnit';
export const AllAssets = [TSLA_Asset, PXL_Asset, Unit_Asset];

/**
 * @returns {Arbitrary} fast-check arbitrary that generates valid sets of UTxO and outputs for input selection.
 */
export const generateValidUtxoAndOutputs = (() => {
  const MAX_U64 = 18_446_744_073_709_551_615n;
  const MIN_UTXO_VALUE = computeMinUtxoValue(coinsPerUtxoWord);

  type GetAssetAmount = (asset: string) => bigint;

  /**
   * @returns {boolean} true if sum of every token amount doesn't exceed provided values.
   */
  const doesntExceedAmounts = (
    quantities: ValueQuantities[],
    maxCoin = MAX_U64,
    getAssetMax: GetAssetAmount
  ): boolean => {
    const totals = coalesceValueQuantities(...quantities);
    if (totals.coins > maxCoin) {
      return false;
    }
    if (!totals.assets) {
      return true;
    }
    return Object.keys(totals.assets).every((key) => totals.assets[key] <= getAssetMax(key));
  };

  /**
   * Generate random amount of coin and assets.
   */
  const coinAndAssets = (maxCoin: bigint, getAssetMax: GetAssetAmount) =>
    fc
      .tuple(
        fc.bigInt(MIN_UTXO_VALUE, maxCoin),
        fc
          .set(fc.oneof(...AllAssets.map((asset) => fc.constant(asset))))
          .chain((assets) =>
            fc.tuple(...assets.map((asset) => fc.bigUint(getAssetMax(asset)).map((amount) => ({ asset, amount }))))
          )
          .map((assets) =>
            assets
              .filter(({ amount }) => amount > 0n)
              // eslint-disable-next-line unicorn/no-array-reduce
              .reduce((quantities, { amount, asset }) => {
                quantities[asset] = amount;
                return quantities;
              }, {} as AssetQuantities)
          )
      )
      .map(([coins, assets]): ValueQuantities => ({ coins, assets }));

  /**
   * Generate an array of random quantities of coin and assets.
   */
  const arrayOfCoinAndAssets = (maxCoin = MAX_U64, getAssetMax: GetAssetAmount = () => MAX_U64) =>
    fc
      .array(coinAndAssets(maxCoin, getAssetMax))
      // Verify that sum of all array items doesn't exceed limit quantities
      .filter((results) => doesntExceedAmounts(results, maxCoin, getAssetMax));

  return (): Arbitrary<{
    utxoAmounts: ValueQuantities[];
    outputsAmounts: ValueQuantities[];
  }> =>
    arrayOfCoinAndAssets().chain((utxoAmounts) => {
      // Generate outputs with quantities not exceeding utxo quantities.
      // Testing balance insufficient and other failures in example-based tests.
      if (utxoAmounts.length === 0) {
        return fc.constant({ utxoAmounts, outputsAmounts: [] });
      }
      const utxoTotals = coalesceValueQuantities(...utxoAmounts);
      return arrayOfCoinAndAssets(utxoTotals.coins, (asset) => utxoTotals.assets?.[asset] || 0n)
        .filter((outputsAmounts) => {
          const outputsTotals = coalesceValueQuantities(...outputsAmounts);
          // Change has to be >= minUtxoValue
          return utxoTotals.coins - outputsTotals.coins >= MIN_UTXO_VALUE;
        })
        .map((outputsAmounts) => ({ utxoAmounts, outputsAmounts }));
    });
})();

/**
 * Checks whether UTxO is included in an array of UTxO.
 * Compares utxo.to_bytes().
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const containsUtxo = (haystack: TransactionUnspentOutput[], needleUtxo: TransactionUnspentOutput) => {
  const needleUtxoBytes = needleUtxo.to_bytes();
  return haystack.some((haystackUtxo: TransactionUnspentOutput) => {
    const haystackUtxoBytes = haystackUtxo.to_bytes();
    if (haystackUtxoBytes.length !== needleUtxoBytes.length) {
      return false;
    }
    for (const [idx, utxoByte] of needleUtxoBytes.entries()) {
      if (haystackUtxoBytes[idx] !== utxoByte) {
        return false;
      }
    }
    return true;
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createCslTestUtils = (CSL: CardanoSerializationLib) => {
  const createTxInput = (() => {
    let defaultIdx = 0;
    return (bech32TxHash = 'base16_1sw0vvt7mgxghdewkrsptd2n0twueg2a7q88t9cjhtqmpk7xwc07shpk2uq', index?: number) =>
      CSL.TransactionInput.new(CSL.TransactionHash.from_bech32(bech32TxHash), index || defaultIdx++);
  })();

  const cslUtils = createCslUtils(CSL);

  const getTotalOutputAmounts = (outputs: TransactionOutput[]): ValueQuantities => {
    let result: ValueQuantities = {
      coins: 0n,
      assets: {} as Record<string, bigint>
    };
    for (const output of outputs) {
      const amount = output.amount();
      result = coalesceValueQuantities(result, cslUtils.valueToValueQuantities(amount));
    }
    return result;
  };

  const getTotalInputAmounts = (results: SelectionResult): ValueQuantities =>
    results.selection.inputs
      .map((input) => input.output().amount())
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce<ValueQuantities>((sum, value) => coalesceValueQuantities(sum, cslUtils.valueToValueQuantities(value)), {
        coins: 0n,
        assets: {}
      });

  const getTotalChangeAmounts = (results: SelectionResult): ValueQuantities =>
    // eslint-disable-next-line unicorn/no-array-reduce
    results.selection.change.reduce<ValueQuantities>(
      (sum, value) => coalesceValueQuantities(sum, cslUtils.valueToValueQuantities(value)),
      {
        assets: {},
        coins: 0n
      }
    );

  const createOutputsObj = (outputs: TransactionOutput[]) => {
    const result = CSL.TransactionOutputs.new();
    for (const output of outputs) {
      result.add(output);
    }
    return result;
  };

  const createUnspentTxOutput = (
    valueQuantities: ValueQuantities,
    bech32Addr = 'addr1vy36kffjf87vzkuyqc5g0ys3fe3pez5zvqg9r5z9q9kfrkg2cs093'
  ): TransactionUnspentOutput => {
    const address = CSL.Address.from_bech32(bech32Addr);
    const amount = cslUtils.valueQuantitiesToValue(valueQuantities);
    return CSL.TransactionUnspentOutput.new(createTxInput(), CSL.TransactionOutput.new(address, amount));
  };

  const createOutput = (
    valueQuantities: ValueQuantities,
    bech32Addr = 'addr1vyeljkh3vr4h9s3lyxe7g2meushk3m4nwyzdgtlg96e6mrgg8fnle'
  ): TransactionOutput =>
    CSL.TransactionOutput.new(CSL.Address.from_bech32(bech32Addr), cslUtils.valueQuantitiesToValue(valueQuantities));

  return {
    createUnspentTxOutput,
    createOutput,
    createOutputsObj,
    getTotalOutputAmounts,
    getTotalInputAmounts,
    getTotalChangeAmounts
  };
};

export type TestUtils = ReturnType<typeof createCslTestUtils>;
