/* eslint-disable max-len */
import { loadCardanoSerializationLib, CardanoSerializationLib, Cardano, CardanoProvider } from '@cardano-sdk/core';
import { InputSelector, roundRobinRandomImprove } from '@cardano-sdk/cip2';
import { providerStub } from './ProviderStub';
import {
  createSingleAddressWallet,
  InMemoryUtxoRepository,
  KeyManagement,
  SingleAddressWallet,
  SingleAddressWalletDependencies,
  UtxoRepository
} from '../src';

describe('Wallet', () => {
  const name = 'Test Wallet';
  let csl: CardanoSerializationLib;
  let inputSelector: InputSelector;
  let keyManager: KeyManagement.KeyManager;
  let provider: CardanoProvider;
  let utxoRepository: UtxoRepository;
  let walletDependencies: SingleAddressWalletDependencies;

  beforeEach(async () => {
    csl = await loadCardanoSerializationLib();
    keyManager = KeyManagement.createInMemoryKeyManager({
      csl,
      mnemonicWords: KeyManagement.util.generateMnemonicWords(),
      networkId: Cardano.NetworkId.testnet,
      password: '123'
    });
    provider = providerStub();
    inputSelector = roundRobinRandomImprove(csl);
    utxoRepository = new InMemoryUtxoRepository(csl, provider, keyManager, inputSelector);
    walletDependencies = { csl, keyManager, provider, utxoRepository };
  });

  test('createWallet', async () => {
    const wallet = await createSingleAddressWallet({ name }, walletDependencies);
    expect(wallet.address).toBeDefined();
    expect(wallet.name).toBe(name);
    expect(typeof wallet.initializeTx).toBe('function');
    expect(typeof wallet.signTx).toBe('function');
  });

  describe('wallet behaviour', () => {
    let wallet: SingleAddressWallet;
    const props = {
      outputs: new Set([
        {
          address:
            'addr_test1qpu5vlrf4xkxv2qpwngf6cjhtw542ayty80v8dyr49rf5ewvxwdrt70qlcpeeagscasafhffqsxy36t90ldv06wqrk2qum8x5w',
          value: { coins: 11_111_111 }
        }
      ])
    };

    beforeEach(async () => {
      wallet = await createSingleAddressWallet({ name }, walletDependencies);
    });

    test('initializeTx', async () => {
      const txInternals = await wallet.initializeTx(props);
      expect(txInternals.body).toBeInstanceOf(csl.TransactionBody);
      expect(txInternals.hash).toBeInstanceOf(csl.TransactionHash);
    });

    test('signTx', async () => {
      const { body, hash } = await wallet.initializeTx(props);
      const tx = await wallet.signTx(body, hash);
      await expect(tx.body().outputs().len()).toBe(2);
      await expect(tx.body().inputs().len()).toBeGreaterThan(0);
    });

    test('submitTx', async () => {
      const { body, hash } = await wallet.initializeTx(props);
      const tx = await wallet.signTx(body, hash);
      const result = await wallet.submitTx(tx);
      expect(result).toBe(true);
    });
  });
});
