const { ethers } = require("ethers");
const solc = require("solc");
const fs = require("fs");
require("dotenv").config();

// Contract source code
const contractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ApeBitClaim {
    bytes4 constant MAGIC = 0x41424954;
    mapping(bytes32 => bool) public claimed;
    uint256 public immutable suffixValue;
    uint256 public immutable suffixMask;
    bytes32 public lastHash;

    event Claimed(address indexed miner, bytes32 hash, bytes preimage, uint64 attempts);

    constructor(uint256 _suffixValue, uint256 _suffixMask) {
        require(_suffixMask == 0xFFFF || _suffixMask == 0xFFFFFF, "Invalid mask");
        require((_suffixValue & _suffixMask) == _suffixValue, "Value exceeds mask");
        suffixValue = _suffixValue;
        suffixMask = _suffixMask;
    }

    function claim(bytes calldata preimage) external {
        require(preimage.length == 92, "Invalid preimage length");

        bytes4 magic;
        assembly {
            magic := shr(224, calldataload(preimage.offset))
        }
        require(magic == MAGIC, "Invalid magic header");

        address minedMiner;
        assembly {
            minedMiner := shr(96, calldataload(add(preimage.offset, 32)))
        }
        require(minedMiner == msg.sender, "Miner mismatch");

        address preimageContract;
        assembly {
            preimageContract := shr(96, calldataload(add(preimage.offset, 12)))
        }
        require(preimageContract == address(this), "Contract mismatch");

        uint64 preimageChainId;
        assembly {
            let data := calldataload(add(preimage.offset, 4))
            preimageChainId := shr(192, data)
        }
        require(preimageChainId == block.chainid, "ChainId mismatch");

        bytes32 prevHash;
        assembly {
            prevHash := calldataload(add(preimage.offset, 52))
        }
        require(prevHash == lastHash, "Previous hash mismatch");

        uint64 attempts;
        assembly {
            let data := calldataload(add(preimage.offset, 84))
            attempts := shr(192, data)
        }

        bytes32 h = sha256(preimage);
        require(!claimed[h], "Already claimed");
        require((uint256(h) & suffixMask) == suffixValue, "Invalid suffix");

        claimed[h] = true;
        lastHash = h;

        emit Claimed(minedMiner, h, preimage, attempts);
    }

    function getDifficulty() external view returns (uint256 value, uint256 mask) {
        return (suffixValue, suffixMask);
    }
}
`;

async function main() {
    // Configuration
    const DEV_SUFFIX_VALUE = 0xAB17;  // Must end with "ab17"
    const DEV_SUFFIX_MASK = 0xFFFF;   // 16 bits (4 hex digits)

    console.log("🚀 Deploying ApeBitClaim contract...");
    console.log(`📋 Suffix Value: 0x${DEV_SUFFIX_VALUE.toString(16).toUpperCase()}`);
    console.log(`📋 Suffix Mask:  0x${DEV_SUFFIX_MASK.toString(16).toUpperCase()}`);

    // Check environment
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ Please set PRIVATE_KEY in .env file");
        process.exit(1);
    }

    // Compile contract
    console.log("🔨 Compiling contract...");
  const input = {
    language: 'Solidity',
    sources: {
      'ApeBitClaim.sol': {
        content: contractSource
      }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['*']
        }
      }
    }
  };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        const hasErrors = output.errors.some(error => error.severity === 'error');
        if (hasErrors) {
            console.error("❌ Compilation errors:");
            output.errors.forEach(error => console.error(error.formattedMessage));
            process.exit(1);
        }
    }

    const contract = output.contracts['ApeBitClaim.sol']['ApeBitClaim'];
    const bytecode = contract.evm.bytecode.object;
    const abi = contract.abi;

    // Setup provider and wallet
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.curtis.apechain.com");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log(`👛 Deploying from: ${wallet.address}`);

    // Check balance
    const balance = await wallet.getBalance();
    console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} APE`);

    if (balance.isZero()) {
        console.error("❌ Insufficient balance for deployment");
        process.exit(1);
    }

    // Deploy contract
    console.log("📤 Deploying contract...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployTx = await factory.deploy(DEV_SUFFIX_VALUE, DEV_SUFFIX_MASK);
    
    console.log(`⏳ Transaction hash: ${deployTx.deployTransaction.hash}`);
    console.log("⏳ Waiting for confirmation...");
    
    await deployTx.deployed();
    
    console.log(`✅ ApeBitClaim deployed to: ${deployTx.address}`);
    console.log(`🔗 Chain ID: 33139 (Curtis testnet)`);

    // Verify deployment
    const [value, mask] = await deployTx.getDifficulty();
    console.log(`🔍 Verified - Suffix Value: 0x${value.toString(16).toUpperCase()}`);
    console.log(`🔍 Verified - Suffix Mask:  0x${mask.toString(16).toUpperCase()}`);

    // Save ABI and address
    const deploymentInfo = {
        address: deployTx.address,
        abi: abi,
        chainId: 33139,
        suffixValue: DEV_SUFFIX_VALUE,
        suffixMask: DEV_SUFFIX_MASK,
        deployedAt: new Date().toISOString()
    };

    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("💾 Deployment info saved to deployment.json");

    console.log("\\n📝 Next steps:");
    console.log(`1. Update your web app's contract address to: ${deployTx.address}`);
    console.log(`2. Update your iOS app's CONTRACT_ADDR to: ${deployTx.address}`);
    console.log(`3. Ensure both apps use chainId: 33139`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
