import { CardanoSerializationLib, CSL, cslUtil, InvalidProtocolParametersError } from '@cardano-sdk/core';
import { ProtocolParametersRequiredByInputSelection } from '.';
import {
  TokenBundleSizeExceedsLimit,
  ComputeMinimumCoinQuantity,
  EstimateTxFee,
  SelectionSkeleton,
  ComputeSelectionLimit,
  ProtocolParametersForInputSelection,
  SelectionConstraints
} from './types';

export type BuildTx = (selection: SelectionSkeleton) => Promise<CSL.Transaction>;

export interface DefaultSelectionConstraintsProps {
  csl: CardanoSerializationLib;
  protocolParameters: ProtocolParametersForInputSelection;
  buildTx: BuildTx;
}

export const computeMinimumCost =
  (
    csl: CardanoSerializationLib,
    {
      minFeeCoefficient,
      minFeeConstant
    }: Pick<ProtocolParametersRequiredByInputSelection, 'minFeeCoefficient' | 'minFeeConstant'>,
    buildTx: BuildTx
  ): EstimateTxFee =>
  async (selection) => {
    const tx = await buildTx(selection);
    return BigInt(
      csl
        .min_fee(
          tx,
          csl.LinearFee.new(
            csl.BigNum.from_str(minFeeCoefficient.toString()),
            csl.BigNum.from_str(minFeeConstant.toString())
          )
        )
        .to_str()
    );
  };

export const computeMinimumCoinQuantity =
  (
    csl: CardanoSerializationLib,
    coinsPerUtxoWord: ProtocolParametersRequiredByInputSelection['coinsPerUtxoWord']
  ): ComputeMinimumCoinQuantity =>
  (multiasset) => {
    const minUTxOValue = csl.BigNum.from_str((coinsPerUtxoWord * 29).toString());
    const value = csl.Value.new(csl.BigNum.from_str('0'));
    if (multiasset) {
      value.set_multiasset(multiasset);
    }
    return BigInt(csl.min_ada_required(value, minUTxOValue).to_str());
  };

export const tokenBundleSizeExceedsLimit =
  (
    csl: CardanoSerializationLib,
    maxValueSize: ProtocolParametersRequiredByInputSelection['maxValueSize']
  ): TokenBundleSizeExceedsLimit =>
  (tokenBundle) => {
    if (!tokenBundle) {
      return false;
    }
    const value = csl.Value.new(cslUtil.maxBigNum(csl));
    value.set_multiasset(tokenBundle);
    return value.to_bytes().length > maxValueSize;
  };

const getTxSize = (tx: CSL.Transaction) => tx.to_bytes().length;

/**
 * This constraint implementation is not intended to used by selection algorithms
 * that adjust selection based on selection limit. RRRI implementation uses this after selecting all the inputs
 * and throws MaximumInputCountExceeded if the constraint returns a limit higher than number of selected utxo.
 *
 * @returns {ComputeSelectionLimit} constraint that returns txSize <= maxTxSize ? utxo[].length : utxo[].length+1
 */
export const computeSelectionLimit =
  (maxTxSize: ProtocolParametersRequiredByInputSelection['maxTxSize'], buildTx: BuildTx): ComputeSelectionLimit =>
  async (selectionSkeleton) => {
    const tx = await buildTx(selectionSkeleton);
    const txSize = getTxSize(tx);
    if (txSize <= maxTxSize) {
      return selectionSkeleton.inputs.size;
    }
    return selectionSkeleton.inputs.size + 1;
  };

export const defaultSelectionConstraints = ({
  csl,
  protocolParameters: { coinsPerUtxoWord, maxTxSize, maxValueSize, minFeeCoefficient, minFeeConstant },
  buildTx
}: DefaultSelectionConstraintsProps): SelectionConstraints => {
  if (!coinsPerUtxoWord || !maxTxSize || !maxValueSize || !minFeeCoefficient || !minFeeConstant) {
    throw new InvalidProtocolParametersError(
      'Missing one of: coinsPerUtxoWord, maxTxSize, maxValueSize, minFeeCoefficient, minFeeConstant'
    );
  }
  return {
    computeMinimumCost: computeMinimumCost(csl, { minFeeCoefficient, minFeeConstant }, buildTx),
    computeMinimumCoinQuantity: computeMinimumCoinQuantity(csl, coinsPerUtxoWord),
    computeSelectionLimit: computeSelectionLimit(maxTxSize, buildTx),
    tokenBundleSizeExceedsLimit: tokenBundleSizeExceedsLimit(csl, maxValueSize)
  };
};
