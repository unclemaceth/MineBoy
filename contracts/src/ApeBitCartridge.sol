// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title ApeBitCartridge
 * @dev ERC-721 NFT collection that gates access to ApeBit mining
 * @notice Each token represents a mining cartridge that can be used in MinerBoy
 */
contract ApeBitCartridge is ERC721, AccessControl, IERC2981 {
    using Strings for uint256;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;
    string private _animationURI;
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public maxPerWallet;
    
    // Royalty information
    address public royaltyRecipient;
    uint256 public royaltyBps; // Basis points (100 = 1%)
    
    // Track mints per wallet
    mapping(address => uint256) public walletMintCount;
    
    // Events
    event CartridgeMinted(address indexed to, uint256 indexed tokenId);
    event BaseURIUpdated(string newBaseURI);
    event AnimationURIUpdated(string newAnimationURI);
    event MintPriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event MaxPerWalletUpdated(uint256 newMaxPerWallet);
    event RoyaltyUpdated(address indexed recipient, uint256 bps);
    
    /**
     * @dev Constructor sets up the NFT collection
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     * @param _maxSupply Maximum number of cartridges that can be minted
     * @param _mintPrice Price to mint a cartridge (in wei)
     * @param _maxPerWallet Maximum number of cartridges per wallet
     * @param _royaltyRecipient Address to receive royalties
     * @param _royaltyBps Royalty in basis points (100 = 1%)
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address admin,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _maxPerWallet,
        address _royaltyRecipient,
        uint256 _royaltyBps,
        string memory baseURI
    ) ERC721("ApeBit Cartridge", "ABIT-CART") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        maxPerWallet = _maxPerWallet;
        royaltyRecipient = _royaltyRecipient;
        royaltyBps = _royaltyBps;
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Public mint function - only authorized minters can mint
     * @param to Address to receive the minted cartridge
     */
    function mint(address to) external payable onlyRole(MINTER_ROLE) {
        require(_nextTokenId <= maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(walletMintCount[to] < maxPerWallet, "Max per wallet reached");
        
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        walletMintCount[to]++;
        
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
        require(walletMintCount[to] + quantity <= maxPerWallet, "Max per wallet reached");
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _mint(to, tokenId);
            emit CartridgeMinted(to, tokenId);
        }
        walletMintCount[to] += quantity;
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
     * @dev Updates the animation URI for all tokens
     * @param newAnimationURI New animation URI
     */
    function setAnimationURI(string calldata newAnimationURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _animationURI = newAnimationURI;
        emit AnimationURIUpdated(newAnimationURI);
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
     * @dev Updates the maximum per wallet limit
     * @param newMaxPerWallet New maximum per wallet
     */
    function setMaxPerWallet(uint256 newMaxPerWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPerWallet = newMaxPerWallet;
        emit MaxPerWalletUpdated(newMaxPerWallet);
    }
    
    /**
     * @dev Updates the royalty information
     * @param _royaltyRecipient Address to receive royalties
     * @param _royaltyBps Royalty in basis points (100 = 1%)
     */
    function setRoyaltyInfo(address _royaltyRecipient, uint256 _royaltyBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_royaltyBps <= 1000, "Royalty cannot exceed 10%");
        royaltyRecipient = _royaltyRecipient;
        royaltyBps = _royaltyBps;
        emit RoyaltyUpdated(_royaltyRecipient, _royaltyBps);
    }
    
    /**
     * @dev Returns royalty information for a token
     * @param tokenId Token ID (unused, same royalty for all tokens)
     * @param salePrice Sale price of the token
     * @return receiver Address to receive royalties
     * @return royaltyAmount Amount of royalty to be paid
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view override returns (address receiver, uint256 royaltyAmount) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        receiver = royaltyRecipient;
        royaltyAmount = (salePrice * royaltyBps) / 10000;
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
        if (bytes(baseURI).length == 0) {
            return "";
        }
        
        // Return JSON metadata with image and animation_url
        string memory imageURI = string(abi.encodePacked(baseURI, tokenId.toString(), ".png"));
        string memory animationURI = _animationURI;
        
        return string(abi.encodePacked(
            'data:application/json;base64,',
            _encodeBase64(bytes(string(abi.encodePacked(
                '{"name":"ApeBit Cartridge #', tokenId.toString(), '",',
                '"description":"A mining cartridge for the MineBoy game. Each cartridge unlocks the ability to mine ApeBit tokens on ApeChain.",',
                '"image":"', imageURI, '",',
                '"animation_url":"', animationURI, '",',
                '"attributes":[',
                '{"trait_type":"Type","value":"Mining Cartridge"},',
                '{"trait_type":"Game","value":"MineBoy"},',
                '{"trait_type":"Network","value":"ApeChain"}',
                ']}'
            ))))
        ));
    }
    
    /**
     * @dev Internal function to encode bytes to base64
     */
    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        string memory result = new string(encodedLen + 32);
        
        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            
            for {
                let i := 0
            } lt(i, mload(data)) {
                i := add(i, 3)
            } {
                let input := and(mload(add(data, add(32, i))), 0xffffff)
                
                let out := mload(add(tablePtr, and(shr(18, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(input, 0x3F))), 0xFF))
                out := shl(224, out)
                
                mstore(resultPtr, out)
                resultPtr := add(resultPtr, 4)
            }
            
            switch mod(mload(data), 3)
            case 1 {
                mstore(sub(resultPtr, 2), shl(240, 0x3d3d))
            }
            case 2 {
                mstore(sub(resultPtr, 1), shl(248, 0x3d))
            }
        }
        
        return result;
    }
    
    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
}
