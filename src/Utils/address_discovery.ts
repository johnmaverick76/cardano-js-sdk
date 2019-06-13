import { Bip44AccountPublic } from 'cardano-wallet'
import { getBindingsForEnvironment } from '../lib/bindings'
import { AddressType } from '../Wallet'
const { AddressKeyIndex, BlockchainSettings } = getBindingsForEnvironment()

/** BIP44 specifies that discovery should occur for an address type in batches of 20, until no balances exist */
export function addressDiscoveryWithinBounds ({ type, account, lowerBound, upperBound }: {
  type: AddressType,
  account: Bip44AccountPublic,
  lowerBound: number,
  upperBound: number
}, chainSettings = BlockchainSettings.mainnet()) {
  const addressIndices = Array(upperBound - lowerBound + 1)
    .fill(0)
    .map((_, idx) => lowerBound + idx)

  return addressIndices.map(index => {
    const pubKey = account
      .bip44_chain(type === AddressType.internal)
      .address_key(AddressKeyIndex.new(index))

    const address = pubKey.bootstrap_era_address(chainSettings)
    return {
      address: address.to_base58(),
      index,
      type
    }
  })
}