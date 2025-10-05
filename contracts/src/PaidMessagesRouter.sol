// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PaidMessagesRouter
 * @notice Flexible router for paid messages with configurable price and fee splits
 * @dev Works with all wallet types (EOA, AA, WalletConnect) by emitting an event
 */
contract PaidMessagesRouter is ReentrancyGuard, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public price; // Current price in wei (1 APE = 1 ether)
    
    // Fee recipients and their basis points (100 bps = 1%)
    address payable public teamWallet;
    address payable public flywheelWallet;
    address payable public lpWallet;
    
    uint256 public teamBps;      // e.g., 5000 = 50%
    uint256 public flywheelBps;  // e.g., 3000 = 30%
    uint256 public lpBps;        // e.g., 2000 = 20%
    
    uint256 private constant BPS_DENOMINATOR = 10000;

    event Paid(address indexed payer, uint256 amount, bytes32 msgHash);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event WalletUpdated(string walletType, address oldWallet, address newWallet);
    event FeeSplitUpdated(uint256 teamBps, uint256 flywheelBps, uint256 lpBps);

    error WrongAmount();
    error ForwardFailed();
    error InvalidAddress();
    error InvalidFeeSplit();

    constructor(
        address admin,
        uint256 initialPrice,
        address payable _teamWallet,
        address payable _flywheelWallet,
        address payable _lpWallet,
        uint256 _teamBps,
        uint256 _flywheelBps,
        uint256 _lpBps
    ) {
        if (_teamWallet == address(0) || _flywheelWallet == address(0) || _lpWallet == address(0)) {
            revert InvalidAddress();
        }
        if (_teamBps + _flywheelBps + _lpBps != BPS_DENOMINATOR) {
            revert InvalidFeeSplit();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        price = initialPrice;
        teamWallet = _teamWallet;
        flywheelWallet = _flywheelWallet;
        lpWallet = _lpWallet;
        teamBps = _teamBps;
        flywheelBps = _flywheelBps;
        lpBps = _lpBps;
    }

    /**
     * @notice Pay to post a message
     * @param msgHash Hash of the message content (keccak256)
     */
    function pay(bytes32 msgHash) external payable nonReentrant {
        if (msg.value != price) revert WrongAmount();
        
        // Calculate splits
        uint256 teamAmount = (msg.value * teamBps) / BPS_DENOMINATOR;
        uint256 flywheelAmount = (msg.value * flywheelBps) / BPS_DENOMINATOR;
        uint256 lpAmount = msg.value - teamAmount - flywheelAmount; // Avoid rounding issues
        
        // Send to recipients
        (bool teamOk, ) = teamWallet.call{value: teamAmount}("");
        if (!teamOk) revert ForwardFailed();
        
        (bool flywheelOk, ) = flywheelWallet.call{value: flywheelAmount}("");
        if (!flywheelOk) revert ForwardFailed();
        
        (bool lpOk, ) = lpWallet.call{value: lpAmount}("");
        if (!lpOk) revert ForwardFailed();
        
        emit Paid(msg.sender, msg.value, msgHash);
    }

    /**
     * @notice Update the price
     * @param newPrice New price in wei
     */
    function setPrice(uint256 newPrice) external onlyRole(ADMIN_ROLE) {
        uint256 oldPrice = price;
        price = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Update team wallet
     * @param newWallet New team wallet address
     */
    function setTeamWallet(address payable newWallet) external onlyRole(ADMIN_ROLE) {
        if (newWallet == address(0)) revert InvalidAddress();
        address oldWallet = teamWallet;
        teamWallet = newWallet;
        emit WalletUpdated("team", oldWallet, newWallet);
    }

    /**
     * @notice Update flywheel wallet
     * @param newWallet New flywheel wallet address
     */
    function setFlywheelWallet(address payable newWallet) external onlyRole(ADMIN_ROLE) {
        if (newWallet == address(0)) revert InvalidAddress();
        address oldWallet = flywheelWallet;
        flywheelWallet = newWallet;
        emit WalletUpdated("flywheel", oldWallet, newWallet);
    }

    /**
     * @notice Update LP wallet
     * @param newWallet New LP wallet address
     */
    function setLPWallet(address payable newWallet) external onlyRole(ADMIN_ROLE) {
        if (newWallet == address(0)) revert InvalidAddress();
        address oldWallet = lpWallet;
        lpWallet = newWallet;
        emit WalletUpdated("lp", oldWallet, newWallet);
    }

    /**
     * @notice Update fee splits
     * @param _teamBps Team basis points
     * @param _flywheelBps Flywheel basis points
     * @param _lpBps LP basis points
     */
    function setFeeSplits(
        uint256 _teamBps,
        uint256 _flywheelBps,
        uint256 _lpBps
    ) external onlyRole(ADMIN_ROLE) {
        if (_teamBps + _flywheelBps + _lpBps != BPS_DENOMINATOR) {
            revert InvalidFeeSplit();
        }
        teamBps = _teamBps;
        flywheelBps = _flywheelBps;
        lpBps = _lpBps;
        emit FeeSplitUpdated(_teamBps, _flywheelBps, _lpBps);
    }

    // Don't accept plain sends; force callers to use pay()
    receive() external payable { 
        revert("use pay()"); 
    }
    
    fallback() external payable { 
        revert("use pay()"); 
    }
}
