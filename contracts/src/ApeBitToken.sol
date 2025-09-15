// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ApeBitToken
 * @dev ERC-20 token with controlled minting for MinerBoy rewards
 * @notice Only addresses with MINTER_ROLE can mint new tokens
 */
contract ApeBitToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /**
     * @dev Constructor sets up the token with name, symbol, and grants admin role
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     */
    constructor(address admin) ERC20("ApeBit", "ABIT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Mints tokens to a specified address
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     * @notice Only addresses with MINTER_ROLE can call this function
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    /**
     * @dev Returns the number of decimals used by the token
     * @return uint8 Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
