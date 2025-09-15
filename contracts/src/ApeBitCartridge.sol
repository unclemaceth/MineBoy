// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ApeBitCartridge
 * @dev ERC-721 NFT collection that gates access to ApeBit mining
 * @notice Each token represents a mining cartridge that can be used in MinerBoy
 */
contract ApeBitCartridge is ERC721, AccessControl {
    using Strings for uint256;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;
    uint256 public maxSupply;
    uint256 public mintPrice;
    
    // Events
    event CartridgeMinted(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event MintPriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    
    /**
     * @dev Constructor sets up the NFT collection
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     * @param _maxSupply Maximum number of cartridges that can be minted
     * @param _mintPrice Price to mint a cartridge (in wei)
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address admin,
        uint256 _maxSupply,
        uint256 _mintPrice,
        string memory baseURI
    ) ERC721("ApeBit Cartridge", "ABIT-CART") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Public mint function - anyone can mint by paying the price
     * @param to Address to receive the minted cartridge
     */
    function mint(address to) external payable {
        require(_nextTokenId <= maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        
        emit CartridgeMinted(to, tokenId);
        
        // Refund excess payment
        if (msg.value > mintPrice) {
            payable(msg.sender).transfer(msg.value - mintPrice);
        }
    }
    
    /**
     * @dev Admin mint function - free minting for admins
     * @param to Address to receive the minted cartridge
     * @param quantity Number of cartridges to mint
     */
    function adminMint(address to, uint256 quantity) external onlyRole(MINTER_ROLE) {
        require(_nextTokenId + quantity - 1 <= maxSupply, "Max supply reached");
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _mint(to, tokenId);
            emit CartridgeMinted(to, tokenId);
        }
    }
    
    /**
     * @dev Returns the total number of tokens minted
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }
    
    /**
     * @dev Returns the next token ID to be minted
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @dev Updates the base URI for token metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }
    
    /**
     * @dev Updates the mint price
     * @param newPrice New mint price in wei
     */
    function setMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }
    
    /**
     * @dev Updates the maximum supply
     * @param newMaxSupply New maximum supply
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply >= _nextTokenId - 1, "Cannot reduce below current supply");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }
    
    /**
     * @dev Withdraws contract balance to admin
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(msg.sender).transfer(balance);
    }
    
    /**
     * @dev Returns the base URI for token metadata
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @dev Returns the token URI for a given token ID
     * @param tokenId Token ID to get URI for
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json"))
            : "";
    }
    
    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
