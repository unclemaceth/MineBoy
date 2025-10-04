// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MineStrategy Token (MNESTR)
 * @dev ERC20 token with:
 *  - Fixed supply cap: 1,000,000,000 MNESTR
 *  - Burnable (for buyback & burn mechanics)
 *  - Minter role (only V3 router can mint)
 *  - AccessControl for role management
 */
contract MineStrategyToken is ERC20, ERC20Burnable, ERC20Capped, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /**
     * @dev Constructor
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     */
    constructor(address admin) 
        ERC20("MineStrategy", "MNESTR")
        ERC20Capped(1_000_000_000 * 10**18) // 1 billion cap
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Mint new tokens (only MINTER_ROLE)
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}

