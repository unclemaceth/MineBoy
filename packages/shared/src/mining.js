"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EIP712_TYPES = exports.EIP712_DOMAIN = void 0;
// EIP-712 Domain
exports.EIP712_DOMAIN = {
    name: 'MinerBoyClaim',
    version: '1',
    chainId: 33111, // Curtis testnet
    verifyingContract: '' // Will be set to router address
};
// EIP-712 Types
exports.EIP712_TYPES = {
    Claim: [
        { name: 'wallet', type: 'address' },
        { name: 'cartridge', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'rewardToken', type: 'address' },
        { name: 'rewardAmount', type: 'uint256' },
        { name: 'workHash', type: 'bytes32' },
        { name: 'attempts', type: 'uint64' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'expiry', type: 'uint64' }
    ]
};
